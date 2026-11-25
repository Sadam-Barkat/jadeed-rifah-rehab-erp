<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Admission;
use App\Models\NursingNote;
use App\Models\User;
use App\Services\AppNotifier;
use App\Support\ClinicalDoctor;
use App\Support\VitalCondition;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class NursingNoteController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 100);

        $query = NursingNote::query()
            ->with(['patient', 'admission', 'creator'])
            ->latest('recorded_at')
            ->latest('id');

        if ($shift = $request->get('shift')) {
            $query->where('shift', $shift);
        }

        if ($admissionId = $request->integer('admission_id')) {
            $query->where('admission_id', $admissionId);
        }

        if ($createdBy = $request->integer('created_by')) {
            $query->where('created_by', $createdBy);
        }

        if ($date = trim((string) $request->get('date', ''))) {
            $query->whereDate('recorded_at', $date);
        } else {
            if ($year = $request->integer('year')) {
                $query->whereYear('recorded_at', $year);
            }
            if ($month = $request->integer('month')) {
                $query->whereMonth('recorded_at', $month);
            }
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('note_code', 'like', "%{$search}%")
                    ->orWhere('observations', 'like', "%{$search}%")
                    ->orWhere('interventions', 'like', "%{$search}%")
                    ->orWhereHas('patient', function ($pq) use ($search) {
                        $pq->where('patient_code', 'like', "%{$search}%")
                            ->orWhere('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%");
                    })
                    ->orWhereHas('creator', function ($cq) use ($search) {
                        $cq->where('name', 'like', "%{$search}%");
                    });
            });
        }

        $availableYears = NursingNote::query()
            ->selectRaw('YEAR(recorded_at) as y')
            ->whereNotNull('recorded_at')
            ->distinct()
            ->orderByDesc('y')
            ->pluck('y')
            ->filter()
            ->map(fn ($y) => (int) $y)
            ->values()
            ->all();

        $nurses = User::query()
            ->where('is_active', true)
            ->whereHas('role', fn ($q) => $q->where('slug', 'nurse'))
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name])
            ->values()
            ->all();

        // Doctor board: latest vitals per patient + condition counts.
        if ($request->boolean('board')) {
            $latest = (clone $query)
                ->limit(400)
                ->get()
                ->unique(fn (NursingNote $n) => (int) $n->patient_id)
                ->values();

            $conditionCounts = [
                'emergency' => 0,
                'serious' => 0,
                'watch' => 0,
                'normal' => 0,
            ];
            foreach ($latest as $note) {
                $level = $this->resolvedConditionLevel($note);
                if (isset($conditionCounts[$level])) {
                    $conditionCounts[$level]++;
                }
            }

            $condition = trim((string) $request->get('condition', ''));
            if ($condition !== '') {
                $latest = $latest
                    ->filter(fn (NursingNote $n) => $this->resolvedConditionLevel($n) === $condition)
                    ->values();
            }

            return response()->json([
                'data' => $latest->map(fn (NursingNote $n) => $this->payload($n))->values()->all(),
                'meta' => [
                    'current_page' => 1,
                    'last_page' => 1,
                    'per_page' => $latest->count(),
                    'total' => $latest->count(),
                    'available_years' => $availableYears,
                    'nurses' => $nurses,
                    'condition_counts' => $conditionCounts,
                    'board' => true,
                ],
            ]);
        }

        if ($condition = $request->get('condition')) {
            $query->where('condition', $condition);
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (NursingNote $n) => $this->payload($n)),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'available_years' => $availableYears,
                'nurses' => $nurses,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'admission_id' => ['required', 'exists:admissions,id'],
            'recorded_at' => ['nullable', 'date'],
            'shift' => ['nullable', Rule::in(['morning', 'evening', 'night'])],
            'temperature' => ['nullable', 'numeric', 'between:30,45'],
            'pulse' => ['nullable', 'integer', 'between:20,250'],
            'bp_systolic' => ['nullable', 'integer', 'between:50,250'],
            'bp_diastolic' => ['nullable', 'integer', 'between:30,150'],
            'spo2' => ['nullable', 'integer', 'between:50,100'],
            'respiratory_rate' => ['nullable', 'integer', 'between:5,60'],
            'weight_kg' => ['nullable', 'numeric', 'between:10,300'],
            'blood_sugar_mg_dl' => ['nullable', 'integer', 'between:20,600'],
            'pain_score' => ['nullable', 'integer', 'between:0,10'],
            'mood' => ['nullable', 'string', 'max:100'],
            'sleep_quality' => ['nullable', 'string', 'max:100'],
            'appetite' => ['nullable', 'string', 'max:100'],
            'observations' => ['nullable', 'string'],
            'interventions' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['recorded', 'flagged'])],
        ]);

        $admission = Admission::query()->with('patient')->findOrFail($data['admission_id']);

        if ($admission->status !== 'active') {
            return response()->json(['message' => 'Nursing notes require an active admission.'], 422);
        }

        $note = NursingNote::query()->create([
            'note_code' => $this->nextCode(),
            'admission_id' => $admission->id,
            'patient_id' => $admission->patient_id,
            'recorded_at' => $data['recorded_at'] ?? now(),
            'shift' => $data['shift'] ?? 'morning',
            'temperature' => $data['temperature'] ?? null,
            'pulse' => $data['pulse'] ?? null,
            'bp_systolic' => $data['bp_systolic'] ?? null,
            'bp_diastolic' => $data['bp_diastolic'] ?? null,
            'spo2' => $data['spo2'] ?? null,
            'respiratory_rate' => $data['respiratory_rate'] ?? null,
            'weight_kg' => $data['weight_kg'] ?? null,
            'blood_sugar_mg_dl' => $data['blood_sugar_mg_dl'] ?? null,
            'pain_score' => $data['pain_score'] ?? null,
            'mood' => $data['mood'] ?? null,
            'sleep_quality' => $data['sleep_quality'] ?? null,
            'appetite' => $data['appetite'] ?? null,
            'observations' => $data['observations'] ?? null,
            'interventions' => $data['interventions'] ?? null,
            'status' => $data['status'] ?? 'recorded',
            'created_by' => $request->user()->id,
        ]);

        $condition = VitalCondition::assess($note->only([
            'temperature',
            'pulse',
            'respiratory_rate',
            'spo2',
            'bp_systolic',
            'bp_diastolic',
            'blood_sugar_mg_dl',
            'pain_score',
        ]));
        $note->condition = $condition['level'];
        $note->save();
        $note->load(['patient', 'admission', 'creator']);

        // Rehab clinical doctors (psychiatrist + MO) share the same vitals board.
        // Alert only on Emergency / Critical so daily normals stay quiet.
        if (in_array($condition['level'], ['emergency', 'serious'], true)) {
            $patientName = $note->patient?->full_name ?: 'Patient';
            $reason = $condition['reasons'] ? ' · '.implode(' · ', $condition['reasons']) : '';
            $titles = [
                'emergency' => 'Emergency vitals',
                'serious' => 'Critical vitals',
            ];
            app(AppNotifier::class)->notifyRoleSlugs(
                ClinicalDoctor::roleSlugs(),
                'nursing.vitals_alert',
                $titles[$condition['level']] ?? 'Vitals alert',
                "{$patientName} · {$condition['label']}{$reason}",
                '/app/doctors?tab=vitals&condition='.$condition['level'].'&note='.$note->id,
                [
                    'nursing_note_id' => $note->id,
                    'patient_id' => $note->patient_id,
                    'condition' => $condition['level'],
                ],
                $request->user()->id,
            );
        }

        return response()->json([
            'message' => 'Nursing note recorded',
            'data' => $this->payload($note),
        ], 201);
    }

    public function show(NursingNote $nursingNote): JsonResponse
    {
        $nursingNote->load(['patient', 'admission', 'creator']);

        return response()->json(['data' => $this->payload($nursingNote)]);
    }

    private function assessVitals(NursingNote $note): array
    {
        return VitalCondition::assess([
            'temperature' => $note->temperature,
            'pulse' => $note->pulse,
            'respiratory_rate' => $note->respiratory_rate,
            'spo2' => $note->spo2,
            'bp_systolic' => $note->bp_systolic,
            'bp_diastolic' => $note->bp_diastolic,
            'blood_sugar_mg_dl' => $note->blood_sugar_mg_dl,
            'pain_score' => $note->pain_score,
        ]);
    }

    /** Live assess so tab filter and badge always match the vitals shown. */
    private function resolvedConditionLevel(NursingNote $note): string
    {
        $level = $this->assessVitals($note)['level'];
        if ($level === 'unrecorded') {
            return $note->condition ?: 'normal';
        }

        return $level;
    }

    private function payload(NursingNote $note): array
    {
        $bp = null;
        if ($note->bp_systolic && $note->bp_diastolic) {
            $bp = "{$note->bp_systolic}/{$note->bp_diastolic}";
        }

        $condition = $this->assessVitals($note);
        $level = $this->resolvedConditionLevel($note);
        $labels = [
            'normal' => 'Normal',
            'watch' => 'Watch',
            'serious' => 'Critical',
            'emergency' => 'Emergency',
            'unrecorded' => 'Unrecorded',
        ];

        return [
            'id' => $note->id,
            'note_code' => $note->note_code,
            'shift' => $note->shift,
            'status' => $note->status,
            'condition' => $level,
            'condition_label' => $labels[$level] ?? 'Unrecorded',
            'condition_reasons' => $condition['reasons'],
            'recorded_at' => $note->recorded_at?->toDateTimeString(),
            'temperature' => $note->temperature,
            'pulse' => $note->pulse,
            'bp_systolic' => $note->bp_systolic,
            'bp_diastolic' => $note->bp_diastolic,
            'bp' => $bp,
            'spo2' => $note->spo2,
            'respiratory_rate' => $note->respiratory_rate,
            'weight_kg' => $note->weight_kg,
            'blood_sugar_mg_dl' => $note->blood_sugar_mg_dl,
            'pain_score' => $note->pain_score,
            'mood' => $note->mood,
            'sleep_quality' => $note->sleep_quality,
            'appetite' => $note->appetite,
            'observations' => $note->observations,
            'interventions' => $note->interventions,
            'created_by' => $note->created_by,
            'created_by_name' => $note->creator?->name,
            'patient' => [
                'id' => $note->patient?->id,
                'patient_code' => $note->patient?->patient_code,
                'full_name' => $note->patient?->full_name,
            ],
            'admission' => [
                'id' => $note->admission?->id,
                'admission_code' => $note->admission?->admission_code,
                'status' => $note->admission?->status,
            ],
        ];
    }

    private function nextCode(): string
    {
        $year = now()->format('Y');
        $prefix = "NN-{$year}-";
        $latest = NursingNote::query()
            ->where('note_code', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('note_code');

        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
