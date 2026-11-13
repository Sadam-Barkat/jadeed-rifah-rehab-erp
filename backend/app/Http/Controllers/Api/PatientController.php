<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Admission;
use App\Models\Bed;
use App\Models\Patient;
use App\Services\AppNotifier;
use App\Support\Audit;
use App\Support\SecureUpload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

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
        $request->user()?->loadMissing('role');
        $isAdmin = $request->user()?->role?->slug === 'admin';

        $data = $this->validated($request);
        $data['action_mode'] = $isAdmin
            ? ($request->input('action_mode', 'register'))
            : 'register';

        if ($data['action_mode'] === 'admit') {
            $request->validate([
                'bed_id' => ['required', 'exists:beds,id'],
            ]);
            $data['bed_id'] = (int) $request->input('bed_id');
        }

        $request->validate([
            'cnic_front' => ['required', 'file', 'max:5120', 'mimes:jpg,jpeg,png,webp'],
            'cnic_back' => ['required', 'file', 'max:5120', 'mimes:jpg,jpeg,png,webp'],
            'plan_days' => ['required', Rule::in([30, 60, 90])],
        ]);

        $data['cnic'] = $this->normalizeCnic($data['cnic'] ?? null);
        $data['phone'] = $this->normalizePhone($data['phone'] ?? null);
        if (! empty($data['guardian']['cnic'])) {
            $data['guardian']['cnic'] = $this->normalizeCnic($data['guardian']['cnic']);
        }
        if (! empty($data['guardian']['phone'])) {
            $data['guardian']['phone'] = $this->normalizePhone($data['guardian']['phone']);
        }

        $duplicates = $this->findDuplicates(
            $data['cnic'] ?? null,
            $data['phone'] ?? null,
            $data['email'] ?? null
        );
        if ($duplicates->isNotEmpty()) {
            $payload = $this->duplicatePayload(
                $duplicates,
                $data['cnic'] ?? null,
                $data['phone'] ?? null,
                $data['email'] ?? null
            );

            return response()->json([
                'message' => $payload['message'],
                'matched_fields' => $payload['matched_fields'],
                'duplicates' => $payload['duplicates'],
            ], 409);
        }

        $frontPath = SecureUpload::storeImage($request->file('cnic_front'), 'patient-cnic', 'cnic_f_');
        $backPath = SecureUpload::storeImage($request->file('cnic_back'), 'patient-cnic', 'cnic_b_');

        try {
            $patient = DB::transaction(function () use ($request, $data, $frontPath, $backPath) {
                $status = $data['action_mode'] === 'admit' ? 'admitted' : 'registered';

                $patient = Patient::query()->create([
                    ...$this->patientFields($data),
                    'plan_days' => (int) $data['plan_days'],
                    'cnic_front_path' => $frontPath,
                    'cnic_back_path' => $backPath,
                    'patient_code' => $this->nextPatientCode(),
                    'status' => $status,
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

                if ($data['action_mode'] === 'admit') {
                    $bed = Bed::query()->lockForUpdate()->findOrFail($data['bed_id']);
                    if ($bed->status !== 'available') {
                        throw ValidationException::withMessages([
                            'bed_id' => ['Selected bed is not available.'],
                        ]);
                    }

                    Admission::query()->create([
                        'admission_code' => $this->nextAdmissionCode(),
                        'patient_id' => $patient->id,
                        'bed_id' => $bed->id,
                        'admitted_at' => now(),
                        'program_days' => (int) $data['plan_days'],
                        'package_name' => $data['plan_days'].'-Day Program',
                        'status' => 'active',
                        'created_by' => $request->user()->id,
                        'updated_by' => $request->user()->id,
                    ]);

                    $bed->update(['status' => 'occupied']);
                }

                return $patient->load('guardians');
            });
        } catch (ValidationException $e) {
            throw $e;
        }

        Audit::log('patient.create', 'registration', 'patient', $patient->id, "Registered {$patient->patient_code}");

        $notifier = app(AppNotifier::class);
        $meta = ['patient_id' => $patient->id, 'patient_code' => $patient->patient_code];

        $notifier->notifyRoleSlugs(
            ['finance'],
            'patient.registered',
            "New patient {$patient->patient_code}",
            $patient->full_name.' · plan '.$patient->plan_days.' days — fee collection pending.',
            '/app/billing',
            $meta,
            $request->user()->id,
        );

        if ($patient->status === 'registered') {
            $notifier->notifyRoleSlugs(
                ['admin'],
                'patient.registered',
                "Registration request {$patient->patient_code}",
                $patient->full_name.' awaiting admit review.',
                '/app/management?tab=patients',
                $meta,
                $request->user()->id,
            );
        }

        return response()->json([
            'message' => $patient->status === 'admitted'
                ? 'Patient registered and admitted'
                : 'Registration submitted for admin review',
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
            $fields = $this->patientFields($data);
            if ($request->filled('plan_days')) {
                $fields['plan_days'] = (int) $request->input('plan_days');
            }
            if ($request->hasFile('cnic_front')) {
                $fields['cnic_front_path'] = SecureUpload::storeImage($request->file('cnic_front'), 'patient-cnic', 'cnic_f_');
            }
            if ($request->hasFile('cnic_back')) {
                $fields['cnic_back_path'] = SecureUpload::storeImage($request->file('cnic_back'), 'patient-cnic', 'cnic_b_');
            }

            $patient->update([
                ...$fields,
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

    public function destroy(Request $request, Patient $patient): JsonResponse
    {
        $code = $patient->patient_code;
        $id = $patient->id;

        if ($patient->admissions()->where('status', 'active')->exists()) {
            return response()->json(['message' => 'Cannot delete a patient with an active admission. Discharge first.'], 422);
        }

        $patient->update([
            'status' => 'archived',
            'updated_by' => $request->user()->id,
        ]);

        Audit::log('patient.archive', 'patients', 'patient', $id, "Archived {$code}");

        return response()->json(['message' => 'Patient archived']);
    }

    public function checkDuplicate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'cnic' => ['nullable', 'string', 'max:20'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:150'],
        ]);

        $duplicates = $this->findDuplicates(
            $this->normalizeCnic($data['cnic'] ?? null),
            $this->normalizePhone($data['phone'] ?? null),
            $data['email'] ?? null
        );

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
            'cnic' => ['required', 'string', 'max:20', 'regex:/^\d{5}-\d{7}-\d{1}$/'],
            'gender' => ['nullable', Rule::in(['male', 'female', 'other'])],
            'date_of_birth' => ['nullable', 'date', 'before_or_equal:today'],
            'age' => ['nullable', 'integer', 'min:0', 'max:150'],
            'phone' => ['required', 'string', 'max:30', 'regex:/^03\d{9}$/'],
            'email' => ['nullable', 'email', 'max:150'],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'blood_group' => ['nullable', 'string', 'max:10'],
            'marital_status' => ['nullable', 'string', 'max:30'],
            'referral_source' => ['nullable', 'string', 'max:150'],
            'plan_days' => ['nullable', Rule::in([30, 60, 90])],
            'action_mode' => ['nullable', Rule::in(['register', 'admit'])],
            'guardian' => ['nullable', 'array'],
            'guardian.name' => ['required_with:guardian', 'string', 'max:150'],
            'guardian.relation' => ['nullable', 'string', 'max:80'],
            'guardian.phone' => ['nullable', 'string', 'max:30', 'regex:/^03\d{9}$/'],
            'guardian.cnic' => ['nullable', 'string', 'max:20', 'regex:/^\d{5}-\d{7}-\d{1}$/'],
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

    private function findDuplicates(?string $cnic, ?string $phone, ?string $email = null)
    {
        $cnicDigits = $cnic ? preg_replace('/\D+/', '', $cnic) : '';
        $phoneDigits = $phone ? preg_replace('/\D+/', '', $phone) : '';
        $emailNorm = $email ? strtolower(trim($email)) : '';

        if ($cnicDigits === '' && $phoneDigits === '' && $emailNorm === '') {
            return collect();
        }

        return Patient::query()
            ->with(['guardians' => fn ($q) => $q->where('is_primary', true)])
            ->where(function ($q) use ($cnic, $cnicDigits, $phone, $phoneDigits, $emailNorm) {
                if ($cnicDigits !== '') {
                    $q->orWhere('cnic', $cnic)
                        ->orWhereRaw(
                            "REPLACE(REPLACE(REPLACE(COALESCE(cnic,''), '-', ''), ' ', ''), '_', '') = ?",
                            [$cnicDigits]
                        );
                }
                if ($phoneDigits !== '') {
                    $q->orWhere('phone', $phone)
                        ->orWhereRaw(
                            "REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(phone,''), '-', ''), ' ', ''), '+', ''), '_', '') = ?",
                            [$phoneDigits]
                        );
                }
                if ($emailNorm !== '') {
                    $q->orWhereRaw('LOWER(email) = ?', [$emailNorm]);
                }
            })
            ->where('status', '!=', 'archived')
            ->limit(5)
            ->get();
    }

    private function normalizeCnic(?string $cnic): ?string
    {
        if ($cnic === null || trim($cnic) === '') {
            return null;
        }
        $digits = preg_replace('/\D+/', '', $cnic);
        if (strlen($digits) !== 13) {
            return trim($cnic);
        }

        return substr($digits, 0, 5).'-'.substr($digits, 5, 7).'-'.substr($digits, 12, 1);
    }

    private function normalizePhone(?string $phone): ?string
    {
        if ($phone === null || trim($phone) === '') {
            return null;
        }

        return preg_replace('/\D+/', '', $phone);
    }

    private function digits(?string $value): string
    {
        return preg_replace('/\D+/', '', (string) $value);
    }

    /** @param \Illuminate\Support\Collection<int, Patient> $duplicates */
    private function duplicatePayload($duplicates, ?string $cnic, ?string $phone, ?string $email): array
    {
        $cnicDigits = $this->digits($cnic);
        $phoneDigits = $this->digits($phone);
        $emailNorm = $email ? strtolower(trim($email)) : '';

        $matchedSet = [];
        $rows = $duplicates->map(function (Patient $p) use ($cnicDigits, $phoneDigits, $emailNorm, &$matchedSet) {
            $matched = [];
            if ($cnicDigits !== '' && $this->digits($p->cnic) === $cnicDigits) {
                $matched[] = 'CNIC';
                $matchedSet['CNIC'] = true;
            }
            if ($phoneDigits !== '' && $this->digits($p->phone) === $phoneDigits) {
                $matched[] = 'Phone';
                $matchedSet['Phone'] = true;
            }
            if ($emailNorm !== '' && strtolower((string) $p->email) === $emailNorm) {
                $matched[] = 'Email';
                $matchedSet['Email'] = true;
            }

            return [
                ...$this->listPayload($p),
                'matched' => $matched,
            ];
        })->values();

        $fields = array_keys($matchedSet);
        if ($fields === []) {
            $fields = ['CNIC', 'Phone', 'Email'];
        }

        $label = match (count($fields)) {
            1 => $fields[0],
            2 => $fields[0].' and '.$fields[1],
            default => implode(', ', array_slice($fields, 0, -1)).', and '.$fields[array_key_last($fields)],
        };

        return [
            'message' => "Duplicate {$label} found. Patient already exists.",
            'matched_fields' => $fields,
            'duplicates' => $rows,
        ];
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

    private function nextAdmissionCode(): string
    {
        $year = now()->format('Y');
        $prefix = "AD-{$year}-";
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

    private function listPayload(Patient $patient): array
    {
        $guardian = $patient->guardians->first();

        return [
            'id' => $patient->id,
            'patient_code' => $patient->patient_code,
            'full_name' => $patient->full_name,
            'cnic' => $patient->cnic,
            'phone' => $patient->phone,
            'email' => $patient->email,
            'gender' => $patient->gender,
            'status' => $patient->status,
            'plan_days' => $patient->plan_days,
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
            'cnic_front_url' => SecureUpload::url($patient->cnic_front_path),
            'cnic_back_url' => SecureUpload::url($patient->cnic_back_path),
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
