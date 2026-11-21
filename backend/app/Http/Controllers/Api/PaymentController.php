<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Payment;
use App\Services\AppNotifier;
use App\Support\Audit;
use App\Support\SecureUpload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PaymentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = Payment::query()
            ->with(['patient', 'invoice', 'creator', 'approver'])
            ->latest('id');

        if ($invoiceId = $request->integer('invoice_id')) {
            $query->where('invoice_id', $invoiceId);
        }

        if ($status = $request->get('approval_status')) {
            $query->where('approval_status', $status);
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('payment_code', 'like', "%{$search}%")
                    ->orWhere('reference', 'like', "%{$search}%")
                    ->orWhereHas('patient', function ($pq) use ($search) {
                        $pq->where('patient_code', 'like', "%{$search}%")
                            ->orWhere('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%");
                    });
            });
        }

        $paginator = $query->paginate($perPage);

        $items = collect($paginator->items());
        $admissionIds = $items->map(fn (Payment $p) => $p->invoice?->admission_id)->filter()->unique()->values();
        $progressByAdmission = [];
        if ($admissionIds->isNotEmpty()) {
            $siblingInvoices = Invoice::query()
                ->whereIn('admission_id', $admissionIds)
                ->where('status', '!=', 'void')
                ->withExists([
                    'payments as has_pending_payment' => fn ($q) => $q->where('approval_status', 'pending'),
                ])
                ->get(['id', 'admission_id', 'status', 'balance', 'installment_no']);

            foreach ($siblingInvoices->groupBy('admission_id') as $admissionId => $rows) {
                $paid = 0;
                $due = 0;
                $awaiting = 0;
                foreach ($rows as $inv) {
                    if ($inv->status === 'paid' || (float) $inv->balance <= 0) {
                        $paid++;
                    } elseif ((bool) ($inv->has_pending_payment ?? false)) {
                        $awaiting++;
                    } else {
                        $due++;
                    }
                }
                $progressByAdmission[(int) $admissionId] = [
                    'total_invoices' => $rows->count(),
                    'paid_count' => $paid,
                    'due_count' => $due,
                    'awaiting_count' => $awaiting,
                ];
            }
        }

        return response()->json([
            'data' => $items->map(function (Payment $p) use ($progressByAdmission) {
                $payload = $this->payload($p);
                $admissionId = (int) ($p->invoice?->admission_id ?: 0);
                $payload['progress'] = $progressByAdmission[$admissionId] ?? [
                    'total_invoices' => 1,
                    'paid_count' => 0,
                    'due_count' => 1,
                    'awaiting_count' => 0,
                ];

                return $payload;
            })->values(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'pending_count' => Payment::query()->where('approval_status', 'pending')->count(),
            ],
        ]);
    }

    public function show(Payment $payment): JsonResponse
    {
        $payment->load(['patient', 'invoice', 'creator', 'approver']);

        return response()->json(['data' => $this->payload($payment, true)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'invoice_id' => ['nullable', 'exists:invoices,id'],
            'invoice_ids' => ['nullable', 'array', 'min:1'],
            'invoice_ids.*' => ['integer', 'exists:invoices,id'],
            'method' => ['nullable', Rule::in(['cash', 'card', 'online', 'bank', 'jazzcash', 'easypaisa', 'other'])],
            'paid_at' => ['nullable', 'date'],
            'reference' => ['nullable', 'string', 'max:150'],
            'notes' => ['nullable', 'string'],
            'proof_image' => SecureUpload::imageRules(true),
        ], array_merge(SecureUpload::maxMessages([
            'proof_image' => 'Payment proof',
        ]), [
            'proof_image.mimes' => 'Payment proof must be a JPG, PNG, or WEBP image.',
            'proof_image.required' => 'Payment proof image is required.',
        ]));

        $invoiceIds = collect($data['invoice_ids'] ?? [])
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->unique()
            ->values();
        if ($invoiceIds->isEmpty() && ! empty($data['invoice_id'])) {
            $invoiceIds = collect([(int) $data['invoice_id']]);
        }
        if ($invoiceIds->isEmpty()) {
            return response()->json(['message' => 'Select at least one invoice.'], 422);
        }

        $proofPath = SecureUpload::storeImage($request->file('proof_image'), 'payment-proofs', 'pay_');

        try {
            $payments = DB::transaction(function () use ($request, $data, $proofPath, $invoiceIds) {
                $created = [];
                $patientId = null;
                $admissionId = null;

                foreach ($invoiceIds as $invoiceId) {
                    $invoice = Invoice::query()->lockForUpdate()->findOrFail($invoiceId);

                    if (in_array($invoice->status, ['paid', 'void'], true)) {
                        throw new \RuntimeException('Cannot record payment on a '.$invoice->status.' invoice ('.$invoice->invoice_code.').');
                    }

                    if ($patientId === null) {
                        $patientId = (int) $invoice->patient_id;
                        $admissionId = (int) $invoice->admission_id;
                    } elseif ((int) $invoice->patient_id !== $patientId || (int) $invoice->admission_id !== $admissionId) {
                        throw new \RuntimeException('All selected invoices must belong to the same patient.');
                    }

                    $pendingSum = (float) Payment::query()
                        ->where('invoice_id', $invoice->id)
                        ->where('approval_status', 'pending')
                        ->sum('amount');
                    $available = round((float) $invoice->balance - $pendingSum, 2);
                    if ($available <= 0) {
                        throw new \RuntimeException(
                            'No remaining balance for '.$invoice->invoice_code.'.'
                        );
                    }

                    $installmentNo = $invoice->installment_no
                        ?? ((int) Payment::query()
                            ->where('invoice_id', $invoice->id)
                            ->whereIn('approval_status', ['pending', 'approved'])
                            ->count() + 1);

                    $created[] = Payment::query()->create([
                        'payment_code' => $this->nextCode(),
                        'invoice_id' => $invoice->id,
                        'patient_id' => $invoice->patient_id,
                        'amount' => $available,
                        'installment_no' => $installmentNo,
                        'method' => $data['method'] ?? 'cash',
                        'paid_at' => $data['paid_at'] ?? now(),
                        'reference' => $data['reference'] ?? null,
                        'notes' => $data['notes'] ?? null,
                        'proof_image_path' => $proofPath,
                        'approval_status' => 'pending',
                        'created_by' => $request->user()->id,
                    ])->load(['patient', 'invoice', 'creator', 'approver']);
                }

                return collect($created);
            });
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $first = $payments->first();
        $totalAmount = round((float) $payments->sum('amount'), 2);
        $count = $payments->count();

        Audit::log(
            'payment.request',
            'billing',
            'payment',
            $first->id,
            $count > 1
                ? "Payment batch ({$count}) for {$first->payment_code}"
                : "Payment request {$first->payment_code}"
        );

        $patientLabel = $first->patient?->full_name ?: 'Patient';
        $body = $count > 1
            ? trim($patientLabel).' · '.$count.' invoices · PKR '.number_format($totalAmount, 0)
            : trim($patientLabel).' · PKR '.number_format($totalAmount, 0).' · '.$first->method;

        app(AppNotifier::class)->notifyRoleSlugs(
            ['admin'],
            'payment.pending',
            'Payment approval',
            $body,
            '/app/payments/'.$first->id,
            [
                'payment_id' => $first->id,
                'payment_ids' => $payments->pluck('id')->values()->all(),
                'patient_id' => $first->patient_id,
                'amount' => $totalAmount,
            ],
            $request->user()->id,
        );

        return response()->json([
            'message' => $count > 1
                ? "{$count} payment requests sent for admin approval"
                : 'Payment request sent for admin approval',
            'data' => $this->payload($first),
            'data_list' => $payments->map(fn (Payment $p) => $this->payload($p))->values(),
        ], 201);
    }

    public function approve(Request $request, Payment $payment): JsonResponse
    {
        if ($payment->approval_status !== 'pending') {
            return response()->json(['message' => 'Only pending payments can be approved.'], 422);
        }

        try {
            $payment = DB::transaction(function () use ($request, $payment) {
                $locked = Payment::query()->lockForUpdate()->findOrFail($payment->id);
                $invoice = Invoice::query()->lockForUpdate()->findOrFail($locked->invoice_id);

                if (in_array($invoice->status, ['paid', 'void'], true)) {
                    throw new \RuntimeException('Invoice is already '.$invoice->status.'.');
                }

                $amount = round((float) $locked->amount, 2);
                if ($amount > (float) $invoice->balance) {
                    throw new \RuntimeException('Payment exceeds current invoice balance.');
                }

                $paid = round((float) $invoice->paid_amount + $amount, 2);
                $balance = round((float) $invoice->total_amount - $paid, 2);
                // Installments: remain unpaid until fully cleared (no partial status).
                $status = $balance <= 0 ? 'paid' : 'unpaid';

                $invoice->update([
                    'paid_amount' => $paid,
                    'balance' => max($balance, 0),
                    'status' => $status,
                ]);

                $locked->update([
                    'approval_status' => 'approved',
                    'approved_by' => $request->user()->id,
                    'approved_at' => now(),
                    'rejection_reason' => null,
                ]);

                return $locked->load(['patient', 'invoice', 'creator', 'approver']);
            });
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        Audit::log('payment.approve', 'billing', 'payment', $payment->id, "Approved {$payment->payment_code}");

        if ($payment->created_by) {
            app(AppNotifier::class)->notifyUsers(
                [$payment->created_by],
                'payment.approved',
                'Payment approved',
                'PKR '.number_format((float) $payment->amount, 0).' · '.$payment->invoice?->invoice_code,
                '/app/billing?tab=fees&fees=cleared',
                ['payment_id' => $payment->id],
                $request->user()->id,
            );
        }

        return response()->json([
            'message' => 'Payment approved — fee updated',
            'data' => $this->payload($payment),
        ]);
    }

    public function reject(Request $request, Payment $payment): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        if ($payment->approval_status !== 'pending') {
            return response()->json(['message' => 'Only pending payments can be rejected.'], 422);
        }

        $payment->update([
            'approval_status' => 'rejected',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
            'rejection_reason' => $data['reason'] ?? null,
        ]);

        Audit::log('payment.reject', 'billing', 'payment', $payment->id, "Rejected {$payment->payment_code}");

        if ($payment->created_by) {
            app(AppNotifier::class)->notifyUsers(
                [$payment->created_by],
                'payment.rejected',
                'Payment rejected',
                $data['reason'] ?: ('PKR '.number_format((float) $payment->amount, 0).' · rejected'),
                '/app/billing?tab=fees&fees=pending',
                ['payment_id' => $payment->id],
                $request->user()->id,
            );
        }

        return response()->json([
            'message' => 'Payment request rejected',
            'data' => $this->payload($payment->fresh()->load(['patient', 'invoice', 'creator', 'approver'])),
        ]);
    }

    private function payload(Payment $payment, bool $withProgress = false): array
    {
        $data = [
            'id' => $payment->id,
            'payment_code' => $payment->payment_code,
            'amount' => $payment->amount,
            'installment_no' => $payment->installment_no,
            'method' => $payment->method,
            'paid_at' => $payment->paid_at?->toDateTimeString(),
            'reference' => $payment->reference,
            'notes' => $payment->notes,
            'approval_status' => $payment->approval_status,
            'rejection_reason' => $payment->rejection_reason,
            'approved_at' => $payment->approved_at?->toDateTimeString(),
            'approved_by_name' => $payment->approver?->name,
            'proof_image_url' => SecureUpload::url($payment->proof_image_path),
            'collected_by' => $payment->creator?->name,
            'collected_by_id' => $payment->created_by,
            'patient' => [
                'id' => $payment->patient?->id,
                'patient_code' => $payment->patient?->patient_code,
                'full_name' => $payment->patient?->full_name,
                'phone' => $payment->patient?->phone,
            ],
            'invoice' => [
                'id' => $payment->invoice?->id,
                'invoice_code' => $payment->invoice?->invoice_code,
                'package_name' => $payment->invoice?->package_name,
                'status' => $payment->invoice?->status,
                'balance' => $payment->invoice?->balance,
                'paid_amount' => $payment->invoice?->paid_amount,
                'total_amount' => $payment->invoice?->total_amount,
                'installment_no' => $payment->invoice?->installment_no,
                'admission_id' => $payment->invoice?->admission_id,
            ],
        ];

        if ($withProgress && $payment->invoice?->admission_id) {
            $siblings = Invoice::query()
                ->where('admission_id', $payment->invoice->admission_id)
                ->where('status', '!=', 'void')
                ->withExists([
                    'payments as has_pending_payment' => fn ($q) => $q->where('approval_status', 'pending'),
                ])
                ->orderBy('installment_no')
                ->orderBy('id')
                ->get(['id', 'invoice_code', 'installment_no', 'total_amount', 'paid_amount', 'balance', 'status']);

            $data['invoice_progress'] = $siblings->map(function (Invoice $inv) {
                $status = 'due';
                $label = 'Due';
                if ($inv->status === 'paid' || (float) $inv->balance <= 0) {
                    $status = 'paid';
                    $label = 'Paid';
                } elseif ((bool) ($inv->has_pending_payment ?? false)) {
                    $status = 'awaiting_approval';
                    $label = 'Awaiting approval';
                }

                return [
                    'id' => $inv->id,
                    'invoice_code' => $inv->invoice_code,
                    'installment_no' => (int) ($inv->installment_no ?: 1),
                    'total_amount' => $inv->total_amount,
                    'balance' => $inv->balance,
                    'collection_status' => $status,
                    'collection_status_label' => $label,
                ];
            })->values();
        }

        if ($withProgress && $payment->proof_image_path) {
            $batch = Payment::query()
                ->with('invoice:id,invoice_code,installment_no')
                ->where('proof_image_path', $payment->proof_image_path)
                ->where('patient_id', $payment->patient_id)
                ->orderBy('id')
                ->get();

            if ($batch->count() > 1) {
                $data['batch_payments'] = $batch->map(fn (Payment $p) => [
                    'id' => $p->id,
                    'payment_code' => $p->payment_code,
                    'amount' => $p->amount,
                    'approval_status' => $p->approval_status,
                    'invoice_code' => $p->invoice?->invoice_code,
                    'installment_no' => $p->installment_no ?: $p->invoice?->installment_no,
                ])->values();
            }
        }

        return $data;
    }

    private function nextCode(): string
    {
        $year = now()->format('Y');
        $prefix = "PAY-{$year}-";

        // Use max numeric suffix (ignore seed codes like PAY-2026-X001).
        $max = 0;
        $codes = Payment::query()
            ->where('payment_code', 'like', $prefix.'%')
            ->pluck('payment_code');

        foreach ($codes as $code) {
            if (preg_match('/^PAY-\d+-(\d+)$/', (string) $code, $m)) {
                $max = max($max, (int) $m[1]);
            }
        }

        return $prefix.str_pad((string) ($max + 1), 4, '0', STR_PAD_LEFT);
    }
}
