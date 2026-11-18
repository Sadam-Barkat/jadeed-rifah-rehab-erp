<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Admission;
use App\Models\FeePackage;
use App\Models\FeePlan;
use App\Models\Invoice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InvoiceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = Invoice::query()
            ->with(['patient', 'admission', 'feePackage'])
            ->withExists([
                'payments as has_pending_payment' => fn ($q) => $q->where('approval_status', 'pending'),
            ])
            ->latest('issued_at');

        // All invoices for admissions that still have unpaid balance (progress view).
        if ($request->boolean('fee_progress')) {
            $admissionIds = Invoice::query()
                ->where('status', 'unpaid')
                ->where('balance', '>', 0)
                ->distinct()
                ->pluck('admission_id');
            $query->whereIn('admission_id', $admissionIds)->where('status', '!=', 'void');
        } elseif ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($request->filled('admission_id')) {
            $query->where('admission_id', (int) $request->integer('admission_id'));
        }

        if ($request->boolean('due_only')) {
            $query->where('balance', '>', 0)
                ->where('status', 'unpaid');
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('invoice_code', 'like', "%{$search}%")
                    ->orWhere('package_name', 'like', "%{$search}%")
                    ->orWhereHas('patient', function ($pq) use ($search) {
                        $pq->where('patient_code', 'like', "%{$search}%")
                            ->orWhere('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%");
                    });
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (Invoice $i) => $this->payload($i)),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    /** Active admissions that still need a fee invoice / plan. */
    public function needingInvoice(Request $request): JsonResponse
    {
        $search = trim((string) $request->get('search', $request->get('q', '')));

        $query = Admission::query()
            ->with(['patient', 'bed.room'])
            ->where('status', 'active')
            ->whereDoesntHave('invoices', fn ($q) => $q->where('status', '!=', 'void'))
            ->whereDoesntHave('feePlans', fn ($q) => $q->where('status', 'pending'))
            ->latest('admitted_at');

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('admission_code', 'like', "%{$search}%")
                    ->orWhereHas('patient', function ($pq) use ($search) {
                        $pq->where('patient_code', 'like', "%{$search}%")
                            ->orWhere('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%");
                    });
            });
        }

        $rows = $query->limit(100)->get();
        $packagesByDays = FeePackage::query()
            ->where('status', 'active')
            ->get()
            ->keyBy(fn (FeePackage $p) => (int) $p->program_days);

        return response()->json([
            'data' => $rows->map(function (Admission $a) use ($packagesByDays) {
                $days = (int) ($a->program_days ?: $a->patient?->plan_days ?: 30);
                $pkg = $packagesByDays->get($days);

                return [
                    'id' => $a->id,
                    'admission_code' => $a->admission_code,
                    'program_days' => $days,
                    'package_name' => $pkg?->name ?? $a->package_name ?? ($days.'-Day Program'),
                    'package_amount' => $pkg ? (float) $pkg->amount : null,
                    'fee_package_id' => $pkg?->id,
                    'admitted_at' => $a->admitted_at?->toDateTimeString(),
                    'max_installments' => FeePlan::maxInstallments($days),
                    'patient' => [
                        'id' => $a->patient?->id,
                        'patient_code' => $a->patient?->patient_code,
                        'full_name' => $a->patient?->full_name,
                        'plan_days' => $a->patient?->plan_days,
                    ],
                ];
            })->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'admission_id' => ['required', 'exists:admissions,id'],
            'fee_package_id' => ['nullable', 'exists:fee_packages,id'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'due_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'amount' => ['nullable', 'numeric', 'min:0'],
            'package_name' => ['nullable', 'string', 'max:150'],
            'program_days' => ['nullable', 'integer', 'in:30,60,90'],
        ]);

        $admission = Admission::query()->with('patient')->findOrFail($data['admission_id']);

        if ($admission->status !== 'active') {
            return response()->json(['message' => 'Invoice requires an active admission.'], 422);
        }

        if (FeePlan::query()->where('admission_id', $admission->id)->where('status', 'pending')->exists()) {
            return response()->json(['message' => 'A pending installment request exists. Wait for admin approval.'], 422);
        }

        if (Invoice::query()->where('admission_id', $admission->id)->where('status', '!=', 'void')->exists()) {
            return response()->json(['message' => 'An invoice already exists for this admission.'], 422);
        }

        $days = (int) ($admission->program_days ?: $admission->patient?->plan_days ?: 30);
        $package = null;
        if (! empty($data['fee_package_id'])) {
            $package = FeePackage::query()->findOrFail($data['fee_package_id']);
        } else {
            $package = FeePackage::query()
                ->where('status', 'active')
                ->where('program_days', $days)
                ->orderBy('id')
                ->first();
        }
        if ($package && $package->status !== 'active') {
            return response()->json(['message' => 'Fee package for this plan is inactive.'], 422);
        }

        $amount = (float) ($data['amount'] ?? $package?->amount ?? 0);
        if ($amount <= 0) {
            return response()->json(['message' => 'No fee package amount found for this patient plan.'], 422);
        }

        $discount = (float) ($data['discount'] ?? 0);
        if ($discount > $amount) {
            return response()->json(['message' => 'Discount cannot exceed amount.'], 422);
        }

        $total = round($amount - $discount, 2);

        $invoice = Invoice::query()->create([
            'invoice_code' => $this->nextCode(),
            'admission_id' => $admission->id,
            'patient_id' => $admission->patient_id,
            'fee_package_id' => $package?->id,
            'package_name' => $data['package_name']
                ?? $package?->name
                ?? ($admission->package_name ?: ($days.'-Day Program')),
            'program_days' => $data['program_days'] ?? $package?->program_days ?? $days,
            'amount' => $amount,
            'discount' => $discount,
            'total_amount' => $total,
            'installment_count' => 1,
            'installment_no' => 1,
            'paid_amount' => 0,
            'balance' => $total,
            'status' => 'unpaid',
            'issued_at' => now(),
            'due_date' => $data['due_date'] ?? now()->toDateString(),
            'notes' => $data['notes'] ?? null,
            'created_by' => $request->user()->id,
        ])->load(['patient', 'admission', 'feePackage']);

        return response()->json([
            'message' => 'Invoice created',
            'data' => $this->payload($invoice),
        ], 201);
    }

    public function show(Invoice $invoice): JsonResponse
    {
        $invoice->load(['patient', 'admission', 'feePackage', 'payments'])
            ->loadExists([
                'payments as has_pending_payment' => fn ($q) => $q->where('approval_status', 'pending'),
            ]);

        return response()->json(['data' => $this->payload($invoice, true)]);
    }

    private function payload(Invoice $invoice, bool $withPayments = false): array
    {
        [$collectionStatus, $collectionLabel] = $this->collectionStatus($invoice);

        $data = [
            'id' => $invoice->id,
            'invoice_code' => $invoice->invoice_code,
            'package_name' => $invoice->package_name,
            'program_days' => $invoice->program_days,
            'amount' => $invoice->amount,
            'discount' => $invoice->discount,
            'total_amount' => $invoice->total_amount,
            'installment_count' => (int) ($invoice->installment_count ?: 1),
            'installment_no' => (int) ($invoice->installment_no ?: 1),
            'fee_plan_id' => $invoice->fee_plan_id,
            'installment_amount' => round(
                (float) $invoice->total_amount / max(1, (int) ($invoice->installment_count ?: 1)),
                2
            ),
            'paid_amount' => $invoice->paid_amount,
            'balance' => $invoice->balance,
            'status' => $invoice->status === 'partial' ? 'unpaid' : $invoice->status,
            'status_label' => $this->statusLabel($invoice),
            'collection_status' => $collectionStatus,
            'collection_status_label' => $collectionLabel,
            'issued_at' => $invoice->issued_at?->toDateTimeString(),
            'due_date' => $invoice->due_date?->format('Y-m-d'),
            'notes' => $invoice->notes,
            'patient' => [
                'id' => $invoice->patient?->id,
                'patient_code' => $invoice->patient?->patient_code,
                'full_name' => $invoice->patient?->full_name,
            ],
            'admission' => [
                'id' => $invoice->admission?->id,
                'admission_code' => $invoice->admission?->admission_code,
                'status' => $invoice->admission?->status,
            ],
            'fee_package' => $invoice->feePackage ? [
                'id' => $invoice->feePackage->id,
                'name' => $invoice->feePackage->name,
            ] : null,
        ];

        if ($withPayments) {
            $data['payments'] = $invoice->payments->map(fn ($p) => [
                'id' => $p->id,
                'payment_code' => $p->payment_code,
                'amount' => $p->amount,
                'method' => $p->method,
                'approval_status' => $p->approval_status,
                'paid_at' => $p->paid_at?->toDateTimeString(),
                'reference' => $p->reference,
            ])->values();
        }

        return $data;
    }

    /** @return array{0: string, 1: string} */
    private function collectionStatus(Invoice $invoice): array
    {
        if ($invoice->status === 'paid' || (float) $invoice->balance <= 0) {
            return ['paid', 'Paid'];
        }
        if ($invoice->status === 'void') {
            return ['void', 'Void'];
        }
        if ((bool) ($invoice->has_pending_payment ?? false)) {
            return ['awaiting_approval', 'Awaiting approval'];
        }

        return ['due', 'Due'];
    }

    private function statusLabel(Invoice $invoice): string
    {
        if ($invoice->status === 'paid') {
            return 'Paid';
        }
        if ($invoice->status === 'void') {
            return 'Void';
        }
        if ((bool) ($invoice->has_pending_payment ?? false)) {
            return 'Awaiting approval';
        }
        if ((float) $invoice->paid_amount > 0 && (float) $invoice->balance > 0) {
            return 'Installments in progress';
        }

        return 'Due';
    }

    private function nextCode(): string
    {
        $year = now()->format('Y');
        $prefix = "INV-{$year}-";
        $latest = Invoice::query()
            ->where('invoice_code', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('invoice_code');

        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
