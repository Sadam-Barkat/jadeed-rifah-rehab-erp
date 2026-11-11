<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Patient;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PatientController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = Patient::query()
            ->with(['guardians' => fn ($q) => $q->where('is_primary', true)])
            ->latest();

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('patient_code', 'like', "%{$search}%")
                    ->orWhere('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('cnic', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (Patient $p) => $this->listPayload($p)),
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
        $data = $this->validated($request);

        $duplicates = $this->findDuplicates($data['cnic'] ?? null, $data['phone'] ?? null);
        if ($duplicates->isNotEmpty() && ! $request->boolean('force')) {
            return response()->json([
                'message' => 'Possible duplicate patient found.',
                'duplicates' => $duplicates->map(fn (Patient $p) => $this->listPayload($p)),
            ], 409);
        }

        $patient = DB::transaction(function () use ($request, $data) {
            $patient = Patient::query()->create([
                ...$this->patientFields($data),
                'patient_code' => $this->nextPatientCode(),
                'status' => 'registered',
                'created_by' => $request->user()->id,
                'updated_by' => $request->user()->id,
            ]);

            if (! empty($data['guardian'])) {
                $patient->guardians()->create([
                    ...$data['guardian'],
                    'is_primary' => true,
                    'is_emergency' => $data['guardian']['is_emergency'] ?? true,
                ]);
            }

            return $patient->load('guardians');
        });

        Audit::log('patient.create', 'registration', 'patient', $patient->id, "Registered {$patient->patient_code}");

        return response()->json([
            'message' => 'Patient registered successfully',
            'data' => $this->detailPayload($patient),
        ], 201);
    }

    public function show(Patient $patient): JsonResponse
    {
        $patient->load('guardians');

        return response()->json([
            'data' => $this->detailPayload($patient),
        ]);
    }

    public function update(Request $request, Patient $patient): JsonResponse
    {
        $data = $this->validated($request, $patient->id);

        DB::transaction(function () use ($request, $patient, $data) {
            $patient->update([
                ...$this->patientFields($data),
                'updated_by' => $request->user()->id,
            ]);

            if (array_key_exists('guardian', $data)) {
                $primary = $patient->guardians()->where('is_primary', true)->first();
                if ($primary) {
                    $primary->update($data['guardian'] ?? []);
                } elseif (! empty($data['guardian'])) {
                    $patient->guardians()->create([
                        ...$data['guardian'],
                        'is_primary' => true,
                        'is_emergency' => $data['guardian']['is_emergency'] ?? true,
                    ]);
                }
            }
        });

        $patient->refresh()->load('guardians');

        Audit::log('patient.update', 'patients', 'patient', $patient->id, "Updated {$patient->patient_code}");

        return response()->json([
            'message' => 'Patient updated successfully',
            'data' => $this->detailPayload($patient),
        ]);
    }

    public function checkDuplicate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'cnic' => ['nullable', 'string', 'max:20'],
            'phone' => ['nullable', 'string', 'max:30'],
        ]);

        $duplicates = $this->findDuplicates($data['cnic'] ?? null, $data['phone'] ?? null);

        return response()->json([
            'has_duplicates' => $duplicates->isNotEmpty(),
            'duplicates' => $duplicates->map(fn (Patient $p) => $this->listPayload($p)),
        ]);
    }

    private function validated(Request $request, ?int $patientId = null): array
    {
        return $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['nullable', 'string', 'max:100'],
            'father_name' => ['nullable', 'string', 'max:100'],
            'cnic' => ['nullable', 'string', 'max:20'],
            'gender' => ['nullable', Rule::in(['male', 'female', 'other'])],
            'date_of_birth' => ['nullable', 'date'],
            'age' => ['nullable', 'integer', 'min:0', 'max:150'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:150'],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'blood_group' => ['nullable', 'string', 'max:10'],
            'marital_status' => ['nullable', 'string', 'max:30'],
            'referral_source' => ['nullable', 'string', 'max:150'],
            'guardian' => ['nullable', 'array'],
            'guardian.name' => ['required_with:guardian', 'string', 'max:150'],
            'guardian.relation' => ['nullable', 'string', 'max:80'],
            'guardian.phone' => ['nullable', 'string', 'max:30'],
            'guardian.cnic' => ['nullable', 'string', 'max:20'],
            'guardian.address' => ['nullable', 'string', 'max:255'],
            'guardian.is_emergency' => ['nullable', 'boolean'],
            'force' => ['nullable', 'boolean'],
        ]);
    }

    private function patientFields(array $data): array
    {
        return collect($data)->only([
            'first_name', 'last_name', 'father_name', 'cnic', 'gender', 'date_of_birth', 'age',
            'phone', 'email', 'address', 'city', 'blood_group', 'marital_status', 'referral_source',
        ])->all();
    }

    private function findDuplicates(?string $cnic, ?string $phone)
    {
        if (! $cnic && ! $phone) {
            return collect();
        }

        return Patient::query()
            ->with(['guardians' => fn ($q) => $q->where('is_primary', true)])
            ->where(function ($q) use ($cnic, $phone) {
                if ($cnic) {
                    $q->orWhere('cnic', $cnic);
                }
                if ($phone) {
                    $q->orWhere('phone', $phone);
                }
            })
            ->limit(5)
            ->get();
    }

    private function nextPatientCode(): string
    {
        $year = now()->format('Y');
        $prefix = "JR-{$year}-";
        $latest = Patient::query()
            ->where('patient_code', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('patient_code');

        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }

    private function listPayload(Patient $patient): array
    {
        $guardian = $patient->guardians->first();

        return [
            'id' => $patient->id,
            'patient_code' => $patient->patient_code,
            'full_name' => $patient->full_name,
            'cnic' => $patient->cnic,
            'phone' => $patient->phone,
            'gender' => $patient->gender,
            'status' => $patient->status,
            'city' => $patient->city,
            'guardian_name' => $guardian?->name,
            'created_at' => $patient->created_at?->toDateTimeString(),
        ];
    }

    private function detailPayload(Patient $patient): array
    {
        return [
            ...$this->listPayload($patient),
            'first_name' => $patient->first_name,
            'last_name' => $patient->last_name,
            'father_name' => $patient->father_name,
            'date_of_birth' => $patient->date_of_birth?->format('Y-m-d'),
            'age' => $patient->age,
            'email' => $patient->email,
            'address' => $patient->address,
            'blood_group' => $patient->blood_group,
            'marital_status' => $patient->marital_status,
            'referral_source' => $patient->referral_source,
            'guardians' => $patient->guardians->map(fn ($g) => [
                'id' => $g->id,
                'name' => $g->name,
                'relation' => $g->relation,
                'phone' => $g->phone,
                'cnic' => $g->cnic,
                'address' => $g->address,
                'is_primary' => $g->is_primary,
                'is_emergency' => $g->is_emergency,
            ]),
        ];
    }
}
