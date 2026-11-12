<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Services\InventoryCapacitySync;
use App\Support\SecureUpload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class InventoryItemController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 100);

        $query = InventoryItem::query()
            ->with('creator:id,name,staff_code')
            ->latest();

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($category = $request->get('category')) {
            $query->where('category', $category);
        }

        if ($createdBy = $request->integer('created_by')) {
            $query->where('created_by', $createdBy);
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('item_code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%")
                    ->orWhere('supplier', 'like', "%{$search}%");
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
                'categories' => InventoryItem::CATEGORIES,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'category' => ['nullable', Rule::in(InventoryItem::CATEGORIES)],
            'unit' => ['nullable', 'string', 'max:30'],
            'stock_qty' => ['nullable', 'numeric', 'min:0'],
            'reorder_level' => ['nullable', 'numeric', 'min:0'],
            'unit_cost' => ['nullable', 'numeric', 'min:0'],
            'supplier' => ['nullable', 'string', 'max:150'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'bill_image' => ['nullable', 'file', 'max:5120', 'mimes:jpg,jpeg,png,webp,pdf'],
        ]);

        $billPath = null;
        if ($request->hasFile('bill_image')) {
            $billPath = SecureUpload::storeBillImage($request->file('bill_image'), 'inventory-bills');
        }

        $sync = ['beds_added' => 0, 'beds_removed' => 0];

        $item = DB::transaction(function () use ($request, $data, $billPath, &$sync) {
            $item = InventoryItem::query()->create([
                'item_code' => $this->nextCode(),
                'name' => $data['name'],
                'category' => $data['category'] ?? 'general',
                'unit' => $data['unit'] ?? 'unit',
                'stock_qty' => $data['stock_qty'] ?? 0,
                'reorder_level' => $data['reorder_level'] ?? 10,
                'unit_cost' => $data['unit_cost'] ?? 0,
                'supplier' => $data['supplier'] ?? null,
                'bill_image_path' => $billPath,
                'status' => $data['status'] ?? 'active',
                'created_by' => $request->user()->id,
            ])->load('creator:id,name,staff_code');

            $opening = (float) ($data['stock_qty'] ?? 0);
            if ($opening > 0) {
                $sync = app(InventoryCapacitySync::class)->syncItemChange($item, $opening, 0);
            }

            return $item;
        });

        $message = 'Inventory item created';
        if (($sync['beds_added'] ?? 0) > 0) {
            $message .= " · {$sync['beds_added']} bed(s) added to Beds";
        }

        return response()->json([
            'message' => $message,
            'data' => $this->payload($item),
            'sync' => $sync,
        ], 201);
    }

    public function update(Request $request, InventoryItem $inventoryItem): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'category' => ['nullable', Rule::in(InventoryItem::CATEGORIES)],
            'unit' => ['nullable', 'string', 'max:30'],
            'reorder_level' => ['nullable', 'numeric', 'min:0'],
            'unit_cost' => ['nullable', 'numeric', 'min:0'],
            'supplier' => ['nullable', 'string', 'max:150'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'bill_image' => ['nullable', 'file', 'max:5120', 'mimes:jpg,jpeg,png,webp,pdf'],
        ]);

        if ($request->hasFile('bill_image')) {
            $data['bill_image_path'] = SecureUpload::storeBillImage($request->file('bill_image'), 'inventory-bills');
        }
        unset($data['bill_image']);

        $inventoryItem->update($data);

        return response()->json([
            'message' => 'Inventory item updated',
            'data' => $this->payload($inventoryItem->fresh()->load('creator:id,name,staff_code')),
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
            'supplier' => $item->supplier,
            'bill_image_url' => SecureUpload::url($item->bill_image_path),
            'low_stock' => $item->stock_qty <= $item->reorder_level,
            'status' => $item->status,
            'recorded_by' => $item->creator?->name,
            'recorded_by_id' => $item->created_by,
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
