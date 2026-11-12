<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Medicine;
use App\Models\MedicineMovement;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class MedicineMovementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 100);

        $query = MedicineMovement::query()
            ->with(['medicine:id,medicine_code,name,strength,form,unit,stock_qty', 'creator:id,name,staff_code'])
            ->latest('moved_at');

        if ($type = $request->get('type')) {
            $query->where('type', $type);
        }
        if ($medicineId = $request->integer('medicine_id')) {
            $query->where('medicine_id', $medicineId);
        }
        if ($createdBy = $request->integer('created_by')) {
            $query->where('created_by', $createdBy);
        }
        if ($q = trim((string) $request->get('q', ''))) {
            $query->where(function ($inner) use ($q) {
                $inner->where('movement_code', 'like', "%{$q}%")
                    ->orWhere('batch_no', 'like', "%{$q}%")
                    ->orWhere('supplier', 'like', "%{$q}%")
                    ->orWhere('reference', 'like', "%{$q}%")
                    ->orWhereHas('medicine', function ($m) use ($q) {
                        $m->where('name', 'like', "%{$q}%")
                            ->orWhere('medicine_code', 'like', "%{$q}%");
                    })
                    ->orWhereHas('creator', function ($u) use ($q) {
                        $u->where('name', 'like', "%{$q}%");
                    });
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (MedicineMovement $m) => $this->payload($m)),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'staff' => $this->staffOptions(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'medicine_id' => ['required', 'exists:medicines,id'],
            'type' => ['required', Rule::in(['in', 'out', 'adjust'])],
            'quantity' => ['required', 'integer', 'min:1'],
            'batch_no' => ['nullable', 'string', 'max:80'],
            'expiry_date' => ['nullable', 'date'],
            'supplier' => ['nullable', 'string', 'max:150'],
            'unit_cost' => ['nullable', 'numeric', 'min:0'],
            'reference' => ['nullable', 'string', 'max:150'],
            'notes' => ['nullable', 'string'],
            'moved_at' => ['nullable', 'date'],
        ]);

        try {
            $movement = DB::transaction(function () use ($request, $data) {
                $medicine = Medicine::query()->lockForUpdate()->findOrFail($data['medicine_id']);
                if ($medicine->status !== 'active') {
                    throw new \RuntimeException('Medicine is inactive.');
                }

                $qty = (int) $data['quantity'];
                $stock = (int) $medicine->stock_qty;

                if ($data['type'] === 'in') {
                    $stock += $qty;
                } elseif ($data['type'] === 'out') {
                    if ($stock < $qty) {
                        throw new \RuntimeException("Insufficient stock. Available: {$medicine->stock_qty}");
                    }
                    $stock -= $qty;
                } else {
                    $stock = $qty;
                }

                $updates = ['stock_qty' => $stock];
                if (($data['type'] === 'in' || $data['type'] === 'adjust') && isset($data['unit_cost']) && $data['unit_cost'] !== null) {
                    $updates['unit_price'] = $data['unit_cost'];
                }
                $medicine->update($updates);

                return MedicineMovement::query()->create([
                    'movement_code' => $this->nextCode(),
                    'medicine_id' => $medicine->id,
                    'type' => $data['type'],
                    'quantity' => $qty,
                    'batch_no' => $data['batch_no'] ?? null,
                    'expiry_date' => $data['expiry_date'] ?? null,
                    'supplier' => $data['supplier'] ?? null,
                    'unit_cost' => $data['unit_cost'] ?? null,
                    'reference' => $data['reference'] ?? null,
                    'notes' => $data['notes'] ?? null,
                    'moved_at' => $data['moved_at'] ?? now(),
                    'created_by' => $request->user()->id,
                ])->load(['medicine', 'creator:id,name,staff_code']);
            });
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => 'Medicine stock movement recorded',
            'data' => $this->payload($movement),
        ], 201);
    }

    private function payload(MedicineMovement $movement): array
    {
        return [
            'id' => $movement->id,
            'movement_code' => $movement->movement_code,
            'type' => $movement->type,
            'quantity' => $movement->quantity,
            'batch_no' => $movement->batch_no,
            'expiry_date' => $movement->expiry_date?->toDateString(),
            'supplier' => $movement->supplier,
            'unit_cost' => $movement->unit_cost,
            'reference' => $movement->reference,
            'notes' => $movement->notes,
            'moved_at' => $movement->moved_at?->toDateTimeString(),
            'recorded_by' => $movement->creator?->name,
            'recorded_by_id' => $movement->created_by,
            'medicine' => [
                'id' => $movement->medicine?->id,
                'medicine_code' => $movement->medicine?->medicine_code,
                'name' => $movement->medicine?->name,
                'strength' => $movement->medicine?->strength,
                'form' => $movement->medicine?->form,
                'unit' => $movement->medicine?->unit,
                'stock_qty' => $movement->medicine?->stock_qty,
            ],
        ];
    }

    private function staffOptions(): array
    {
        return User::query()
            ->where('is_active', true)
            ->whereHas('role', fn ($q) => $q->where('slug', 'pharmacist'))
            ->orderBy('name')
            ->get(['id', 'name', 'staff_code'])
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'staff_code' => $u->staff_code,
            ])
            ->values()
            ->all();
    }

    private function nextCode(): string
    {
        $prefix = 'MM-'.now()->format('Y').'-';
        $latest = MedicineMovement::query()
            ->where('movement_code', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('movement_code');

        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
