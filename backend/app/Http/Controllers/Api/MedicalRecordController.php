<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Admission;
use App\Models\MedicalRecord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MedicalRecordController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = MedicalRecord::query()
            ->with(['patient', 'admission', 'creator'])
            ->latest('recorded_at');

        if ($type = $request->get('record_type')) {
            $query->where('record_type', $type);
        }

        if ($admissionId = $request->integer('admission_id')) {
            $query->where('admission_id', $admissionId);
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('record_code', 'like', "%{$search}%")
                    ->orWhere('diagnosis', 'like', "%{$search}%")
                    ->orWhere('chief_complaint', 'like', "%{$search}%")
                    ->orWhereHas('patient', function ($pq) use ($search) {
                        $pq->where('patient_code', 'like', "%{$search}%")
                            ->orWhere('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%");
                    });
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (MedicalRecord $r) => $this->payload($r)),
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
            'record_type' => ['nullable', Rule::in([
                'consultation',
                'diagnosis',
                'progress',
                'prescription_note',
                'other',
            ])],
            'chief_complaint' => ['nullable', 'string', 'max:255'],
            'diagnosis' => ['nullable', 'string'],
            'clinical_findings' => ['nullable', 'string'],
            'treatment_advice' => ['nullable', 'string'],
            'medications_prescribed' => ['nullable', 'string'],
        ]);

        $admission = Admission::query()->with('patient')->findOrFail($data['admission_id']);

        if ($admission->status !== 'active') {
            return response()->json(['message' => 'Medical records require an active admission.'], 422);
        }

        $record = MedicalRecord::query()->create([
            'record_code' => $this->nextCode(),
            'admission_id' => $admission->id,
            'patient_id' => $admission->patient_id,
            'recorded_at' => $data['recorded_at'] ?? now(),
            'record_type' => $data['record_type'] ?? 'consultation',
            'chief_complaint' => $data['chief_complaint'] ?? null,
            'diagnosis' => $data['diagnosis'] ?? null,
            'clinical_findings' => $data['clinical_findings'] ?? null,
            'treatment_advice' => $data['treatment_advice'] ?? null,
            'medications_prescribed' => $data['medications_prescribed'] ?? null,
            'status' => 'active',
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ])->load(['patient', 'admission', 'creator']);

        return response()->json([
            'message' => 'Medical record created',
            'data' => $this->payload($record),
        ], 201);
    }

    public function update(Request $request, MedicalRecord $medicalRecord): JsonResponse
    {
        $data = $request->validate([
            'record_type' => ['nullable', Rule::in([
                'consultation',
                'diagnosis',
                'progress',
                'prescription_note',
                'other',
            ])],
            'chief_complaint' => ['nullable', 'string', 'max:255'],
            'diagnosis' => ['nullable', 'string'],
            'clinical_findings' => ['nullable', 'string'],
            'treatment_advice' => ['nullable', 'string'],
            'medications_prescribed' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['active', 'amended'])],
        ]);

        $medicalRecord->update([
            ...$data,
            'status' => $data['status'] ?? 'amended',
            'updated_by' => $request->user()->id,
        ]);

        $medicalRecord->load(['patient', 'admission', 'creator']);

        return response()->json([
            'message' => 'Medical record updated',
            'data' => $this->payload($medicalRecord),
        ]);
    }

    public function show(MedicalRecord $medicalRecord): JsonResponse
    {
        $medicalRecord->load(['patient', 'admission', 'creator']);

        return response()->json(['data' => $this->payload($medicalRecord)]);
    }

    private function payload(MedicalRecord $record): array
    {
        return [
            'id' => $record->id,
            'record_code' => $record->record_code,
            'record_type' => $record->record_type,
            'status' => $record->status,
            'recorded_at' => $record->recorded_at?->toDateTimeString(),
            'chief_complaint' => $record->chief_complaint,
            'diagnosis' => $record->diagnosis,
            'clinical_findings' => $record->clinical_findings,
            'treatment_advice' => $record->treatment_advice,
            'medications_prescribed' => $record->medications_prescribed,
            'created_by_name' => $record->creator?->name,
            'patient' => [
                'id' => $record->patient?->id,
                'patient_code' => $record->patient?->patient_code,
                'full_name' => $record->patient?->full_name,
            ],
            'admission' => [
                'id' => $record->admission?->id,
                'admission_code' => $record->admission?->admission_code,
                'status' => $record->admission?->status,
            ],
        ];
    }

    private function nextCode(): string
    {
        $year = now()->format('Y');
        $prefix = "MR-{$year}-";
        $latest = MedicalRecord::query()
            ->where('record_code', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('record_code');

        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
