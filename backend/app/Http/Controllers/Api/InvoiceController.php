<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Admission;
use App\Models\FeePackage;
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
            ->latest('issued_at');

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($request->boolean('due_only')) {
            $query->where('balance', '>', 0)
                ->whereIn('status', ['unpaid', 'partial']);
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

        if (! in_array($admission->status, ['active', 'discharged'], true)) {
            return response()->json(['message' => 'Invoice requires an active or discharged admission.'], 422);
        }

        if (Invoice::query()->where('admission_id', $admission->id)->where('status', '!=', 'void')->exists()) {
            return response()->json(['message' => 'An invoice already exists for this admission.'], 422);
        }

        $package = null;
        if (! empty($data['fee_package_id'])) {
            $package = FeePackage::query()->findOrFail($data['fee_package_id']);
            if ($package->status !== 'active') {
                return response()->json(['message' => 'Selected fee package is inactive.'], 422);
            }
        }

        $amount = (float) ($data['amount'] ?? $package?->amount ?? 0);
        if ($amount <= 0) {
            return response()->json(['message' => 'Invoice amount is required.'], 422);
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
                ?? ($admission->package_name ?: ($admission->program_days.'-Day Program')),
            'program_days' => $data['program_days'] ?? $package?->program_days ?? $admission->program_days,
            'amount' => $amount,
            'discount' => $discount,
            'total_amount' => $total,
            'paid_amount' => 0,
            'balance' => $total,
            'status' => 'unpaid',
            'issued_at' => now(),
            'due_date' => $data['due_date'] ?? null,
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
        $invoice->load(['patient', 'admission', 'feePackage', 'payments']);

        return response()->json(['data' => $this->payload($invoice, true)]);
    }

    private function payload(Invoice $invoice, bool $withPayments = false): array
    {
        $data = [
            'id' => $invoice->id,
            'invoice_code' => $invoice->invoice_code,
            'package_name' => $invoice->package_name,
            'program_days' => $invoice->program_days,
            'amount' => $invoice->amount,
            'discount' => $invoice->discount,
            'total_amount' => $invoice->total_amount,
            'paid_amount' => $invoice->paid_amount,
            'balance' => $invoice->balance,
            'status' => $invoice->status,
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
                'paid_at' => $p->paid_at?->toDateTimeString(),
                'reference' => $p->reference,
            ])->values();
        }

        return $data;
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
