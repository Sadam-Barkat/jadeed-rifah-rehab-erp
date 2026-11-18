<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Admission;
use App\Models\FeePackage;
use App\Models\FeePlan;
use App\Models\Invoice;
use App\Services\AppNotifier;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FeePlanController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);
        $query = FeePlan::query()
            ->with(['patient', 'admission', 'requester:id,name', 'reviewer:id,name'])
            ->latest('id');

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($search = trim((string) $request->get('search', $request->get('q', '')))) {
            $query->where(function ($q) use ($search) {
                $q->where('plan_code', 'like', "%{$search}%")
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
            'data' => collect($paginator->items())->map(fn (FeePlan $p) => $this->payload($p)),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'pending_count' => FeePlan::query()->where('status', 'pending')->count(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'admission_id' => ['required', 'exists:admissions,id'],
            'fee_package_id' => ['nullable', 'exists:fee_packages,id'],
            'amount' => ['nullable', 'numeric', 'min:0'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
            'installment_count' => ['required', 'integer', 'min:2', 'max:3'],
            'installment_amounts' => ['nullable', 'array'],
            'installment_amounts.*' => ['numeric', 'min:0.01'],
        ]);

        $admission = Admission::query()->with('patient')->findOrFail($data['admission_id']);
        if ($admission->status !== 'active') {
            return response()->json(['message' => 'Only active admissions can request installments.'], 422);
        }

        $programDays = (int) ($admission->program_days ?: 30);
        $max = FeePlan::maxInstallments($programDays);
        $count = (int) $data['installment_count'];

        if ($max < 2) {
            return response()->json(['message' => 'This plan only allows a single invoice (no installment request).'], 422);
        }
        if ($count < 2 || $count > $max) {
            return response()->json([
                'message' => "Installments must be between 2 and {$max} for a {$programDays}-day plan.",
            ], 422);
        }

        if (FeePlan::query()->where('admission_id', $admission->id)->where('status', 'pending')->exists()) {
            return response()->json(['message' => 'A pending installment request already exists for this admission.'], 422);
        }

        if (Invoice::query()->where('admission_id', $admission->id)->where('status', '!=', 'void')->exists()) {
            return response()->json(['message' => 'Invoices already exist for this admission.'], 422);
        }

        $package = null;
        if (! empty($data['fee_package_id'])) {
            $package = FeePackage::query()->findOrFail($data['fee_package_id']);
        } else {
            $package = FeePackage::query()
                ->where('status', 'active')
                ->where('program_days', $programDays)
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
        $amounts = $data['installment_amounts'] ?? null;
        if (is_array($amounts) && count($amounts) === $count) {
            $amounts = array_map(fn ($v) => round((float) $v, 2), $amounts);
            if (round(array_sum($amounts), 2) !== $total) {
                return response()->json(['message' => 'Installment amounts must sum to total PKR '.number_format($total, 2)], 422);
            }
        } else {
            $amounts = FeePlan::splitAmounts($total, $count);
        }

        $plan = FeePlan::query()->create([
            'plan_code' => $this->nextCode(),
            'admission_id' => $admission->id,
            'patient_id' => $admission->patient_id,
            'fee_package_id' => $package?->id,
            'package_name' => $package?->name ?? ($admission->package_name ?: ($programDays.'-Day Program')),
            'program_days' => $programDays,
            'amount' => $amount,
            'discount' => $discount,
            'total_amount' => $total,
            'installment_count' => $count,
            'installment_amounts' => $amounts,
            'status' => 'pending',
            'notes' => $data['notes'] ?? null,
            'requested_by' => $request->user()->id,
        ])->load(['patient', 'admission', 'requester:id,name']);

        Audit::log('fee_plan.request', 'billing', 'fee_plan', $plan->id, "Installment plan {$plan->plan_code}");

        app(AppNotifier::class)->notifyRoleSlugs(
            ['admin'],
            'fee_plan.pending',
            'Installment request',
            ($plan->patient?->full_name ?: 'Patient').' · '.$count.' parts · PKR '.number_format($total, 0),
            '/app/fee-plans/'.$plan->id,
            ['fee_plan_id' => $plan->id],
            $request->user()->id,
        );

        return response()->json([
            'message' => 'Installment request sent for admin approval',
            'data' => $this->payload($plan),
        ], 201);
    }

    public function show(FeePlan $feePlan): JsonResponse
    {
        $feePlan->load(['patient', 'admission', 'requester:id,name', 'reviewer:id,name', 'invoices']);

        return response()->json(['data' => $this->payload($feePlan)]);
    }

    public function approve(Request $request, FeePlan $feePlan): JsonResponse
    {
        if ($feePlan->status !== 'pending') {
            return response()->json(['message' => 'Only pending plans can be approved.'], 422);
        }

        $data = $request->validate([
            'discount' => ['nullable', 'numeric', 'min:0'],
            'installment_amounts' => ['nullable', 'array'],
            'installment_amounts.*' => ['numeric', 'min:0.01'],
        ]);

        try {
            $feePlan = DB::transaction(function () use ($request, $feePlan, $data) {
                $plan = FeePlan::query()->lockForUpdate()->findOrFail($feePlan->id);
                if ($plan->status !== 'pending') {
                    throw new \RuntimeException('Plan is no longer pending.');
                }

                if (Invoice::query()->where('admission_id', $plan->admission_id)->where('status', '!=', 'void')->exists()) {
                    throw new \RuntimeException('Invoices already exist for this admission.');
                }

                $amount = round((float) $plan->amount, 2);
                $discount = array_key_exists('discount', $data)
                    ? round((float) ($data['discount'] ?? 0), 2)
                    : round((float) $plan->discount, 2);
                if ($discount > $amount) {
                    throw new \RuntimeException('Discount cannot exceed package amount.');
                }
                $total = round($amount - $discount, 2);
                if ($total <= 0) {
                    throw new \RuntimeException('Total after discount must be greater than zero.');
                }

                $count = (int) $plan->installment_count;
                $amounts = $data['installment_amounts'] ?? null;
                if (is_array($amounts) && count($amounts) === $count) {
                    $amounts = array_map(fn ($v) => round((float) $v, 2), $amounts);
                    if (round(array_sum($amounts), 2) !== $total) {
                        throw new \RuntimeException(
                            'Installment amounts must sum to total PKR '.number_format($total, 2)
                        );
                    }
                } else {
                    $amounts = FeePlan::splitAmounts($total, $count);
                }

                for ($i = 0; $i < $count; $i++) {
                    $part = round((float) $amounts[$i], 2);
                    Invoice::query()->create([
                        'invoice_code' => $this->nextInvoiceCode(),
                        'admission_id' => $plan->admission_id,
                        'patient_id' => $plan->patient_id,
                        'fee_package_id' => $plan->fee_package_id,
                        'fee_plan_id' => $plan->id,
                        'package_name' => $plan->package_name.' ('.($i + 1).'/'.$count.')',
                        'program_days' => $plan->program_days,
                        'amount' => $part,
                        'discount' => 0,
                        'total_amount' => $part,
                        'installment_count' => 1,
                        'installment_no' => $i + 1,
                        'paid_amount' => 0,
                        'balance' => $part,
                        'status' => 'unpaid',
                        'issued_at' => now(),
                        'due_date' => now()->addMonths($i)->toDateString(),
                        'notes' => $plan->notes,
                        'created_by' => $plan->requested_by,
                    ]);
                }

                $plan->update([
                    'discount' => $discount,
                    'total_amount' => $total,
                    'installment_amounts' => $amounts,
                    'status' => 'approved',
                    'reviewed_by' => $request->user()->id,
                    'reviewed_at' => now(),
                    'rejection_reason' => null,
                ]);

                return $plan->load(['patient', 'admission', 'requester:id,name', 'reviewer:id,name', 'invoices']);
            });
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        Audit::log('fee_plan.approve', 'billing', 'fee_plan', $feePlan->id, "Approved {$feePlan->plan_code}");

        if ($feePlan->requested_by) {
            app(AppNotifier::class)->notifyUsers(
                [$feePlan->requested_by],
                'fee_plan.approved',
                'Plan approved',
                ($feePlan->patient?->full_name ?: 'Patient').' · '.$feePlan->installment_count.' invoices ready',
                '/app/fee-plans/'.$feePlan->id,
                ['fee_plan_id' => $feePlan->id],
                $request->user()->id,
            );
        }

        return response()->json([
            'message' => 'Plan approved — invoices created',
            'data' => $this->payload($feePlan),
        ]);
    }

    public function reject(Request $request, FeePlan $feePlan): JsonResponse
    {
        if ($feePlan->status !== 'pending') {
            return response()->json(['message' => 'Only pending plans can be rejected.'], 422);
        }

        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $feePlan->update([
            'status' => 'rejected',
            'rejection_reason' => $data['reason'] ?? null,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        Audit::log('fee_plan.reject', 'billing', 'fee_plan', $feePlan->id, "Rejected {$feePlan->plan_code}");

        if ($feePlan->requested_by) {
            app(AppNotifier::class)->notifyUsers(
                [$feePlan->requested_by],
                'fee_plan.rejected',
                'Plan rejected',
                $data['reason'] ?: (($feePlan->patient?->full_name ?: 'Patient').' · request rejected'),
                '/app/fee-plans/'.$feePlan->id,
                ['fee_plan_id' => $feePlan->id],
                $request->user()->id,
            );
        }

        return response()->json([
            'message' => 'Plan rejected',
            'data' => $this->payload($feePlan->fresh()->load(['patient', 'admission', 'requester:id,name', 'reviewer:id,name'])),
        ]);
    }

    private function payload(FeePlan $plan): array
    {
        return [
            'id' => $plan->id,
            'plan_code' => $plan->plan_code,
            'package_name' => $plan->package_name,
            'program_days' => $plan->program_days,
            'amount' => $plan->amount,
            'discount' => $plan->discount,
            'total_amount' => $plan->total_amount,
            'installment_count' => $plan->installment_count,
            'installment_amounts' => $plan->installment_amounts,
            'max_installments' => FeePlan::maxInstallments((int) $plan->program_days),
            'status' => $plan->status,
            'notes' => $plan->notes,
            'rejection_reason' => $plan->rejection_reason,
            'requested_by_name' => $plan->requester?->name,
            'reviewed_by_name' => $plan->reviewer?->name,
            'reviewed_at' => $plan->reviewed_at?->toDateTimeString(),
            'created_at' => optional($plan->created_at)->toDateTimeString(),
            'patient' => [
                'id' => $plan->patient?->id,
                'patient_code' => $plan->patient?->patient_code,
                'full_name' => $plan->patient?->full_name,
            ],
            'admission' => [
                'id' => $plan->admission?->id,
                'admission_code' => $plan->admission?->admission_code,
                'status' => $plan->admission?->status,
                'program_days' => $plan->admission?->program_days,
            ],
            'invoices' => $plan->relationLoaded('invoices')
                ? $plan->invoices->map(fn (Invoice $i) => [
                    'id' => $i->id,
                    'invoice_code' => $i->invoice_code,
                    'installment_no' => $i->installment_no,
                    'total_amount' => $i->total_amount,
                    'due_date' => $i->due_date?->format('Y-m-d'),
                    'status' => $i->status,
                ])->values()
                : [],
        ];
    }

    private function nextCode(): string
    {
        $year = now()->format('Y');
        $prefix = "FP-{$year}-";
        $latest = FeePlan::query()->where('plan_code', 'like', $prefix.'%')->orderByDesc('id')->value('plan_code');
        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }

    private function nextInvoiceCode(): string
    {
        $year = now()->format('Y');
        $prefix = "INV-{$year}-";
        $latest = Invoice::query()->where('invoice_code', 'like', $prefix.'%')->orderByDesc('id')->value('invoice_code');
        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
