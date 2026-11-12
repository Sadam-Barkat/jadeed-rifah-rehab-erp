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

class MedicineController extends Controller
{
    public const FORMS = [
        'tablet',
        'capsule',
        'syrup',
        'injection',
        'drops',
        'cream',
        'ointment',
        'inhaler',
        'powder',
        'suspension',
        'ampoule',
        'other',
    ];

    public const UNITS = [
        'tablet',
        'capsule',
        'ml',
        'bottle',
        'strip',
        'box',
        'vial',
        'ampoule',
        'tube',
        'sachet',
        'unit',
    ];

    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 100);

        $query = Medicine::query()
            ->with('creator:id,name,staff_code')
            ->latest();

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($createdBy = $request->integer('created_by')) {
            $query->where('created_by', $createdBy);
        }

        if ($form = $request->get('form')) {
            $query->where('form', $form);
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('medicine_code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%")
                    ->orWhere('generic_name', 'like', "%{$search}%")
                    ->orWhere('manufacturer', 'like', "%{$search}%");
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (Medicine $m) => $this->payload($m)),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'forms' => self::FORMS,
                'units' => self::UNITS,
                'staff' => $this->staffOptions(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'generic_name' => ['nullable', 'string', 'max:255'],
            'form' => ['required', Rule::in(self::FORMS)],
            'strength' => ['nullable', 'string', 'max:50'],
            'unit' => ['required', Rule::in(self::UNITS)],
            'manufacturer' => ['nullable', 'string', 'max:150'],
            'stock_qty' => ['nullable', 'integer', 'min:0'],
            'reorder_level' => ['nullable', 'integer', 'min:0'],
            'unit_price' => ['nullable', 'numeric', 'min:0'],
            'batch_no' => ['nullable', 'string', 'max:80'],
            'expiry_date' => ['nullable', 'date'],
            'supplier' => ['nullable', 'string', 'max:150'],
            'reference' => ['nullable', 'string', 'max:150'],
            'notes' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);

        $medicine = DB::transaction(function () use ($request, $data) {
            $opening = (int) ($data['stock_qty'] ?? 0);

            $medicine = Medicine::query()->create([
                'medicine_code' => $this->nextCode(),
                'name' => $data['name'],
                'generic_name' => $data['generic_name'] ?? null,
                'form' => $data['form'],
                'strength' => $data['strength'] ?? null,
                'unit' => $data['unit'],
                'manufacturer' => $data['manufacturer'] ?? null,
                'stock_qty' => $opening,
                'reorder_level' => $data['reorder_level'] ?? 10,
                'unit_price' => $data['unit_price'] ?? 0,
                'status' => $data['status'] ?? 'active',
                'created_by' => $request->user()->id,
            ]);

            if ($opening > 0) {
                MedicineMovement::query()->create([
                    'movement_code' => $this->nextMovementCode(),
                    'medicine_id' => $medicine->id,
                    'type' => 'in',
                    'quantity' => $opening,
                    'batch_no' => $data['batch_no'] ?? null,
                    'expiry_date' => $data['expiry_date'] ?? null,
                    'supplier' => $data['supplier'] ?? null,
                    'unit_cost' => $data['unit_price'] ?? null,
                    'reference' => $data['reference'] ?? null,
                    'notes' => $data['notes'] ?? 'Opening stock',
                    'moved_at' => now(),
                    'created_by' => $request->user()->id,
                ]);
            }

            return $medicine->load('creator:id,name,staff_code');
        });

        return response()->json([
            'message' => 'Medicine added',
            'data' => $this->payload($medicine),
        ], 201);
    }

    public function update(Request $request, Medicine $medicine): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'generic_name' => ['nullable', 'string', 'max:255'],
            'form' => ['nullable', Rule::in(self::FORMS)],
            'strength' => ['nullable', 'string', 'max:50'],
            'unit' => ['nullable', Rule::in(self::UNITS)],
            'manufacturer' => ['nullable', 'string', 'max:150'],
            'reorder_level' => ['nullable', 'integer', 'min:0'],
            'unit_price' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);

        $medicine->update($data);

        return response()->json([
            'message' => 'Medicine updated',
            'data' => $this->payload($medicine->fresh()->load('creator:id,name,staff_code')),
        ]);
    }

    private function payload(Medicine $medicine): array
    {
        return [
            'id' => $medicine->id,
            'medicine_code' => $medicine->medicine_code,
            'name' => $medicine->name,
            'generic_name' => $medicine->generic_name,
            'form' => $medicine->form,
            'strength' => $medicine->strength,
            'unit' => $medicine->unit,
            'manufacturer' => $medicine->manufacturer,
            'stock_qty' => $medicine->stock_qty,
            'reorder_level' => $medicine->reorder_level,
            'unit_price' => $medicine->unit_price,
            'low_stock' => $medicine->stock_qty <= $medicine->reorder_level,
            'status' => $medicine->status,
            'recorded_by' => $medicine->creator?->name,
            'recorded_by_id' => $medicine->created_by,
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
        $prefix = 'MED-';
        $latest = Medicine::query()
            ->where('medicine_code', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('medicine_code');

        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }

    private function nextMovementCode(): string
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
