<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Admission;
use App\Models\TreatmentPlan;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TreatmentPlanController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = TreatmentPlan::query()
            ->with(['patient', 'admission'])
            ->latest();

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('plan_code', 'like', "%{$search}%")
                    ->orWhereHas('patient', function ($pq) use ($search) {
                        $pq->where('patient_code', 'like', "%{$search}%")
                            ->orWhere('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%");
                    });
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (TreatmentPlan $p) => $this->payload($p)),
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
            'goals' => ['nullable', 'string'],
            'daily_activities' => ['nullable', 'string'],
            'progress_notes' => ['nullable', 'string'],
            'aftercare_plan' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['draft', 'active', 'completed', 'cancelled'])],
        ]);

        $admission = Admission::query()->with('patient')->findOrFail($data['admission_id']);

        if ($admission->status !== 'active') {
            return response()->json(['message' => 'Treatment plan requires an active admission.'], 422);
        }

        if (TreatmentPlan::query()->where('admission_id', $admission->id)->whereIn('status', ['draft', 'active'])->exists()) {
            return response()->json(['message' => 'An active treatment plan already exists for this admission.'], 422);
        }

        $start = $admission->admitted_at?->toDateString() ?? now()->toDateString();
        $end = $admission->program_days
            ? Carbon::parse($start)->addDays($admission->program_days)->toDateString()
            : null;

        $plan = TreatmentPlan::query()->create([
            'plan_code' => $this->nextCode(),
            'admission_id' => $admission->id,
            'patient_id' => $admission->patient_id,
            'program_days' => $admission->program_days ?? 30,
            'start_date' => $start,
            'end_date' => $end,
            'goals' => $data['goals'] ?? null,
            'daily_activities' => $data['daily_activities'] ?? null,
            'progress_notes' => $data['progress_notes'] ?? null,
            'aftercare_plan' => $data['aftercare_plan'] ?? null,
            'status' => $data['status'] ?? 'active',
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ])->load(['patient', 'admission']);

        return response()->json([
            'message' => 'Treatment plan created',
            'data' => $this->payload($plan),
        ], 201);
    }

    public function update(Request $request, TreatmentPlan $treatmentPlan): JsonResponse
    {
        $data = $request->validate([
            'goals' => ['nullable', 'string'],
            'daily_activities' => ['nullable', 'string'],
            'progress_notes' => ['nullable', 'string'],
            'aftercare_plan' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['draft', 'active', 'completed', 'cancelled'])],
        ]);

        $treatmentPlan->update([
            ...$data,
            'updated_by' => $request->user()->id,
        ]);

        $treatmentPlan->load(['patient', 'admission']);

        return response()->json([
            'message' => 'Treatment plan updated',
            'data' => $this->payload($treatmentPlan),
        ]);
    }

    public function show(TreatmentPlan $treatmentPlan): JsonResponse
    {
        $treatmentPlan->load(['patient', 'admission']);

        return response()->json(['data' => $this->payload($treatmentPlan)]);
    }

    private function payload(TreatmentPlan $plan): array
    {
        return [
            'id' => $plan->id,
            'plan_code' => $plan->plan_code,
            'status' => $plan->status,
            'program_days' => $plan->program_days,
            'start_date' => $plan->start_date?->format('Y-m-d'),
            'end_date' => $plan->end_date?->format('Y-m-d'),
            'goals' => $plan->goals,
            'daily_activities' => $plan->daily_activities,
            'progress_notes' => $plan->progress_notes,
            'aftercare_plan' => $plan->aftercare_plan,
            'patient' => [
                'id' => $plan->patient?->id,
                'patient_code' => $plan->patient?->patient_code,
                'full_name' => $plan->patient?->full_name,
            ],
            'admission' => [
                'id' => $plan->admission?->id,
                'admission_code' => $plan->admission?->admission_code,
                'status' => $plan->admission?->status,
            ],
        ];
    }

    private function nextCode(): string
    {
        $year = now()->format('Y');
        $prefix = "TP-{$year}-";
        $latest = TreatmentPlan::query()
            ->where('plan_code', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('plan_code');

        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
