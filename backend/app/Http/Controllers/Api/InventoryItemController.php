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
        $isCook = $request->user()?->role?->slug === 'cook';

        $query = InventoryItem::query()
            ->with('creator:id,name,staff_code')
            ->latest();

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($isCook) {
            $query->where('category', 'kitchen');
        } elseif ($category = $request->get('category')) {
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
        $canViewStockAlerts = in_array($request->user()->role?->slug, ['admin', 'inventory-manager'], true);

        return response()->json([
            'data' => collect($paginator->items())->map(
                fn (InventoryItem $item) => $this->payload($item, $canViewStockAlerts)
            ),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'categories' => $this->categoryOptions(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($request->user()?->role?->slug === 'cook') {
            return response()->json(['message' => 'Cooks can only record kitchen stock use.'], 403);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:60'],
            'unit' => ['nullable', 'string', 'max:30'],
            'stock_qty' => ['nullable', 'numeric', 'min:0'],
            'unit_cost' => ['nullable', 'numeric', 'min:0'],
            'supplier' => ['nullable', 'string', 'max:150'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'bill_image' => SecureUpload::imageRules(false, true),
        ], SecureUpload::maxMessages([
            'bill_image' => 'Bill image',
        ]));

        $unit = $data['unit'] ?? 'unit';
        $openingStock = (float) ($data['stock_qty'] ?? 0);
        if (InventoryItem::isCountUnit($unit) && floor($openingStock) !== $openingStock) {
            return response()->json(['message' => "Use whole numbers for {$unit}."], 422);
        }

        $billPath = null;
        if ($request->hasFile('bill_image')) {
            $billPath = SecureUpload::storeBillImage($request->file('bill_image'), 'inventory-bills');
        }

        $sync = ['beds_added' => 0, 'beds_removed' => 0];

        $item = DB::transaction(function () use ($request, $data, $billPath, &$sync) {
            $category = InventoryItem::normalizeCategory($data['category'] ?? 'general');
            $item = InventoryItem::query()->create([
                'item_code' => $this->nextCode(),
                'name' => $data['name'],
                'category' => $category,
                'unit' => $data['unit'] ?? 'unit',
                'stock_qty' => $data['stock_qty'] ?? 0,
                'reorder_level' => InventoryItem::DEFAULT_REORDER_LEVEL,
                'track_reorder' => true,
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
            'data' => $this->payload(
                $item,
                in_array($request->user()->role?->slug, ['admin', 'inventory-manager'], true)
            ),
            'sync' => $sync,
        ], 201);
    }

    public function update(Request $request, InventoryItem $inventoryItem): JsonResponse
    {
        if ($request->user()?->role?->slug === 'cook') {
            return response()->json(['message' => 'Cooks can only record kitchen stock use.'], 403);
        }

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:60'],
            'unit' => ['nullable', 'string', 'max:30'],
            'unit_cost' => ['nullable', 'numeric', 'min:0'],
            'supplier' => ['nullable', 'string', 'max:150'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'bill_image' => SecureUpload::imageRules(false, true),
        ], SecureUpload::maxMessages([
            'bill_image' => 'Bill image',
        ]));

        if ($request->hasFile('bill_image')) {
            $data['bill_image_path'] = SecureUpload::storeBillImage($request->file('bill_image'), 'inventory-bills');
        }
        unset($data['bill_image']);

        if (array_key_exists('category', $data)) {
            $data['category'] = InventoryItem::normalizeCategory($data['category']);
        }

        $inventoryItem->update($data);

        return response()->json([
            'message' => 'Inventory item updated',
            'data' => $this->payload(
                $inventoryItem->fresh()->load('creator:id,name,staff_code'),
                in_array($request->user()->role?->slug, ['admin', 'inventory-manager'], true)
            ),
        ]);
    }

    private function payload(InventoryItem $item, bool $canViewStockAlerts = false): array
    {
        $payload = [
            'id' => $item->id,
            'item_code' => $item->item_code,
            'name' => $item->name,
            'category' => $item->category,
            'category_label' => InventoryItem::categoryLabel($item->category),
            'unit' => $item->unit,
            'stock_qty' => $item->stock_qty,
            'reorder_level' => $item->reorder_level,
            'track_reorder' => (bool) $item->track_reorder,
            'unit_cost' => $item->unit_cost,
            'supplier' => $item->supplier,
            'bill_image_url' => SecureUpload::url($item->bill_image_path),
            'status' => $item->status,
            'recorded_by' => $item->creator?->name,
            'recorded_by_id' => $item->created_by,
        ];

        if ($canViewStockAlerts) {
            $payload['stock_status'] = $item->stockStatusLabel();
            $payload['low_stock'] = $item->isLowStock();
        }

        return $payload;
    }

    private function categoryOptions(): array
    {
        $fromDb = InventoryItem::query()
            ->whereNotNull('category')
            ->where('category', '!=', '')
            ->distinct()
            ->orderBy('category')
            ->pluck('category')
            ->all();

        $keys = collect(InventoryItem::CATEGORIES)
            ->merge($fromDb)
            ->unique()
            ->values();

        return $keys->map(fn (string $key) => [
            'value' => $key,
            'label' => InventoryItem::categoryLabel($key),
        ])->all();
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
