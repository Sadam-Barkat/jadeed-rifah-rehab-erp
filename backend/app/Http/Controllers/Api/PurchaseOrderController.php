<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Supplier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PurchaseOrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = PurchaseOrder::query()
            ->with(['supplier', 'items.inventoryItem'])
            ->latest('ordered_at');

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (PurchaseOrder $po) => $this->payload($po)),
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
            'supplier_id' => ['required', 'exists:suppliers,id'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.inventory_item_id' => ['nullable', 'exists:inventory_items,id'],
            'items.*.item_name' => ['nullable', 'string', 'max:255'],
            'items.*.unit' => ['nullable', 'string', 'max:30'],
            'items.*.quantity' => ['required', 'numeric', 'min:0.01'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
        ]);

        $supplier = Supplier::query()->findOrFail($data['supplier_id']);
        if ($supplier->status !== 'active') {
            return response()->json(['message' => 'Supplier is inactive.'], 422);
        }

        $po = DB::transaction(function () use ($request, $data) {
            $total = 0;
            $lines = [];

            foreach ($data['items'] as $row) {
                $inv = null;
                if (! empty($row['inventory_item_id'])) {
                    $inv = InventoryItem::query()->find($row['inventory_item_id']);
                }

                $qty = (float) $row['quantity'];
                $price = (float) $row['unit_price'];
                $lineTotal = round($qty * $price, 2);
                $total += $lineTotal;

                $lines[] = [
                    'inventory_item_id' => $inv?->id,
                    'item_name' => $row['item_name'] ?? $inv?->name ?? 'Item',
                    'unit' => $row['unit'] ?? $inv?->unit ?? 'unit',
                    'quantity' => $qty,
                    'unit_price' => $price,
                    'line_total' => $lineTotal,
                ];
            }

            $po = PurchaseOrder::query()->create([
                'po_code' => $this->nextCode(),
                'supplier_id' => $data['supplier_id'],
                'ordered_at' => now(),
                'total_amount' => round($total, 2),
                'status' => 'ordered',
                'notes' => $data['notes'] ?? null,
                'created_by' => $request->user()->id,
            ]);

            foreach ($lines as $line) {
                PurchaseOrderItem::query()->create([
                    'purchase_order_id' => $po->id,
                    ...$line,
                ]);
            }

            return $po->load(['supplier', 'items.inventoryItem']);
        });

        return response()->json([
            'message' => 'Purchase order created',
            'data' => $this->payload($po),
        ], 201);
    }

    public function receive(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        if ($purchaseOrder->status !== 'ordered') {
            return response()->json(['message' => 'Only ordered POs can be received.'], 422);
        }

        $po = DB::transaction(function () use ($request, $purchaseOrder) {
            $purchaseOrder->load('items');

            foreach ($purchaseOrder->items as $line) {
                if (! $line->inventory_item_id) {
                    continue;
                }

                $item = InventoryItem::query()->lockForUpdate()->find($line->inventory_item_id);
                if (! $item) {
                    continue;
                }

                $item->update([
                    'stock_qty' => round((float) $item->stock_qty + (float) $line->quantity, 2),
                ]);

                InventoryMovement::query()->create([
                    'movement_code' => $this->nextMovementCode(),
                    'inventory_item_id' => $item->id,
                    'type' => 'in',
                    'quantity' => $line->quantity,
                    'reference' => $purchaseOrder->po_code,
                    'notes' => 'Purchase receive',
                    'moved_at' => now(),
                    'created_by' => $request->user()->id,
                ]);
            }

            $purchaseOrder->update([
                'status' => 'received',
                'received_at' => now(),
            ]);

            return $purchaseOrder->fresh()->load(['supplier', 'items.inventoryItem']);
        });

        return response()->json([
            'message' => 'Purchase order received',
            'data' => $this->payload($po),
        ]);
    }

    private function payload(PurchaseOrder $po): array
    {
        return [
            'id' => $po->id,
            'po_code' => $po->po_code,
            'status' => $po->status,
            'ordered_at' => $po->ordered_at?->toDateTimeString(),
            'received_at' => $po->received_at?->toDateTimeString(),
            'total_amount' => $po->total_amount,
            'notes' => $po->notes,
            'supplier' => [
                'id' => $po->supplier?->id,
                'supplier_code' => $po->supplier?->supplier_code,
                'name' => $po->supplier?->name,
            ],
            'items' => $po->items->map(fn (PurchaseOrderItem $i) => [
                'id' => $i->id,
                'item_name' => $i->item_name,
                'unit' => $i->unit,
                'quantity' => $i->quantity,
                'unit_price' => $i->unit_price,
                'line_total' => $i->line_total,
                'inventory_item_id' => $i->inventory_item_id,
            ])->values(),
        ];
    }

    private function nextCode(): string
    {
        $year = now()->format('Y');
        $prefix = "PO-{$year}-";
        $latest = PurchaseOrder::query()
            ->where('po_code', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('po_code');

        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }

    private function nextMovementCode(): string
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
