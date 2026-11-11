<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Admission;
use App\Models\Bed;
use App\Models\Patient;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdmissionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = Admission::query()
            ->with(['patient', 'bed.room'])
            ->latest('admitted_at');

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('admission_code', 'like', "%{$search}%")
                    ->orWhereHas('patient', function ($pq) use ($search) {
                        $pq->where('patient_code', 'like', "%{$search}%")
                            ->orWhere('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%");
                    });
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (Admission $a) => $this->payload($a)),
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
            'patient_id' => ['required', 'exists:patients,id'],
            'bed_id' => ['required', 'exists:beds,id'],
            'admitted_at' => ['nullable', 'date'],
            'program_days' => ['required', Rule::in([30, 60, 90])],
            'package_name' => ['nullable', 'string', 'max:150'],
            'clinical_notes' => ['nullable', 'string'],
            'belongings_notes' => ['nullable', 'string'],
            'consent_notes' => ['nullable', 'string'],
            'activate' => ['nullable', 'boolean'],
        ]);

        $patient = Patient::query()->findOrFail($data['patient_id']);

        if ($patient->status === 'admitted') {
            return response()->json(['message' => 'Patient is already admitted.'], 422);
        }

        if (Admission::query()->where('patient_id', $patient->id)->where('status', 'active')->exists()) {
            return response()->json(['message' => 'Patient already has an active admission.'], 422);
        }

        $activate = $request->boolean('activate', true);

        $admission = DB::transaction(function () use ($request, $data, $patient, $activate) {
            $bed = Bed::query()->lockForUpdate()->findOrFail($data['bed_id']);

            if ($bed->status !== 'available') {
                throw ValidationException::withMessages([
                    'bed_id' => ['Selected bed is not available.'],
                ]);
            }

            $admission = Admission::query()->create([
                'admission_code' => $this->nextAdmissionCode(),
                'patient_id' => $patient->id,
                'bed_id' => $bed->id,
                'admitted_at' => $data['admitted_at'] ?? now(),
                'program_days' => $data['program_days'],
                'package_name' => $data['package_name'] ?? ($data['program_days'].'-Day Program'),
                'status' => $activate ? 'active' : 'pending',
                'clinical_notes' => $data['clinical_notes'] ?? null,
                'belongings_notes' => $data['belongings_notes'] ?? null,
                'consent_notes' => $data['consent_notes'] ?? null,
                'created_by' => $request->user()->id,
                'updated_by' => $request->user()->id,
            ]);

            if ($activate) {
                $bed->update(['status' => 'occupied']);
                $patient->update([
                    'status' => 'admitted',
                    'updated_by' => $request->user()->id,
                ]);
            }

            return $admission->load(['patient', 'bed.room']);
        });

        Audit::log('admission.create', 'admission', 'admission', $admission->id, "Admission {$admission->admission_code}");

        return response()->json([
            'message' => 'Admission saved successfully',
            'data' => $this->payload($admission),
        ], 201);
    }

    public function show(Admission $admission): JsonResponse
    {
        $admission->load(['patient', 'bed.room']);

        return response()->json(['data' => $this->payload($admission)]);
    }

    private function payload(Admission $admission): array
    {
        return [
            'id' => $admission->id,
            'admission_code' => $admission->admission_code,
            'status' => $admission->status,
            'admitted_at' => $admission->admitted_at?->toDateTimeString(),
            'program_days' => $admission->program_days,
            'package_name' => $admission->package_name,
            'clinical_notes' => $admission->clinical_notes,
            'belongings_notes' => $admission->belongings_notes,
            'consent_notes' => $admission->consent_notes,
            'patient' => [
                'id' => $admission->patient?->id,
                'patient_code' => $admission->patient?->patient_code,
                'full_name' => $admission->patient?->full_name,
                'phone' => $admission->patient?->phone,
                'status' => $admission->patient?->status,
            ],
            'bed' => [
                'id' => $admission->bed?->id,
                'bed_code' => $admission->bed?->bed_code,
                'room_name' => $admission->bed?->room?->name,
                'room_code' => $admission->bed?->room?->code,
                'floor' => $admission->bed?->room?->floor,
            ],
        ];
    }

    private function nextAdmissionCode(): string
    {
        $year = now()->format('Y');
        $prefix = "ADM-{$year}-";
        $latest = Admission::query()
            ->where('admission_code', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('admission_code');

        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
