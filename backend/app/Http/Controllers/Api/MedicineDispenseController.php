<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Admission;
use App\Models\Medicine;
use App\Models\MedicineDispense;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MedicineDispenseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = MedicineDispense::query()
            ->with(['patient', 'admission', 'medicine'])
            ->latest('dispensed_at');

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('dispense_code', 'like', "%{$search}%")
                    ->orWhereHas('patient', function ($pq) use ($search) {
                        $pq->where('patient_code', 'like', "%{$search}%")
                            ->orWhere('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%");
                    })
                    ->orWhereHas('medicine', function ($mq) use ($search) {
                        $mq->where('name', 'like', "%{$search}%")
                            ->orWhere('medicine_code', 'like', "%{$search}%");
                    });
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (MedicineDispense $d) => $this->payload($d)),
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
            'medicine_id' => ['required', 'exists:medicines,id'],
            'quantity' => ['required', 'integer', 'min:1'],
            'dosage' => ['nullable', 'string', 'max:100'],
            'frequency' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string'],
            'dispensed_at' => ['nullable', 'date'],
        ]);

        $admission = Admission::query()->findOrFail($data['admission_id']);
        if ($admission->status !== 'active') {
            return response()->json(['message' => 'Dispense requires an active admission.'], 422);
        }

        try {
            $dispense = DB::transaction(function () use ($request, $data, $admission) {
                $medicine = Medicine::query()->lockForUpdate()->findOrFail($data['medicine_id']);

                if ($medicine->status !== 'active') {
                    throw new \RuntimeException('Medicine is inactive.');
                }

                if ($medicine->stock_qty < $data['quantity']) {
                    throw new \RuntimeException("Insufficient stock. Available: {$medicine->stock_qty}");
                }

                $medicine->update([
                    'stock_qty' => $medicine->stock_qty - $data['quantity'],
                ]);

                return MedicineDispense::query()->create([
                    'dispense_code' => $this->nextCode(),
                    'admission_id' => $admission->id,
                    'patient_id' => $admission->patient_id,
                    'medicine_id' => $medicine->id,
                    'quantity' => $data['quantity'],
                    'dosage' => $data['dosage'] ?? null,
                    'frequency' => $data['frequency'] ?? null,
                    'notes' => $data['notes'] ?? null,
                    'dispensed_at' => $data['dispensed_at'] ?? now(),
                    'status' => 'dispensed',
                    'created_by' => $request->user()->id,
                ])->load(['patient', 'admission', 'medicine']);
            });
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => 'Medicine dispensed',
            'data' => $this->payload($dispense),
        ], 201);
    }

    private function payload(MedicineDispense $dispense): array
    {
        return [
            'id' => $dispense->id,
            'dispense_code' => $dispense->dispense_code,
            'quantity' => $dispense->quantity,
            'dosage' => $dispense->dosage,
            'frequency' => $dispense->frequency,
            'notes' => $dispense->notes,
            'dispensed_at' => $dispense->dispensed_at?->toDateTimeString(),
            'status' => $dispense->status,
            'patient' => [
                'id' => $dispense->patient?->id,
                'patient_code' => $dispense->patient?->patient_code,
                'full_name' => $dispense->patient?->full_name,
            ],
            'admission' => [
                'id' => $dispense->admission?->id,
                'admission_code' => $dispense->admission?->admission_code,
            ],
            'medicine' => [
                'id' => $dispense->medicine?->id,
                'medicine_code' => $dispense->medicine?->medicine_code,
                'name' => $dispense->medicine?->name,
                'strength' => $dispense->medicine?->strength,
                'stock_qty' => $dispense->medicine?->stock_qty,
            ],
        ];
    }

    private function nextCode(): string
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
