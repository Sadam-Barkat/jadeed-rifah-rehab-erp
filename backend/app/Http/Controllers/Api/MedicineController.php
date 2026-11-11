<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Medicine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MedicineController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = Medicine::query()->latest();

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('medicine_code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%")
                    ->orWhere('generic_name', 'like', "%{$search}%");
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
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'generic_name' => ['nullable', 'string', 'max:255'],
            'form' => ['nullable', 'string', 'max:50'],
            'strength' => ['nullable', 'string', 'max:50'],
            'unit' => ['nullable', 'string', 'max:30'],
            'stock_qty' => ['nullable', 'integer', 'min:0'],
            'reorder_level' => ['nullable', 'integer', 'min:0'],
            'unit_price' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);

        $medicine = Medicine::query()->create([
            'medicine_code' => $this->nextCode(),
            'name' => $data['name'],
            'generic_name' => $data['generic_name'] ?? null,
            'form' => $data['form'] ?? null,
            'strength' => $data['strength'] ?? null,
            'unit' => $data['unit'] ?? 'unit',
            'stock_qty' => $data['stock_qty'] ?? 0,
            'reorder_level' => $data['reorder_level'] ?? 10,
            'unit_price' => $data['unit_price'] ?? 0,
            'status' => $data['status'] ?? 'active',
            'created_by' => $request->user()->id,
        ]);

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
            'form' => ['nullable', 'string', 'max:50'],
            'strength' => ['nullable', 'string', 'max:50'],
            'unit' => ['nullable', 'string', 'max:30'],
            'stock_qty' => ['nullable', 'integer', 'min:0'],
            'reorder_level' => ['nullable', 'integer', 'min:0'],
            'unit_price' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);

        $medicine->update($data);

        return response()->json([
            'message' => 'Medicine updated',
            'data' => $this->payload($medicine->fresh()),
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
            'stock_qty' => $medicine->stock_qty,
            'reorder_level' => $medicine->reorder_level,
            'unit_price' => $medicine->unit_price,
            'low_stock' => $medicine->stock_qty <= $medicine->reorder_level,
            'status' => $medicine->status,
        ];
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
}
