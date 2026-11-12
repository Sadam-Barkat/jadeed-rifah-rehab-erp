<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Doctor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DoctorController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = Doctor::query()->with(['creator'])->latest('id');

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('doctor_code', 'like', "%{$search}%")
                    ->orWhere('full_name', 'like', "%{$search}%")
                    ->orWhere('specialization', 'like', "%{$search}%")
                    ->orWhere('license_no', 'like', "%{$search}%");
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (Doctor $d) => $this->payload($d)),
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
            'full_name' => ['required', 'string', 'max:150'],
            'specialization' => ['nullable', 'string', 'max:150'],
            'license_no' => ['nullable', 'string', 'max:64'],
            'phone' => ['nullable', 'string', 'max:32'],
            'email' => ['nullable', 'email', 'max:150'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'user_id' => ['nullable', 'exists:users,id'],
            'notes' => ['nullable', 'string'],
        ]);

        $doctor = Doctor::query()->create([
            'doctor_code' => $this->nextCode(),
            'full_name' => $data['full_name'],
            'specialization' => $data['specialization'] ?? null,
            'license_no' => $data['license_no'] ?? null,
            'phone' => $data['phone'] ?? null,
            'email' => $data['email'] ?? null,
            'status' => $data['status'] ?? 'active',
            'user_id' => $data['user_id'] ?? null,
            'notes' => $data['notes'] ?? null,
            'created_by' => $request->user()->id,
        ])->load(['creator']);

        return response()->json([
            'message' => 'Doctor created',
            'data' => $this->payload($doctor),
        ], 201);
    }

    public function show(Doctor $doctor): JsonResponse
    {
        $doctor->load(['creator']);

        return response()->json(['data' => $this->payload($doctor)]);
    }

    public function update(Request $request, Doctor $doctor): JsonResponse
    {
        $data = $request->validate([
            'full_name' => ['sometimes', 'required', 'string', 'max:150'],
            'specialization' => ['nullable', 'string', 'max:150'],
            'license_no' => ['nullable', 'string', 'max:64'],
            'phone' => ['nullable', 'string', 'max:32'],
            'email' => ['nullable', 'email', 'max:150'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'user_id' => ['nullable', 'exists:users,id'],
            'notes' => ['nullable', 'string'],
        ]);

        $doctor->update($data);
        $doctor->load(['creator']);

        return response()->json([
            'message' => 'Doctor updated',
            'data' => $this->payload($doctor),
        ]);
    }

    private function payload(Doctor $doctor): array
    {
        return [
            'id' => $doctor->id,
            'doctor_code' => $doctor->doctor_code,
            'full_name' => $doctor->full_name,
            'specialization' => $doctor->specialization,
            'license_no' => $doctor->license_no,
            'phone' => $doctor->phone,
            'email' => $doctor->email,
            'status' => $doctor->status,
            'user_id' => $doctor->user_id,
            'notes' => $doctor->notes,
            'created_by' => $doctor->creator?->name,
            'created_at' => $doctor->created_at?->toDateTimeString(),
        ];
    }

    private function nextCode(): string
    {
        $n = Doctor::query()->count() + 1;

        return 'DOC-'.str_pad((string) $n, 4, '0', STR_PAD_LEFT);
    }
}
