<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Admission;
use App\Models\Discharge;
use App\Models\TreatmentPlan;
use App\Services\AppNotifier;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DischargeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = Discharge::query()
            ->with(['patient', 'admission.bed.room'])
            ->latest('discharged_at');

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('discharge_code', 'like', "%{$search}%")
                    ->orWhereHas('patient', function ($pq) use ($search) {
                        $pq->where('patient_code', 'like', "%{$search}%")
                            ->orWhere('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%");
                    });
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (Discharge $d) => $this->payload($d)),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    /** Doctor (or staff) requests discharge — Admin confirms later. */
    public function requestDischarge(Request $request): JsonResponse
    {
        $data = $request->validate([
            'admission_id' => ['required', 'exists:admissions,id'],
            'final_summary' => ['nullable', 'string'],
        ]);

        $admission = Admission::query()->with('patient')->findOrFail($data['admission_id']);

        if ($admission->status !== 'active') {
            return response()->json(['message' => 'Only active admissions can request discharge.'], 422);
        }

        if ($admission->patient?->status === 'discharge_requested') {
            return response()->json(['message' => 'Discharge already requested for this patient.'], 422);
        }

        $admission->patient?->update([
            'status' => 'discharge_requested',
            'updated_by' => $request->user()->id,
        ]);

        if (! empty($data['final_summary'])) {
            $admission->update([
                'clinical_notes' => trim(($admission->clinical_notes ? $admission->clinical_notes."\n" : '').'Discharge request: '.$data['final_summary']),
                'updated_by' => $request->user()->id,
            ]);
        }

        Audit::log('discharge.request', 'discharge', 'admission', $admission->id, "Discharge requested for {$admission->admission_code}");

        app(AppNotifier::class)->notifyRoleSlugs(
            ['admin'],
            'discharge.requested',
            'Discharge request · '.$admission->patient?->patient_code,
            ($admission->patient?->full_name ?: 'Patient').' — confirm discharge in Management.',
            '/app/management?tab=patients',
            ['patient_id' => $admission->patient_id, 'admission_id' => $admission->id],
            $request->user()->id,
        );

        return response()->json([
            'message' => 'Discharge requested. Waiting for admin confirmation.',
            'data' => [
                'admission_id' => $admission->id,
                'patient_status' => 'discharge_requested',
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'admission_id' => ['required', 'exists:admissions,id'],
            'discharged_at' => ['nullable', 'date'],
            'final_summary' => ['nullable', 'string'],
            'aftercare_instructions' => ['nullable', 'string'],
            'follow_up_date' => ['nullable', 'date'],
            'belongings_handover' => ['nullable', 'string'],
            'family_handover' => ['nullable', 'string'],
            'fee_clearance_notes' => ['nullable', 'string'],
        ]);

        $admission = Admission::query()->with(['patient', 'bed'])->findOrFail($data['admission_id']);

        if ($admission->status !== 'active') {
            return response()->json(['message' => 'Only active admissions can be discharged.'], 422);
        }

        if (Discharge::query()->where('admission_id', $admission->id)->exists()) {
            return response()->json(['message' => 'This admission is already discharged.'], 422);
        }

        $discharge = DB::transaction(function () use ($request, $data, $admission) {
            $discharge = Discharge::query()->create([
                'discharge_code' => $this->nextCode(),
                'admission_id' => $admission->id,
                'patient_id' => $admission->patient_id,
                'discharged_at' => $data['discharged_at'] ?? now(),
                'final_summary' => $data['final_summary'] ?? null,
                'aftercare_instructions' => $data['aftercare_instructions'] ?? null,
                'follow_up_date' => $data['follow_up_date'] ?? null,
                'belongings_handover' => $data['belongings_handover'] ?? null,
                'family_handover' => $data['family_handover'] ?? null,
                'fee_clearance_notes' => $data['fee_clearance_notes'] ?? null,
                'status' => 'completed',
                'created_by' => $request->user()->id,
            ]);

            $admission->update([
                'status' => 'discharged',
                'updated_by' => $request->user()->id,
            ]);

            if ($admission->bed) {
                $admission->bed->update(['status' => 'cleaning']);
            }

            $admission->patient?->update([
                'status' => 'discharged',
                'updated_by' => $request->user()->id,
            ]);

            TreatmentPlan::query()
                ->where('admission_id', $admission->id)
                ->whereIn('status', ['draft', 'active'])
                ->update([
                    'status' => 'completed',
                    'updated_by' => $request->user()->id,
                ]);

            return $discharge->load(['patient', 'admission.bed.room']);
        });

        Audit::log('discharge.create', 'discharge', 'discharge', $discharge->id, "Discharge {$discharge->discharge_code}");

        return response()->json([
            'message' => 'Patient discharged successfully',
            'data' => $this->payload($discharge),
        ], 201);
    }

    public function show(Discharge $discharge): JsonResponse
    {
        $discharge->load(['patient', 'admission.bed.room']);

        return response()->json(['data' => $this->payload($discharge)]);
    }

    private function payload(Discharge $discharge): array
    {
        return [
            'id' => $discharge->id,
            'discharge_code' => $discharge->discharge_code,
            'status' => $discharge->status,
            'discharged_at' => $discharge->discharged_at?->toDateTimeString(),
            'final_summary' => $discharge->final_summary,
            'aftercare_instructions' => $discharge->aftercare_instructions,
            'follow_up_date' => $discharge->follow_up_date?->format('Y-m-d'),
            'belongings_handover' => $discharge->belongings_handover,
            'family_handover' => $discharge->family_handover,
            'fee_clearance_notes' => $discharge->fee_clearance_notes,
            'patient' => [
                'id' => $discharge->patient?->id,
                'patient_code' => $discharge->patient?->patient_code,
                'full_name' => $discharge->patient?->full_name,
                'status' => $discharge->patient?->status,
            ],
            'admission' => [
                'id' => $discharge->admission?->id,
                'admission_code' => $discharge->admission?->admission_code,
                'bed_code' => $discharge->admission?->bed?->bed_code,
                'room_name' => $discharge->admission?->bed?->room?->name,
            ],
        ];
    }

    private function nextCode(): string
    {
        $year = now()->format('Y');
        $prefix = "DIS-{$year}-";
        $latest = Discharge::query()
            ->where('discharge_code', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('discharge_code');

        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
