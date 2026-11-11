<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class InventoryItemController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = InventoryItem::query()->latest();

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($category = $request->get('category')) {
            $query->where('category', $category);
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('item_code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%");
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (InventoryItem $i) => $this->payload($i)),
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
            'category' => ['nullable', Rule::in(['kitchen', 'general', 'cleaning', 'medical_supply', 'other'])],
            'unit' => ['nullable', 'string', 'max:30'],
            'stock_qty' => ['nullable', 'numeric', 'min:0'],
            'reorder_level' => ['nullable', 'numeric', 'min:0'],
            'unit_cost' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);

        $item = InventoryItem::query()->create([
            'item_code' => $this->nextCode(),
            'name' => $data['name'],
            'category' => $data['category'] ?? 'general',
            'unit' => $data['unit'] ?? 'unit',
            'stock_qty' => $data['stock_qty'] ?? 0,
            'reorder_level' => $data['reorder_level'] ?? 10,
            'unit_cost' => $data['unit_cost'] ?? 0,
            'status' => $data['status'] ?? 'active',
            'created_by' => $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Inventory item created',
            'data' => $this->payload($item),
        ], 201);
    }

    public function update(Request $request, InventoryItem $inventoryItem): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'category' => ['nullable', Rule::in(['kitchen', 'general', 'cleaning', 'medical_supply', 'other'])],
            'unit' => ['nullable', 'string', 'max:30'],
            'reorder_level' => ['nullable', 'numeric', 'min:0'],
            'unit_cost' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);

        $inventoryItem->update($data);

        return response()->json([
            'message' => 'Inventory item updated',
            'data' => $this->payload($inventoryItem->fresh()),
        ]);
    }

    private function payload(InventoryItem $item): array
    {
        return [
            'id' => $item->id,
            'item_code' => $item->item_code,
            'name' => $item->name,
            'category' => $item->category,
            'unit' => $item->unit,
            'stock_qty' => $item->stock_qty,
            'reorder_level' => $item->reorder_level,
            'unit_cost' => $item->unit_cost,
            'low_stock' => $item->stock_qty <= $item->reorder_level,
            'status' => $item->status,
        ];
    }

    private function nextCode(): string
    {
        $prefix = 'INV-';
        $latest = InventoryItem::query()
            ->where('item_code', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('item_code');

        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
