<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class InventoryMovementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = InventoryMovement::query()
            ->with('item')
            ->latest('moved_at');

        if ($type = $request->get('type')) {
            $query->where('type', $type);
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (InventoryMovement $m) => $this->payload($m)),
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
            'inventory_item_id' => ['required', 'exists:inventory_items,id'],
            'type' => ['required', Rule::in(['in', 'out', 'adjust'])],
            'quantity' => ['required', 'numeric', 'min:0.01'],
            'reference' => ['nullable', 'string', 'max:150'],
            'notes' => ['nullable', 'string'],
            'moved_at' => ['nullable', 'date'],
        ]);

        try {
            $movement = DB::transaction(function () use ($request, $data) {
                $item = InventoryItem::query()->lockForUpdate()->findOrFail($data['inventory_item_id']);

                if ($item->status !== 'active') {
                    throw new \RuntimeException('Inventory item is inactive.');
                }

                $qty = (float) $data['quantity'];
                $stock = (float) $item->stock_qty;

                if ($data['type'] === 'in') {
                    $stock += $qty;
                } elseif ($data['type'] === 'out') {
                    if ($stock < $qty) {
                        throw new \RuntimeException("Insufficient stock. Available: {$item->stock_qty}");
                    }
                    $stock -= $qty;
                } else {
                    $stock = $qty;
                }

                $item->update(['stock_qty' => round($stock, 2)]);

                return InventoryMovement::query()->create([
                    'movement_code' => $this->nextCode(),
                    'inventory_item_id' => $item->id,
                    'type' => $data['type'],
                    'quantity' => $qty,
                    'reference' => $data['reference'] ?? null,
                    'notes' => $data['notes'] ?? null,
                    'moved_at' => $data['moved_at'] ?? now(),
                    'created_by' => $request->user()->id,
                ])->load('item');
            });
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => 'Stock movement recorded',
            'data' => $this->payload($movement),
        ], 201);
    }

    private function payload(InventoryMovement $movement): array
    {
        return [
            'id' => $movement->id,
            'movement_code' => $movement->movement_code,
            'type' => $movement->type,
            'quantity' => $movement->quantity,
            'reference' => $movement->reference,
            'notes' => $movement->notes,
            'moved_at' => $movement->moved_at?->toDateTimeString(),
            'item' => [
                'id' => $movement->item?->id,
                'item_code' => $movement->item?->item_code,
                'name' => $movement->item?->name,
                'unit' => $movement->item?->unit,
                'stock_qty' => $movement->item?->stock_qty,
                'category' => $movement->item?->category,
            ],
        ];
    }

    private function nextCode(): string
    {
        $year = now()->format('Y');
        $prefix = "MV-{$year}-";
        $latest = InventoryMovement::query()
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
