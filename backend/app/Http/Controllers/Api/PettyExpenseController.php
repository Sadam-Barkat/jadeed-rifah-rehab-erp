<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PettyExpense;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PettyExpenseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = PettyExpense::query()
            ->with('creator:id,name,staff_code')
            ->latest('expense_date')
            ->latest('id');

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        } else {
            $query->where('status', 'posted');
        }

        if ($spentFor = trim((string) $request->get('spent_for', ''))) {
            $query->where('spent_for', $spentFor);
        }

        if ($createdBy = $request->integer('created_by')) {
            $query->where('created_by', $createdBy);
        }

        if ($from = $request->get('from')) {
            $query->whereDate('expense_date', '>=', $from);
        }
        if ($to = $request->get('to')) {
            $query->whereDate('expense_date', '<=', $to);
        }

        $date = trim((string) $request->get('date', ''));
        $year = $request->integer('year') ?: null;
        $month = $request->integer('month') ?: null;
        if ($date !== '') {
            $query->whereDate('expense_date', $date);
        } else {
            if ($year) {
                $query->whereYear('expense_date', $year);
            }
            if ($month && $month >= 1 && $month <= 12) {
                $query->whereMonth('expense_date', $month);
            }
        }

        if ($search = trim((string) $request->get('q', $request->get('search', '')))) {
            $like = "%{$search}%";
            $query->where(function ($q) use ($like, $search) {
                $q->where('expense_code', 'like', $like)
                    ->orWhere('title', 'like', $like)
                    ->orWhere('spent_for', 'like', $like)
                    ->orWhere('reason', 'like', $like)
                    ->orWhere('payment_method', 'like', $like)
                    ->orWhere('notes', 'like', $like)
                    ->orWhere('status', 'like', $like)
                    ->orWhere('void_reason', 'like', $like)
                    ->orWhereDate('expense_date', $search)
                    ->orWhere('expense_date', 'like', $like)
                    ->orWhereRaw('CAST(amount AS CHAR) LIKE ?', [$like])
                    ->orWhereHas('creator', function ($u) use ($like) {
                        $u->where('name', 'like', $like)
                            ->orWhere('staff_code', 'like', $like)
                            ->orWhere('email', 'like', $like);
                    });
            });
        }

        $paginator = $query->paginate($perPage);

        $summaryBase = PettyExpense::query()->where('status', 'posted');
        if ($from) {
            $summaryBase->whereDate('expense_date', '>=', $from);
        }
        if ($to) {
            $summaryBase->whereDate('expense_date', '<=', $to);
        }
        if ($date !== '') {
            $summaryBase->whereDate('expense_date', $date);
        } else {
            if ($year) {
                $summaryBase->whereYear('expense_date', $year);
            }
            if ($month && $month >= 1 && $month <= 12) {
                $summaryBase->whereMonth('expense_date', $month);
            }
        }
        if ($createdBy) {
            $summaryBase->where('created_by', $createdBy);
        }
        if ($spentFor) {
            $summaryBase->where('spent_for', $spentFor);
        }

        $spentForOptions = PettyExpense::query()
            ->where('status', 'posted')
            ->whereNotNull('spent_for')
            ->where('spent_for', '!=', '')
            ->distinct()
            ->orderBy('spent_for')
            ->limit(100)
            ->pluck('spent_for')
            ->values()
            ->all();

        $staff = PettyExpense::query()
            ->with('creator:id,name,staff_code')
            ->whereNotNull('created_by')
            ->latest('id')
            ->limit(200)
            ->get()
            ->pluck('creator')
            ->filter()
            ->unique('id')
            ->values()
            ->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'staff_code' => $u->staff_code,
            ])
            ->all();

        $availableYears = PettyExpense::query()
            ->where('status', 'posted')
            ->whereNotNull('expense_date')
            ->selectRaw('DISTINCT YEAR(expense_date) as y')
            ->orderByDesc('y')
            ->pluck('y')
            ->filter()
            ->map(fn ($y) => (int) $y)
            ->values()
            ->all();

        return response()->json([
            'data' => collect($paginator->items())->map(fn (PettyExpense $e) => $this->payload($e)),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'spent_for_options' => $spentForOptions,
                'staff' => $staff,
                'available_years' => $availableYears,
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
            'expense_date' => ['nullable', 'date'],
            'title' => ['required', 'string', 'max:150'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'spent_for' => ['required', 'string', 'max:150'],
            'reason' => ['required', 'string', 'max:255'],
            'payment_method' => ['nullable', Rule::in(['cash', 'bank', 'jazzcash', 'easypaisa', 'other'])],
            'notes' => ['nullable', 'string'],
        ]);

        $entry = PettyExpense::query()->create([
            'expense_code' => $this->nextCode(),
            'expense_date' => $data['expense_date'] ?? now()->toDateString(),
            'title' => trim($data['title']),
            'amount' => $data['amount'],
            'spent_for' => trim($data['spent_for']),
            'reason' => trim($data['reason']),
            'payment_method' => $data['payment_method'] ?? 'cash',
            'notes' => $data['notes'] ?? null,
            'status' => 'posted',
            'created_by' => $request->user()->id,
        ])->load('creator:id,name,staff_code');

        Audit::log(
            'petty.create',
            'billing',
            'petty_expense',
            $entry->id,
            "Petty {$entry->expense_code} for {$entry->spent_for}"
        );

        return response()->json([
            'message' => 'Petty expense recorded',
            'data' => $this->payload($entry),
        ], 201);
    }

    public function void(Request $request, PettyExpense $pettyExpense): JsonResponse
    {
        if ($pettyExpense->status === 'void') {
            return response()->json(['message' => 'Expense already voided.'], 422);
        }

        $data = $request->validate([
            'void_reason' => ['nullable', 'string', 'max:255'],
        ]);

        $pettyExpense->update([
            'status' => 'void',
            'void_reason' => $data['void_reason'] ?? null,
        ]);

        Audit::log(
            'petty.void',
            'billing',
            'petty_expense',
            $pettyExpense->id,
            "Voided {$pettyExpense->expense_code}"
        );

        return response()->json([
            'message' => 'Petty expense voided',
            'data' => $this->payload($pettyExpense->fresh()->load('creator:id,name,staff_code')),
        ]);
    }

    private function payload(PettyExpense $entry): array
    {
        return [
            'id' => $entry->id,
            'expense_code' => $entry->expense_code,
            'expense_date' => $entry->expense_date?->format('Y-m-d'),
            'title' => $entry->title,
            'amount' => $entry->amount,
            'spent_for' => $entry->spent_for,
            'reason' => $entry->reason,
            'payment_method' => $entry->payment_method,
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
        $prefix = "PE-{$year}-";
        $latest = PettyExpense::query()
            ->where('expense_code', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('expense_code');

        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
