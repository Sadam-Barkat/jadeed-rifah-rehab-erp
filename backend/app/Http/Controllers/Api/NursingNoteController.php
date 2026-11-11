<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Admission;
use App\Models\NursingNote;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class NursingNoteController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = NursingNote::query()
            ->with(['patient', 'admission', 'creator'])
            ->latest('recorded_at');

        if ($shift = $request->get('shift')) {
            $query->where('shift', $shift);
        }

        if ($admissionId = $request->integer('admission_id')) {
            $query->where('admission_id', $admissionId);
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('note_code', 'like', "%{$search}%")
                    ->orWhere('observations', 'like', "%{$search}%")
                    ->orWhereHas('patient', function ($pq) use ($search) {
                        $pq->where('patient_code', 'like', "%{$search}%")
                            ->orWhere('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%");
                    });
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (NursingNote $n) => $this->payload($n)),
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
            'recorded_at' => ['nullable', 'date'],
            'shift' => ['nullable', Rule::in(['morning', 'evening', 'night'])],
            'temperature' => ['nullable', 'numeric', 'between:30,45'],
            'pulse' => ['nullable', 'integer', 'between:20,250'],
            'bp_systolic' => ['nullable', 'integer', 'between:50,250'],
            'bp_diastolic' => ['nullable', 'integer', 'between:30,150'],
            'spo2' => ['nullable', 'integer', 'between:50,100'],
            'weight_kg' => ['nullable', 'numeric', 'between:10,300'],
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
            'weight_kg' => $data['weight_kg'] ?? null,
            'mood' => $data['mood'] ?? null,
            'sleep_quality' => $data['sleep_quality'] ?? null,
            'appetite' => $data['appetite'] ?? null,
            'observations' => $data['observations'] ?? null,
            'interventions' => $data['interventions'] ?? null,
            'status' => $data['status'] ?? 'recorded',
            'created_by' => $request->user()->id,
        ])->load(['patient', 'admission', 'creator']);

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

    private function payload(NursingNote $note): array
    {
        $bp = null;
        if ($note->bp_systolic && $note->bp_diastolic) {
            $bp = "{$note->bp_systolic}/{$note->bp_diastolic}";
        }

        return [
            'id' => $note->id,
            'note_code' => $note->note_code,
            'shift' => $note->shift,
            'status' => $note->status,
            'recorded_at' => $note->recorded_at?->toDateTimeString(),
            'temperature' => $note->temperature,
            'pulse' => $note->pulse,
            'bp_systolic' => $note->bp_systolic,
            'bp_diastolic' => $note->bp_diastolic,
            'bp' => $bp,
            'spo2' => $note->spo2,
            'weight_kg' => $note->weight_kg,
            'mood' => $note->mood,
            'sleep_quality' => $note->sleep_quality,
            'appetite' => $note->appetite,
            'observations' => $note->observations,
            'interventions' => $note->interventions,
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
