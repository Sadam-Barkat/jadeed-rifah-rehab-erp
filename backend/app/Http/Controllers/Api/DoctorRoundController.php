<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Admission;
use App\Models\Doctor;
use App\Models\DoctorRound;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DoctorRoundController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = DoctorRound::query()
            ->with(['doctor', 'patient', 'admission', 'creator'])
            ->latest('round_at');

        if ($doctorId = $request->integer('doctor_id')) {
            $query->where('doctor_id', $doctorId);
        }

        if ($admissionId = $request->integer('admission_id')) {
            $query->where('admission_id', $admissionId);
        }

        if ($type = $request->get('round_type')) {
            $query->where('round_type', $type);
        }

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('round_code', 'like', "%{$search}%")
                    ->orWhere('findings', 'like', "%{$search}%")
                    ->orWhereHas('patient', function ($pq) use ($search) {
                        $pq->where('patient_code', 'like', "%{$search}%")
                            ->orWhere('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%");
                    })
                    ->orWhereHas('doctor', function ($dq) use ($search) {
                        $dq->where('full_name', 'like', "%{$search}%")
                            ->orWhere('doctor_code', 'like', "%{$search}%");
                    });
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (DoctorRound $r) => $this->payload($r)),
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
            'doctor_id' => ['required', 'exists:doctors,id'],
            'admission_id' => ['required', 'exists:admissions,id'],
            'round_at' => ['nullable', 'date'],
            'round_type' => ['nullable', Rule::in(['morning', 'evening', 'emergency', 'follow_up'])],
            'vitals_summary' => ['nullable', 'string', 'max:255'],
            'findings' => ['nullable', 'string'],
            'orders' => ['nullable', 'string'],
            'next_review_at' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in(['scheduled', 'completed', 'cancelled'])],
        ]);

        $doctor = Doctor::query()->findOrFail($data['doctor_id']);
        if ($doctor->status !== 'active') {
            return response()->json(['message' => 'Doctor must be active.'], 422);
        }

        $admission = Admission::query()->findOrFail($data['admission_id']);
        if ($admission->status !== 'active') {
            return response()->json(['message' => 'Doctor round requires an active admission.'], 422);
        }

        $round = DoctorRound::query()->create([
            'round_code' => $this->nextCode(),
            'doctor_id' => $doctor->id,
            'admission_id' => $admission->id,
            'patient_id' => $admission->patient_id,
            'round_at' => $data['round_at'] ?? now(),
            'round_type' => $data['round_type'] ?? 'morning',
            'vitals_summary' => $data['vitals_summary'] ?? null,
            'findings' => $data['findings'] ?? null,
            'orders' => $data['orders'] ?? null,
            'next_review_at' => $data['next_review_at'] ?? null,
            'status' => $data['status'] ?? 'completed',
            'created_by' => $request->user()->id,
        ])->load(['doctor', 'patient', 'admission', 'creator']);

        return response()->json([
            'message' => 'Doctor round saved',
            'data' => $this->payload($round),
        ], 201);
    }

    public function show(DoctorRound $doctorRound): JsonResponse
    {
        $doctorRound->load(['doctor', 'patient', 'admission', 'creator']);

        return response()->json(['data' => $this->payload($doctorRound)]);
    }

    private function payload(DoctorRound $round): array
    {
        return [
            'id' => $round->id,
            'round_code' => $round->round_code,
            'round_type' => $round->round_type,
            'status' => $round->status,
            'round_at' => $round->round_at?->toDateTimeString(),
            'vitals_summary' => $round->vitals_summary,
            'findings' => $round->findings,
            'orders' => $round->orders,
            'next_review_at' => $round->next_review_at?->toDateTimeString(),
            'doctor' => $round->doctor ? [
                'id' => $round->doctor->id,
                'doctor_code' => $round->doctor->doctor_code,
                'full_name' => $round->doctor->full_name,
                'specialization' => $round->doctor->specialization,
            ] : null,
            'patient' => $round->patient ? [
                'id' => $round->patient->id,
                'patient_code' => $round->patient->patient_code,
                'full_name' => trim(($round->patient->first_name ?? '').' '.($round->patient->last_name ?? '')),
            ] : null,
            'admission' => $round->admission ? [
                'id' => $round->admission->id,
                'admission_code' => $round->admission->admission_code,
                'status' => $round->admission->status,
            ] : null,
            'created_by' => $round->creator?->name,
        ];
    }

    private function nextCode(): string
    {
        $n = DoctorRound::query()->count() + 1;

        return 'RND-'.str_pad((string) $n, 5, '0', STR_PAD_LEFT);
    }
}
