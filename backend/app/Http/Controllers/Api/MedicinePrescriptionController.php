<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Admission;
use App\Models\Doctor;
use App\Models\Medicine;
use App\Models\MedicineDispense;
use App\Models\MedicinePrescription;
use App\Models\MedicinePrescriptionItem;
use App\Models\User;
use App\Services\AppNotifier;
use App\Support\SecureUpload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MedicinePrescriptionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);
        $slug = $request->user()?->role?->slug;
        $isDispenser = in_array($slug, ['dispenser', 'pharmacist'], true);

        $query = MedicinePrescription::query()
            ->with([
                'patient:id,patient_code,first_name,last_name',
                'admission:id,admission_code',
                'doctor:id,doctor_code,full_name,specialization',
                'nurse:id,name,staff_code',
                'prescriber:id,name,staff_code',
                'dispenser:id,name,staff_code',
                'items.medicine' => $this->medicineWithExpiry(),
            ])
            ->latest('prescribed_at');

        if (! $isDispenser && $slug === 'doctor') {
            $query->where('prescribed_by', $request->user()->id);
        }

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($prescribedBy = $request->integer('prescribed_by')) {
            $query->where('prescribed_by', $prescribedBy);
        }

        if ($from = $request->get('from')) {
            $query->whereDate('prescribed_at', '>=', $from);
        }
        if ($to = $request->get('to')) {
            $query->whereDate('prescribed_at', '<=', $to);
        }

        if ($date = $request->get('date')) {
            $query->whereDate('prescribed_at', $date);
        } else {
            if ($year = $request->integer('year')) {
                $query->whereYear('prescribed_at', $year);
            }
            if ($month = $request->integer('month')) {
                $query->whereMonth('prescribed_at', $month);
            }
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('prescription_code', 'like', "%{$search}%")
                    ->orWhereHas('patient', function ($pq) use ($search) {
                        $pq->where('patient_code', 'like', "%{$search}%")
                            ->orWhere('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%");
                    })
                    ->orWhereHas('prescriber', function ($uq) use ($search) {
                        $uq->where('name', 'like', "%{$search}%");
                    })
                    ->orWhereHas('items', function ($iq) use ($search) {
                        $iq->where('medicine_name', 'like', "%{$search}%");
                    });
            });
        }

        $paginator = $query->paginate($perPage);

        $availableYears = MedicinePrescription::query()
            ->selectRaw('DISTINCT YEAR(prescribed_at) as y')
            ->whereNotNull('prescribed_at')
            ->orderByDesc('y')
            ->pluck('y')
            ->filter()
            ->values()
            ->all();

        return response()->json([
            'data' => collect($paginator->items())->map(fn (MedicinePrescription $rx) => $this->payload($rx)),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'available_years' => $availableYears,
            ],
        ]);
    }

    public function nurses(): JsonResponse
    {
        $nurses = User::query()
            ->where('is_active', true)
            ->whereHas('role', fn ($q) => $q->where('slug', 'nurse'))
            ->orderBy('name')
            ->get(['id', 'name', 'staff_code']);

        return response()->json([
            'data' => $nurses->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'staff_code' => $u->staff_code,
            ])->values()->all(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'admission_id' => ['required', 'exists:admissions,id'],
            'nurse_id' => ['required', 'exists:users,id'],
            'notes' => ['nullable', 'string'],
            'items' => ['nullable', 'array'],
            'items.*.medicine_id' => ['nullable', 'exists:medicines,id'],
            'items.*.medicine_name' => ['nullable', 'string', 'max:255'],
            'items.*.quantity' => ['nullable', 'integer', 'min:1'],
            'items.*.dosage' => ['nullable', 'string', 'max:100'],
            'items.*.frequency' => ['nullable', 'string', 'max:100'],
            'items.*.instructions' => ['nullable', 'string', 'max:255'],
            'handwritten_image' => SecureUpload::imageRules(false),
        ], SecureUpload::maxMessages([
            'handwritten_image' => 'Prescription image',
        ]));

        $nurse = User::query()->with('role:id,slug')->findOrFail($data['nurse_id']);
        if ($nurse->role?->slug !== 'nurse' || ! $nurse->is_active) {
            return response()->json(['message' => 'Select an active nurse.'], 422);
        }

        $items = array_values(array_filter(
            $data['items'] ?? [],
            fn ($line) => trim((string) ($line['medicine_name'] ?? '')) !== '' || ! empty($line['medicine_id'])
        ));
        $hasImage = $request->hasFile('handwritten_image');

        if (! $items && ! $hasImage) {
            return response()->json([
                'message' => 'Add medicine lines or upload a handwritten prescription photo.',
            ], 422);
        }

        foreach ($items as $i => $line) {
            if (empty($line['medicine_id']) && trim((string) ($line['medicine_name'] ?? '')) === '') {
                return response()->json(['message' => 'Medicine name is required on each line.'], 422);
            }
            if (empty($line['quantity']) || (int) $line['quantity'] < 1) {
                return response()->json(['message' => 'Quantity is required on each medicine line.'], 422);
            }
            $items[$i] = $line;
        }

        $admission = Admission::query()->with('patient')->findOrFail($data['admission_id']);
        if ($admission->status !== 'active') {
            return response()->json(['message' => 'Select an active admission.'], 422);
        }

        $doctor = $this->resolveDoctorForUser($request->user());

        $imagePath = $hasImage
            ? SecureUpload::storeImage($request->file('handwritten_image'), 'prescription-photos', 'rx_')
            : null;

        $prescription = DB::transaction(function () use ($request, $data, $admission, $items, $imagePath, $doctor) {
            $rx = MedicinePrescription::query()->create([
                'prescription_code' => $this->nextCode(),
                'admission_id' => $admission->id,
                'patient_id' => $admission->patient_id,
                'doctor_id' => $doctor?->id,
                'nurse_id' => (int) $data['nurse_id'],
                'status' => 'pending',
                'notes' => $data['notes'] ?? null,
                'handwritten_image_path' => $imagePath,
                'prescribed_by' => $request->user()->id,
                'prescribed_at' => now(),
            ]);

            foreach ($items as $line) {
                $medicine = ! empty($line['medicine_id'])
                    ? Medicine::query()->find((int) $line['medicine_id'])
                    : null;
                $name = trim((string) ($line['medicine_name'] ?? '')) ?: ($medicine?->name ?? 'Medicine');

                MedicinePrescriptionItem::query()->create([
                    'medicine_prescription_id' => $rx->id,
                    'medicine_id' => $medicine?->id,
                    'medicine_name' => $name,
                    'quantity' => (int) $line['quantity'],
                    'dosage' => $line['dosage'] ?? null,
                    'frequency' => $line['frequency'] ?? null,
                    'instructions' => $line['instructions'] ?? null,
                ]);
            }

            return $rx->load([
                'patient:id,patient_code,first_name,last_name',
                'admission:id,admission_code',
                'doctor:id,doctor_code,full_name,specialization',
                'nurse:id,name,staff_code',
                'prescriber:id,name,staff_code',
                'items.medicine' => $this->medicineWithExpiry(),
            ]);
        });

        $patientName = $prescription->patient?->full_name ?: 'Patient';
        $doctorName = $this->doctorName($prescription);
        $itemCount = $prescription->items->count();
        $body = $itemCount > 0
            ? "{$prescription->prescription_code} · {$patientName} · {$doctorName} · {$itemCount} medicine(s)"
            : "{$prescription->prescription_code} · {$patientName} · {$doctorName} · handwritten Rx";
        app(AppNotifier::class)->notifyRoleSlugs(
            ['dispenser', 'pharmacist'],
            'pharmacy.prescription_pending',
            'New prescription',
            $body,
            '/app/pharmacy?tab=prescriptions&id='.$prescription->id,
            ['medicine_prescription_id' => $prescription->id],
            $request->user()->id,
        );

        return response()->json([
            'message' => 'Prescription submitted',
            'data' => $this->payload($prescription),
        ], 201);
    }

    public function show(MedicinePrescription $medicinePrescription): JsonResponse
    {
        $medicinePrescription->load([
            'patient:id,patient_code,first_name,last_name',
            'admission:id,admission_code',
            'doctor:id,doctor_code,full_name,specialization',
            'nurse:id,name,staff_code',
            'prescriber:id,name,staff_code',
            'dispenser:id,name,staff_code',
            'items.medicine' => $this->medicineWithExpiry(),
        ]);

        return response()->json([
            'data' => $this->payload($medicinePrescription),
        ]);
    }

    public function dispense(Request $request, MedicinePrescription $medicinePrescription): JsonResponse
    {
        if ($medicinePrescription->status !== 'pending') {
            return response()->json(['message' => 'This prescription is already '.$medicinePrescription->status.'.'], 422);
        }

        $data = $request->validate([
            'admission_id' => ['nullable', 'exists:admissions,id'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['nullable', 'integer', 'exists:medicine_prescription_items,id'],
            'items.*.medicine_id' => ['required', 'integer', 'exists:medicines,id'],
            'items.*.dispensed_qty' => ['required', 'integer', 'min:1'],
            'items.*.medicine_name' => ['nullable', 'string', 'max:255'],
            'items.*.dosage' => ['nullable', 'string', 'max:100'],
            'items.*.frequency' => ['nullable', 'string', 'max:100'],
            'items.*.instructions' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'print_slip' => ['nullable', 'boolean'],
        ]);

        try {
            $prescription = DB::transaction(function () use ($request, $data, $medicinePrescription) {
                $rx = MedicinePrescription::query()
                    ->lockForUpdate()
                    ->with('items')
                    ->findOrFail($medicinePrescription->id);

                if ($rx->status !== 'pending') {
                    throw new \RuntimeException('This prescription is already '.$rx->status.'.');
                }

                $admissionId = $data['admission_id'] ?? $rx->admission_id;
                if (! $admissionId) {
                    throw new \RuntimeException('Select a patient before recording medicines.');
                }

                $admission = Admission::query()->with('patient')->findOrFail($admissionId);
                if ($admission->status !== 'active') {
                    throw new \RuntimeException('Select an active admission.');
                }

                $doctorId = $rx->doctor_id;
                if (! $doctorId && $rx->prescribed_by) {
                    $doctorId = $this->resolveDoctorForUser(
                        User::query()->find($rx->prescribed_by)
                    )?->id;
                }

                foreach ($data['items'] as $line) {
                    $qty = (int) $line['dispensed_qty'];
                    $medicine = Medicine::query()->lockForUpdate()->findOrFail($line['medicine_id']);

                    if ($medicine->status !== 'active') {
                        throw new \RuntimeException("{$medicine->name} is inactive.");
                    }
                    if ($medicine->stock_qty < $qty) {
                        throw new \RuntimeException("Insufficient stock for {$medicine->name}. Available: {$medicine->stock_qty}");
                    }

                    $item = null;
                    if (! empty($line['id'])) {
                        $item = $rx->items->firstWhere('id', (int) $line['id']);
                        if (! $item) {
                            throw new \RuntimeException('Invalid prescription line.');
                        }
                        $item->update([
                            'medicine_id' => $medicine->id,
                            'medicine_name' => $medicine->name,
                            'dispensed_qty' => $qty,
                            'dosage' => $line['dosage'] ?? $item->dosage,
                            'frequency' => $line['frequency'] ?? $item->frequency,
                            'instructions' => $line['instructions'] ?? $item->instructions,
                        ]);
                    } else {
                        $item = MedicinePrescriptionItem::query()->create([
                            'medicine_prescription_id' => $rx->id,
                            'medicine_id' => $medicine->id,
                            'medicine_name' => trim((string) ($line['medicine_name'] ?? '')) ?: $medicine->name,
                            'quantity' => $qty,
                            'dispensed_qty' => $qty,
                            'dosage' => $line['dosage'] ?? null,
                            'frequency' => $line['frequency'] ?? null,
                            'instructions' => $line['instructions'] ?? null,
                        ]);
                    }

                    $medicine->update(['stock_qty' => $medicine->stock_qty - $qty]);

                    MedicineDispense::query()->create([
                        'dispense_code' => $this->nextDispenseCode(),
                        'admission_id' => $admission->id,
                        'patient_id' => $admission->patient_id,
                        'medicine_id' => $medicine->id,
                        'quantity' => $qty,
                        'dosage' => $item->dosage,
                        'frequency' => $item->frequency,
                        'notes' => trim(($item->instructions ? $item->instructions.' · ' : '').'Rx '.$rx->prescription_code),
                        'dispensed_at' => now(),
                        'status' => 'dispensed',
                        'created_by' => $request->user()->id,
                    ]);
                }

                $print = $request->boolean('print_slip', true);
                $rx->update([
                    'admission_id' => $admission->id,
                    'patient_id' => $admission->patient_id,
                    'doctor_id' => $doctorId,
                    'status' => 'dispensed',
                    'dispensed_by' => $request->user()->id,
                    'dispensed_at' => now(),
                    'slip_printed_at' => $print ? now() : null,
                    'notes' => $data['notes'] ?? $rx->notes,
                ]);

                return $rx->fresh()->load([
                    'patient:id,patient_code,first_name,last_name',
                    'admission:id,admission_code',
                    'doctor:id,doctor_code,full_name,specialization',
                    'nurse:id,name,staff_code',
                    'prescriber:id,name,staff_code',
                    'dispenser:id,name,staff_code',
                    'items.medicine' => $this->medicineWithExpiry(),
                ]);
            });
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $patientName = $prescription->patient?->full_name ?: 'Patient';
        $doctorName = $this->doctorName($prescription);
        $notifyIds = $prescription->nurse_id
            ? [$prescription->nurse_id]
            : User::query()
                ->where('is_active', true)
                ->whereHas('role', fn ($q) => $q->where('slug', 'nurse'))
                ->pluck('id')
                ->all();
        app(AppNotifier::class)->notifyUsers(
            $notifyIds,
            'pharmacy.prescription_ready',
            'Medicine ready for nurse',
            "{$prescription->prescription_code} · {$patientName} · {$doctorName}",
            '/app/medicine-slips/'.$prescription->id,
            ['medicine_prescription_id' => $prescription->id],
            $request->user()->id,
        );

        return response()->json([
            'message' => 'Prescription dispensed',
            'data' => $this->payload($prescription),
        ]);
    }

    private function resolveDoctor(MedicinePrescription $rx): ?Doctor
    {
        if ($rx->doctor) {
            return $rx->doctor;
        }

        return $this->resolveDoctorForUser(
            $rx->prescriber ?: ($rx->prescribed_by ? User::query()->find($rx->prescribed_by) : null)
        );
    }

    private function doctorName(MedicinePrescription $rx): string
    {
        return $this->resolveDoctor($rx)?->full_name
            ?: ($rx->prescriber?->name ?: 'Doctor');
    }

    private function doctorSpecialization(MedicinePrescription $rx): ?string
    {
        $spec = trim((string) ($this->resolveDoctor($rx)?->specialization ?? ''));

        return $spec !== '' ? $spec : null;
    }

    private function payload(MedicinePrescription $rx): array
    {
        $doctor = $this->resolveDoctor($rx);

        return [
            'id' => $rx->id,
            'prescription_code' => $rx->prescription_code,
            'status' => $rx->status,
            'notes' => $rx->notes,
            'handwritten_image_url' => SecureUpload::url($rx->handwritten_image_path),
            'is_handwritten' => (bool) $rx->handwritten_image_path,
            'prescribed_at' => $rx->prescribed_at?->toDateTimeString(),
            'dispensed_at' => $rx->dispensed_at?->toDateTimeString(),
            'slip_printed_at' => $rx->slip_printed_at?->toDateTimeString(),
            'prescribed_by' => $this->doctorName($rx),
            'doctor_specialization' => $this->doctorSpecialization($rx),
            'prescribed_by_id' => $rx->prescribed_by,
            'doctor_id' => $rx->doctor_id ?: $doctor?->id,
            'doctor' => $doctor ? [
                'id' => $doctor->id,
                'doctor_code' => $doctor->doctor_code,
                'full_name' => $doctor->full_name,
                'specialization' => $doctor->specialization,
            ] : null,
            'nurse_id' => $rx->nurse_id,
            'nurse' => $rx->nurse ? [
                'id' => $rx->nurse->id,
                'name' => $rx->nurse->name,
                'staff_code' => $rx->nurse->staff_code,
            ] : null,
            'dispensed_by' => $rx->dispenser?->name,
            'dispensed_by_id' => $rx->dispensed_by,
            'patient' => [
                'id' => $rx->patient?->id,
                'patient_code' => $rx->patient?->patient_code,
                'full_name' => $rx->patient?->full_name,
            ],
            'admission' => [
                'id' => $rx->admission?->id,
                'admission_code' => $rx->admission?->admission_code,
            ],
            'admission_id' => $rx->admission_id,
            'items' => $rx->items->map(fn (MedicinePrescriptionItem $item) => [
                'id' => $item->id,
                'medicine_id' => $item->medicine_id,
                'medicine_name' => $item->medicine_name,
                'quantity' => $item->quantity,
                'dispensed_qty' => $item->dispensed_qty,
                'dosage' => $item->dosage,
                'frequency' => $item->frequency,
                'instructions' => $item->instructions,
                'medicine' => [
                    'id' => $item->medicine?->id,
                    'medicine_code' => $item->medicine?->medicine_code,
                    'name' => $item->medicine?->name,
                    'strength' => $item->medicine?->strength,
                    'unit' => $item->medicine?->unit,
                    'form' => $item->medicine?->form,
                    'category' => $item->medicine?->category,
                    'stock_qty' => $item->medicine?->stock_qty,
                    'reorder_level' => $item->medicine?->reorder_level,
                    'expiry_date' => $item->medicine?->nearestExpiryDate(),
                    'is_expired' => $item->medicine ? $item->medicine->isFullyExpired() : false,
                    'low_stock' => $item->medicine
                        ? ((int) $item->medicine->stock_qty <= (int) $item->medicine->reorder_level)
                        : false,
                ],
            ])->values()->all(),
        ];
    }

    private function medicineWithExpiry(): \Closure
    {
        return function ($q) {
            $q->select('id', 'medicine_code', 'name', 'strength', 'unit', 'stock_qty', 'reorder_level', 'form', 'category')
                ->withUsableExpiry()
                ->withExpiryFlags();
        };
    }

    private function resolveDoctorForUser(?User $user): ?Doctor
    {
        if (! $user) {
            return null;
        }

        $byUser = Doctor::query()->where('user_id', $user->id)->where('status', 'active')->first();
        if ($byUser) {
            return $byUser;
        }

        if ($user->email) {
            $byEmail = Doctor::query()->where('email', $user->email)->where('status', 'active')->first();
            if ($byEmail) {
                if (! $byEmail->user_id) {
                    $byEmail->update(['user_id' => $user->id]);
                }

                return $byEmail;
            }
        }

        return Doctor::query()
            ->where('status', 'active')
            ->where('full_name', $user->name)
            ->first();
    }

    private function nextCode(): string
    {
        $year = now()->format('Y');
        $prefix = "RX-{$year}-";
        $latest = MedicinePrescription::query()
            ->where('prescription_code', 'like', $prefix.'%')
            ->where('prescription_code', 'not like', $prefix.'DEMO')
            ->where('prescription_code', 'not like', $prefix.'HW%')
            ->orderByDesc('id')
            ->value('prescription_code');

        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }

    private function nextDispenseCode(): string
    {
        $year = now()->format('Y');
        $prefix = "DSP-{$year}-";
        $latest = MedicineDispense::query()
            ->where('dispense_code', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('dispense_code');

        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
