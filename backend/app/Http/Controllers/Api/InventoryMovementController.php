<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bed;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\User;
use App\Services\InventoryCapacitySync;
use App\Support\SecureUpload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class InventoryMovementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 100);

        $query = InventoryMovement::query()
            ->with(['item:id,item_code,name,unit,category,stock_qty', 'creator:id,name,staff_code'])
            ->latest('moved_at');

        if ($type = $request->get('type')) {
            $query->where('type', $type);
        }
        if ($purpose = $request->get('purpose')) {
            $query->where('purpose', $purpose);
        }
        if ($department = $request->get('department')) {
            $query->where('department', $department);
        }
        if ($itemId = $request->integer('inventory_item_id')) {
            $query->where('inventory_item_id', $itemId);
        }
        if ($createdBy = $request->integer('created_by')) {
            $query->where('created_by', $createdBy);
        }
        if ($from = $request->get('from')) {
            $query->whereDate('moved_at', '>=', $from);
        }
        if ($to = $request->get('to')) {
            $query->whereDate('moved_at', '<=', $to);
        }
        if ($q = trim((string) $request->get('q', ''))) {
            $query->where(function ($inner) use ($q) {
                $inner->where('movement_code', 'like', "%{$q}%")
                    ->orWhere('issued_to', 'like', "%{$q}%")
                    ->orWhere('used_for', 'like', "%{$q}%")
                    ->orWhere('reference', 'like', "%{$q}%")
                    ->orWhere('notes', 'like', "%{$q}%")
                    ->orWhereHas('item', function ($item) use ($q) {
                        $item->where('name', 'like', "%{$q}%")
                            ->orWhere('item_code', 'like', "%{$q}%");
                    })
                    ->orWhereHas('creator', function ($user) use ($q) {
                        $user->where('name', 'like', "%{$q}%");
                    });
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (InventoryMovement $m) => $this->payload($m)),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'purposes' => InventoryMovement::PURPOSES,
                'departments' => InventoryMovement::DEPARTMENTS,
                'staff' => $this->staffOptions(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'inventory_item_id' => ['required', 'exists:inventory_items,id'],
            'type' => ['required', Rule::in(['in', 'out', 'adjust'])],
            'quantity' => ['nullable', 'numeric', 'min:0.01'],
            'purpose' => ['nullable', Rule::in(InventoryMovement::PURPOSES)],
            'department' => ['nullable', Rule::in(InventoryMovement::DEPARTMENTS)],
            'issued_to' => ['nullable', 'string', 'max:120'],
            'used_for' => ['nullable', 'string', 'max:255'],
            'reference' => ['nullable', 'string', 'max:150'],
            'notes' => ['nullable', 'string'],
            'moved_at' => ['nullable', 'date'],
            'bill_image' => ['nullable', 'file', 'max:5120', 'mimes:jpg,jpeg,png,webp,pdf'],
            'bed_id' => ['nullable', 'integer', 'exists:beds,id'],
            'bed_action' => ['nullable', Rule::in(['maintenance', 'discard'])],
        ]);

        $itemPreview = InventoryItem::query()->findOrFail($data['inventory_item_id']);
        $isBedsItem = $itemPreview->category === 'beds';

        if ($isBedsItem && $data['type'] === 'out') {
            $request->validate([
                'bed_id' => ['required', 'integer', 'exists:beds,id'],
                'bed_action' => ['required', Rule::in(['maintenance', 'discard'])],
            ]);
            $data['quantity'] = 1;
            $data['purpose'] = $data['bed_action'] === 'discard' ? 'waste' : 'maintenance';
            $data['department'] = $data['department'] ?? 'maintenance';
            $data['used_for'] = $data['used_for'] ?? (
                $data['bed_action'] === 'discard' ? 'Bed total discard' : 'Bed maintenance'
            );
        } elseif ($isBedsItem && $data['type'] === 'adjust') {
            return response()->json([
                'message' => 'Beds cannot use Adjust. Use Stock in for new beds, or select a bed for Maintenance / Discard.',
            ], 422);
        } else {
            $request->validate([
                'quantity' => ['required', 'numeric', 'min:0.01'],
                'purpose' => ['required', Rule::in(InventoryMovement::PURPOSES)],
            ]);
            if ($data['type'] === 'out') {
                $request->validate([
                    'used_for' => ['required', 'string', 'max:255'],
                    'department' => ['required', Rule::in(InventoryMovement::DEPARTMENTS)],
                ]);
            }
        }

        $actorName = trim((string) ($request->user()?->name ?? ''));
        if ($data['type'] === 'out') {
            $data['issued_to'] = $actorName !== '' ? $actorName : 'Inventory staff';
        }

        $billPath = null;
        if ($request->hasFile('bill_image') && in_array($data['type'], ['in', 'adjust'], true)) {
            $billPath = SecureUpload::storeBillImage($request->file('bill_image'), 'inventory-bills');
        }

        $sync = ['beds_added' => 0, 'beds_removed' => 0, 'beds_maintenance' => 0];

        try {
            $movement = DB::transaction(function () use ($request, $data, $billPath, $isBedsItem, &$sync) {
                $item = InventoryItem::query()->lockForUpdate()->findOrFail($data['inventory_item_id']);

                if ($item->status !== 'active') {
                    throw new \RuntimeException('Inventory item is inactive.');
                }

                $qty = (float) ($data['quantity'] ?? 1);
                $capacity = app(InventoryCapacitySync::class);

                if ($isBedsItem && $data['type'] === 'out') {
                    $bed = Bed::query()->lockForUpdate()->findOrFail($data['bed_id']);
                    $sync = $capacity->applyBedAction($item, $bed, $data['bed_action']);
                    $data['used_for'] = ($data['bed_action'] === 'discard' ? 'Discard' : 'Maintenance')
                        .' · '.$sync['bed_code'];
                    $data['reference'] = $data['reference'] ?? $sync['bed_code'];
                    // Stock already updated inside discard action; maintenance leaves stock as-is.
                } else {
                    $stock = (float) $item->stock_qty;

                    if ($data['type'] === 'in') {
                        $stock += $qty;
                    } elseif ($data['type'] === 'out') {
                        if ($stock < $qty) {
                            throw new \RuntimeException("Insufficient stock. Available: {$item->stock_qty} {$item->unit}");
                        }
                        $stock -= $qty;
                    } else {
                        $stock = $qty;
                    }

                    $item->update(['stock_qty' => round($stock, 2)]);

                    if ($isBedsItem && $data['type'] === 'in') {
                        $sync = $capacity->syncStockIn($item->fresh(), $qty);
                    }
                }

                return InventoryMovement::query()->create([
                    'movement_code' => $this->nextCode(),
                    'inventory_item_id' => $item->id,
                    'type' => $data['type'],
                    'purpose' => $data['purpose'],
                    'department' => $data['department'] ?? null,
                    'issued_to' => $data['issued_to'] ?? null,
                    'used_for' => $data['used_for'] ?? null,
                    'quantity' => $qty,
                    'unit' => $item->unit,
                    'reference' => $data['reference'] ?? null,
                    'bill_image_path' => $billPath,
                    'notes' => $data['notes'] ?? null,
                    'moved_at' => $data['moved_at'] ?? now(),
                    'created_by' => $request->user()->id,
                ])->load(['item', 'creator:id,name,staff_code']);
            });
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $message = 'Stock movement recorded';
        if (($sync['beds_added'] ?? 0) > 0) {
            $message .= " · {$sync['beds_added']} bed(s) added to Beds";
        }
        if (($sync['beds_maintenance'] ?? 0) > 0) {
            $message .= ' · '.$sync['bed_code'].' set to maintenance';
        }
        if (($sync['beds_removed'] ?? 0) > 0) {
            $message .= ' · '.$sync['bed_code'].' discarded · stock −1';
        }

        return response()->json([
            'message' => $message,
            'data' => $this->payload($movement),
            'sync' => $sync,
        ], 201);
    }

    private function payload(InventoryMovement $movement): array
    {
        $unit = $movement->unit ?: ($movement->item?->unit ?: 'unit');

        return [
            'id' => $movement->id,
            'movement_code' => $movement->movement_code,
            'type' => $movement->type,
            'purpose' => $movement->purpose,
            'department' => $movement->department,
            'issued_to' => $movement->issued_to,
            'used_for' => $movement->used_for,
            'quantity' => $movement->quantity,
            'unit' => $unit,
            'qty_label' => trim(rtrim(rtrim(number_format((float) $movement->quantity, 2, '.', ''), '0'), '.').' '.$unit),
            'reference' => $movement->reference,
            'bill_image_url' => SecureUpload::url($movement->bill_image_path),
            'notes' => $movement->notes,
            'moved_at' => $movement->moved_at?->toDateTimeString(),
            'recorded_by' => $movement->creator?->name,
            'recorded_by_id' => $movement->created_by,
            'recorded_by_code' => $movement->creator?->staff_code,
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

    private function staffOptions(): array
    {
        return User::query()
            ->where('is_active', true)
            ->whereHas('role', fn ($q) => $q->where('slug', 'inventory-manager'))
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
