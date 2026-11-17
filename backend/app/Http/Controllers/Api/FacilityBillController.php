<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FacilityBill;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class FacilityBillController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = FacilityBill::query()
            ->with('creator:id,name,staff_code')
            ->latest('bill_date')
            ->latest('id');

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        } else {
            $query->where('status', 'posted');
        }

        if ($billType = trim((string) $request->get('bill_type', ''))) {
            $query->where('bill_type', $billType);
        }

        if ($createdBy = $request->integer('created_by')) {
            $query->where('created_by', $createdBy);
        }

        if ($from = $request->get('from')) {
            $query->whereDate('bill_date', '>=', $from);
        }
        if ($to = $request->get('to')) {
            $query->whereDate('bill_date', '<=', $to);
        }

        $date = trim((string) $request->get('date', ''));
        $year = $request->integer('year') ?: null;
        $month = $request->integer('month') ?: null;
        if ($date !== '') {
            $query->whereDate('bill_date', $date);
        } else {
            if ($year) {
                $query->whereYear('bill_date', $year);
            }
            if ($month && $month >= 1 && $month <= 12) {
                $query->whereMonth('bill_date', $month);
            }
        }

        if ($search = trim((string) $request->get('q', $request->get('search', '')))) {
            $like = "%{$search}%";
            $query->where(function ($q) use ($like, $search) {
                $q->where('bill_code', 'like', $like)
                    ->orWhere('bill_type', 'like', $like)
                    ->orWhere('reference', 'like', $like)
                    ->orWhere('notes', 'like', $like)
                    ->orWhere('payment_method', 'like', $like)
                    ->orWhere('status', 'like', $like)
                    ->orWhere('void_reason', 'like', $like)
                    ->orWhereDate('bill_date', $search)
                    ->orWhere('bill_date', 'like', $like)
                    ->orWhereRaw('CAST(amount AS CHAR) LIKE ?', [$like])
                    ->orWhereHas('creator', function ($u) use ($like) {
                        $u->where('name', 'like', $like)
                            ->orWhere('staff_code', 'like', $like)
                            ->orWhere('email', 'like', $like);
                    });
            });
        }

        $paginator = $query->paginate($perPage);

        $summaryBase = FacilityBill::query()->where('status', 'posted');
        if ($from) {
            $summaryBase->whereDate('bill_date', '>=', $from);
        }
        if ($to) {
            $summaryBase->whereDate('bill_date', '<=', $to);
        }
        if ($date !== '') {
            $summaryBase->whereDate('bill_date', $date);
        } else {
            if ($year) {
                $summaryBase->whereYear('bill_date', $year);
            }
            if ($month && $month >= 1 && $month <= 12) {
                $summaryBase->whereMonth('bill_date', $month);
            }
        }
        if ($createdBy) {
            $summaryBase->where('created_by', $createdBy);
        }
        if ($billType) {
            $summaryBase->where('bill_type', $billType);
        }

        $availableYears = FacilityBill::query()
            ->where('status', 'posted')
            ->whereNotNull('bill_date')
            ->selectRaw('DISTINCT YEAR(bill_date) as y')
            ->orderByDesc('y')
            ->pluck('y')
            ->filter()
            ->map(fn ($y) => (int) $y)
            ->values()
            ->all();

        return response()->json([
            'data' => collect($paginator->items())->map(fn (FacilityBill $b) => $this->payload($b)),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'available_years' => $availableYears,
                'bill_types' => collect(FacilityBill::TYPES)
                    ->merge(
                        FacilityBill::query()
                            ->whereNotNull('bill_type')
                            ->where('bill_type', '!=', '')
                            ->distinct()
                            ->pluck('bill_type')
                    )
                    ->unique()
                    ->values()
                    ->map(fn ($t) => [
                        'value' => $t,
                        'label' => FacilityBill::typeLabel($t),
                    ])
                    ->all(),
            ],
            'summary' => [
                'total_amount' => round((float) (clone $summaryBase)->sum('amount'), 2),
                'entries' => (clone $summaryBase)->count(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'bill_date' => ['nullable', 'date'],
            'bill_type' => ['required', 'string', 'max:40'],
            'amount' => ['required', 'numeric', 'min:0'],
            'payment_method' => ['nullable', Rule::in(['cash', 'bank', 'jazzcash', 'easypaisa', 'other'])],
            'reference' => ['nullable', 'string', 'max:150'],
            'notes' => ['nullable', 'string'],
        ]);

        $billType = FacilityBill::normalizeType($data['bill_type']);

        $entry = FacilityBill::query()->create([
            'bill_code' => $this->nextCode(),
            'bill_date' => $data['bill_date'] ?? now()->toDateString(),
            'bill_type' => $billType,
            'amount' => $data['amount'],
            'payment_method' => $data['payment_method'] ?? 'bank',
            'reference' => isset($data['reference']) ? trim((string) $data['reference']) : null,
            'notes' => $data['notes'] ?? null,
            'status' => 'posted',
            'created_by' => $request->user()->id,
        ])->load('creator:id,name,staff_code');

        Audit::log(
            'facility_bill.create',
            'billing',
            'facility_bill',
            $entry->id,
            "Bill {$entry->bill_code} ({$entry->bill_type})"
        );

        return response()->json([
            'message' => 'Facility bill recorded',
            'data' => $this->payload($entry),
        ], 201);
    }

    public function void(Request $request, FacilityBill $facilityBill): JsonResponse
    {
        if ($facilityBill->status === 'void') {
            return response()->json(['message' => 'Bill already voided.'], 422);
        }

        $data = $request->validate([
            'void_reason' => ['nullable', 'string', 'max:255'],
        ]);

        $facilityBill->update([
            'status' => 'void',
            'void_reason' => $data['void_reason'] ?? null,
        ]);

        Audit::log(
            'facility_bill.void',
            'billing',
            'facility_bill',
            $facilityBill->id,
            "Voided {$facilityBill->bill_code}"
        );

        return response()->json([
            'message' => 'Facility bill voided',
            'data' => $this->payload($facilityBill->fresh()->load('creator:id,name,staff_code')),
        ]);
    }

    private function payload(FacilityBill $entry): array
    {
        return [
            'id' => $entry->id,
            'bill_code' => $entry->bill_code,
            'bill_date' => $entry->bill_date?->format('Y-m-d'),
            'bill_type' => $entry->bill_type,
            'bill_type_label' => FacilityBill::typeLabel($entry->bill_type),
            'amount' => $entry->amount,
            'payment_method' => $entry->payment_method,
            'reference' => $entry->reference,
            'notes' => $entry->notes,
            'status' => $entry->status,
            'void_reason' => $entry->void_reason,
            'entered_by' => $entry->creator?->name,
            'entered_by_id' => $entry->created_by,
            'created_at' => optional($entry->created_at)->toDateTimeString(),
        ];
    }

    private function nextCode(): string
    {
        $year = now()->format('Y');
        $prefix = "FB-{$year}-";
        $latest = FacilityBill::query()
            ->where('bill_code', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('bill_code');

        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
