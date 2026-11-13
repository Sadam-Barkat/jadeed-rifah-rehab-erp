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

        return response()->json([
            'data' => collect($paginator->items())->map(fn (Payment $p) => $this->payload($p)),
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

        return response()->json(['data' => $this->payload($payment)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'invoice_id' => ['required', 'exists:invoices,id'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'method' => ['nullable', Rule::in(['cash', 'card', 'online', 'bank', 'jazzcash', 'easypaisa', 'other'])],
            'paid_at' => ['nullable', 'date'],
            'reference' => ['nullable', 'string', 'max:150'],
            'notes' => ['nullable', 'string'],
            'installment_no' => ['nullable', 'integer', 'min:1', 'max:60'],
            'proof_image' => ['required', 'file', 'max:5120', 'mimes:jpg,jpeg,png,webp'],
        ]);

        $proofPath = SecureUpload::storeImage($request->file('proof_image'), 'payment-proofs', 'pay_');

        try {
            $payment = DB::transaction(function () use ($request, $data, $proofPath) {
                $invoice = Invoice::query()->lockForUpdate()->findOrFail($data['invoice_id']);

                if (in_array($invoice->status, ['paid', 'void'], true)) {
                    throw new \RuntimeException('Cannot record payment on a '.$invoice->status.' invoice.');
                }

                $amount = round((float) $data['amount'], 2);
                $pendingSum = (float) Payment::query()
                    ->where('invoice_id', $invoice->id)
                    ->where('approval_status', 'pending')
                    ->sum('amount');
                $available = round((float) $invoice->balance - $pendingSum, 2);

                if ($amount > $available) {
                    throw new \RuntimeException(
                        'Amount exceeds available balance (including pending requests): '.number_format($available, 2)
                    );
                }

                $installmentNo = $data['installment_no'] ?? null;
                if (! $installmentNo) {
                    $installmentNo = (int) Payment::query()
                        ->where('invoice_id', $invoice->id)
                        ->whereIn('approval_status', ['pending', 'approved'])
                        ->count() + 1;
                }

                // Pending request only — invoice paid amount updates after admin approve.
                return Payment::query()->create([
                    'payment_code' => $this->nextCode(),
                    'invoice_id' => $invoice->id,
                    'patient_id' => $invoice->patient_id,
                    'amount' => $amount,
                    'installment_no' => $installmentNo,
                    'method' => $data['method'] ?? 'cash',
                    'paid_at' => $data['paid_at'] ?? now(),
                    'reference' => $data['reference'] ?? null,
                    'notes' => $data['notes'] ?? null,
                    'proof_image_path' => $proofPath,
                    'approval_status' => 'pending',
                    'created_by' => $request->user()->id,
                ])->load(['patient', 'invoice', 'creator', 'approver']);
            });
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        Audit::log('payment.request', 'billing', 'payment', $payment->id, "Payment request {$payment->payment_code}");

        $patientLabel = $payment->patient?->full_name ?: 'Patient';
        $code = $payment->patient?->patient_code ?: '';

        app(AppNotifier::class)->notifyRoleSlugs(
            ['admin'],
            'payment.pending',
            'Fee approval · '.$payment->payment_code,
            trim($code.' '.$patientLabel).' · PKR '.number_format((float) $payment->amount, 0).' · '.$payment->method
                .' · installment #'.$payment->installment_no,
            '/app/payments/'.$payment->id,
            [
                'payment_id' => $payment->id,
                'patient_id' => $payment->patient_id,
                'amount' => $payment->amount,
            ],
            $request->user()->id,
        );

        return response()->json([
            'message' => 'Payment request sent for admin approval',
            'data' => $this->payload($payment),
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
                $status = $balance <= 0 ? 'paid' : ($paid > 0 ? 'partial' : 'unpaid');

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
                'Payment approved · '.$payment->payment_code,
                'PKR '.number_format((float) $payment->amount, 0).' marked paid on invoice '.$payment->invoice?->invoice_code,
                '/app/billing',
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
                'Payment rejected · '.$payment->payment_code,
                $data['reason'] ?: 'Admin rejected this fee request.',
                '/app/billing',
                ['payment_id' => $payment->id],
                $request->user()->id,
            );
        }

        return response()->json([
            'message' => 'Payment request rejected',
            'data' => $this->payload($payment->fresh()->load(['patient', 'invoice', 'creator', 'approver'])),
        ]);
    }

    private function payload(Payment $payment): array
    {
        return [
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
            ],
        ];
    }

    private function nextCode(): string
    {
        $year = now()->format('Y');
        $prefix = "PAY-{$year}-";
        $latest = Payment::query()
            ->where('payment_code', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('payment_code');

        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
