<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Payment;
use App\Support\Audit;
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
            ->with(['patient', 'invoice', 'creator'])
            ->latest('paid_at');

        if ($invoiceId = $request->integer('invoice_id')) {
            $query->where('invoice_id', $invoiceId);
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
            ],
        ]);
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
        ]);

        try {
            $payment = DB::transaction(function () use ($request, $data) {
                $invoice = Invoice::query()->lockForUpdate()->findOrFail($data['invoice_id']);

                if (in_array($invoice->status, ['paid', 'void'], true)) {
                    throw new \RuntimeException('Cannot record payment on a '.$invoice->status.' invoice.');
                }

                $amount = round((float) $data['amount'], 2);
                if ($amount > (float) $invoice->balance) {
                    throw new \RuntimeException('Payment exceeds invoice balance of '.$invoice->balance);
                }

                $payment = Payment::query()->create([
                    'payment_code' => $this->nextCode(),
                    'invoice_id' => $invoice->id,
                    'patient_id' => $invoice->patient_id,
                    'amount' => $amount,
                    'method' => $data['method'] ?? 'cash',
                    'paid_at' => $data['paid_at'] ?? now(),
                    'reference' => $data['reference'] ?? null,
                    'notes' => $data['notes'] ?? null,
                    'created_by' => $request->user()->id,
                ]);

                $paid = round((float) $invoice->paid_amount + $amount, 2);
                $balance = round((float) $invoice->total_amount - $paid, 2);
                $status = $balance <= 0 ? 'paid' : ($paid > 0 ? 'partial' : 'unpaid');

                $invoice->update([
                    'paid_amount' => $paid,
                    'balance' => max($balance, 0),
                    'status' => $status,
                ]);

                return $payment->load(['patient', 'invoice', 'creator']);
            });
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        Audit::log('payment.create', 'billing', 'payment', $payment->id, "Payment {$payment->payment_code}");

        return response()->json([
            'message' => 'Payment recorded',
            'data' => $this->payload($payment),
        ], 201);
    }

    private function payload(Payment $payment): array
    {
        return [
            'id' => $payment->id,
            'payment_code' => $payment->payment_code,
            'amount' => $payment->amount,
            'method' => $payment->method,
            'paid_at' => $payment->paid_at?->toDateTimeString(),
            'reference' => $payment->reference,
            'notes' => $payment->notes,
            'collected_by' => $payment->creator?->name,
            'patient' => [
                'id' => $payment->patient?->id,
                'patient_code' => $payment->patient?->patient_code,
                'full_name' => $payment->patient?->full_name,
            ],
            'invoice' => [
                'id' => $payment->invoice?->id,
                'invoice_code' => $payment->invoice?->invoice_code,
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
