<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use App\Models\InventoryMovement;
use App\Models\MedicineMovement;
use App\Services\AppNotifier;
use App\Support\SecureUpload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = AppNotification::query()
            ->with(['creator:id,name,photo_path,role_id', 'creator.role:id,slug,name'])
            ->where('user_id', $request->user()->id)
            ->latest('id');

        if ($request->get('unread') === '1') {
            $query->whereNull('read_at');
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (AppNotification $n) => $this->payload($n)),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'unread_count' => AppNotification::query()
                    ->where('user_id', $request->user()->id)
                    ->whereNull('read_at')
                    ->count(),
            ],
        ]);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        $count = AppNotification::query()
            ->where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->count();

        return response()->json(['unread_count' => $count]);
    }

    public function stockReceipt(Request $request, InventoryMovement $movement): JsonResponse
    {
        $link = '/app/inventory-receipts/'.$movement->id;
        $hasNotification = AppNotification::query()
            ->where('user_id', $request->user()->id)
            ->where('type', 'inventory.stock_received')
            ->where('link', $link)
            ->exists();

        if (! $hasNotification || $movement->type !== 'in') {
            return response()->json(['message' => 'Not found'], 404);
        }

        $movement->load([
            'item:id,item_code,name,unit,category',
            'creator:id,name',
        ]);
        $extension = strtolower(pathinfo((string) $movement->bill_image_path, PATHINFO_EXTENSION));
        $billType = $extension === 'pdf'
            ? 'application/pdf'
            : (in_array($extension, ['jpg', 'jpeg', 'png', 'webp'], true) ? 'image/'.$extension : null);
        if ($extension === 'jpg') {
            $billType = 'image/jpeg';
        }

        return response()->json([
            'data' => [
                'movement_code' => $movement->movement_code,
                'item' => [
                    'item_code' => $movement->item?->item_code,
                    'name' => $movement->item?->name,
                    'category' => $movement->item?->category,
                ],
                'quantity' => $movement->quantity,
                'unit' => $movement->unit ?: ($movement->item?->unit ?: 'unit'),
                'unit_cost' => $movement->unit_cost,
                'total_cost' => round((float) $movement->quantity * (float) $movement->unit_cost, 2),
                'supplier' => $movement->issued_to,
                'received_at' => $movement->moved_at?->toDateTimeString(),
                'recorded_by' => $movement->creator?->name,
                'notes' => $movement->notes,
                'bill_image_url' => SecureUpload::url($movement->bill_image_path),
                'bill_image_type' => $billType,
            ],
        ]);
    }

    public function medicineReceipt(Request $request, MedicineMovement $movement): JsonResponse
    {
        $link = '/app/medicine-receipts/'.$movement->id;
        $hasNotification = AppNotification::query()
            ->where('user_id', $request->user()->id)
            ->where('type', 'pharmacy.stock_received')
            ->where(function ($q) use ($link, $movement) {
                $q->where('link', $link)
                    ->orWhere('link', 'like', '%/medicine-receipts/'.$movement->id);
            })
            ->exists();

        if (! $hasNotification || $movement->type !== 'in') {
            // Also allow if this movement shares a bill with a notified batch head.
            $batchSibling = false;
            if ($movement->bill_image_path) {
                $headIds = AppNotification::query()
                    ->where('user_id', $request->user()->id)
                    ->where('type', 'pharmacy.stock_received')
                    ->get(['meta', 'link'])
                    ->flatMap(function (AppNotification $n) {
                        $meta = is_array($n->meta) ? $n->meta : [];
                        $ids = $meta['medicine_movement_ids'] ?? [];
                        if (! empty($meta['medicine_movement_id'])) {
                            $ids[] = $meta['medicine_movement_id'];
                        }
                        if (preg_match('#/medicine-receipts/(\d+)#', (string) $n->link, $m)) {
                            $ids[] = (int) $m[1];
                        }

                        return $ids;
                    })
                    ->map(fn ($id) => (int) $id)
                    ->unique()
                    ->values();

                if ($headIds->isNotEmpty()) {
                    $batchSibling = MedicineMovement::query()
                        ->whereIn('id', $headIds->all())
                        ->where('bill_image_path', $movement->bill_image_path)
                        ->exists()
                        || $headIds->contains((int) $movement->id);
                }
            }

            if (! $batchSibling) {
                return response()->json(['message' => 'Not found'], 404);
            }
        }

        $movements = MedicineMovement::query()
            ->with(['medicine:id,medicine_code,name,strength,unit,category,form', 'creator:id,name'])
            ->where('type', 'in')
            ->when(
                $movement->bill_image_path,
                fn ($q) => $q->where('bill_image_path', $movement->bill_image_path),
                fn ($q) => $q->where('id', $movement->id)
            )
            ->orderBy('id')
            ->get();

        if ($movements->isEmpty()) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $first = $movements->first();
        $extension = strtolower(pathinfo((string) $first->bill_image_path, PATHINFO_EXTENSION));
        $billType = $extension === 'pdf'
            ? 'application/pdf'
            : (in_array($extension, ['jpg', 'jpeg', 'png', 'webp'], true) ? 'image/'.$extension : null);
        if ($extension === 'jpg') {
            $billType = 'image/jpeg';
        }

        $items = $movements->map(function (MedicineMovement $row) {
            return [
                'movement_code' => $row->movement_code,
                'medicine_code' => $row->medicine?->medicine_code,
                'name' => $row->medicine?->name,
                'strength' => $row->medicine?->strength,
                'category' => $row->medicine?->category,
                'form' => $row->medicine?->form,
                'quantity' => $row->quantity,
                'unit' => $row->medicine?->unit ?: 'unit',
                'unit_cost' => $row->unit_cost,
                'total_cost' => round((float) $row->quantity * (float) $row->unit_cost, 2),
                'batch_no' => $row->batch_no,
                'expiry_date' => $row->expiry_date?->toDateString(),
                'supplier' => $row->supplier,
            ];
        })->values();

        return response()->json([
            'data' => [
                'receipt_id' => $first->id,
                'items' => $items,
                'item_count' => $items->count(),
                'total_cost' => round($items->sum('total_cost'), 2),
                'supplier' => $items->pluck('supplier')->filter()->unique()->values()->implode(', ') ?: null,
                'received_at' => $first->moved_at?->toDateTimeString(),
                'recorded_by' => $first->creator?->name,
                'notes' => $first->notes,
                'bill_image_url' => SecureUpload::url($first->bill_image_path),
                'bill_image_type' => $billType,
            ],
        ]);
    }

    public function markRead(Request $request, AppNotification $notification): JsonResponse
    {
        if ($notification->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        if (! $notification->read_at) {
            $notification->update(['read_at' => now()]);
        }

        return response()->json([
            'message' => 'Marked as read',
            'data' => $this->payload(
                $notification->fresh()->loadMissing(['creator:id,name,photo_path,role_id', 'creator.role:id,slug,name'])
            ),
        ]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        AppNotification::query()
            ->where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['message' => 'All marked as read', 'unread_count' => 0]);
    }

    private function payload(AppNotification $n): array
    {
        $creator = $n->creator;
        $name = $creator?->name ?: 'System';
        $initial = mb_strtoupper(mb_substr(trim($name), 0, 1)) ?: 'S';
        $meta = is_array($n->meta) ? $n->meta : [];
        $department = $meta['department']
            ?? AppNotifier::departmentLabel($creator?->role?->slug);

        return [
            'id' => $n->id,
            'type' => $n->type,
            'title' => $n->title,
            'body' => $n->body,
            'link' => $this->resolveLink($n->link, $meta),
            'department' => $department,
            'meta' => $meta,
            'is_read' => (bool) $n->read_at,
            'read_at' => $n->read_at?->toDateTimeString(),
            'created_at' => $n->created_at?->toDateTimeString(),
            'sender' => [
                'id' => $creator?->id,
                'name' => $name,
                'initial' => $initial,
                'department' => $department,
                'photo_url' => SecureUpload::url($creator?->photo_path),
            ],
        ];
    }

    /**
     * Keep old notifications openable after UI route changes
     * (e.g. Plans tab removed → fee plan detail page).
     *
     * @param  array<string, mixed>  $meta
     */
    private function resolveLink(?string $link, array $meta): ?string
    {
        $feePlanId = (int) ($meta['fee_plan_id'] ?? 0);
        if ($feePlanId > 0) {
            return '/app/fee-plans/'.$feePlanId;
        }

        $paymentId = (int) ($meta['payment_id'] ?? 0);
        if ($paymentId > 0) {
            return '/app/payments/'.$paymentId;
        }

        $patientId = (int) ($meta['patient_id'] ?? 0);
        $link = trim((string) $link);

        if ($patientId > 0) {
            if (str_contains($link, 'billing') || str_contains($link, 'fees=create')) {
                return '/app/billing?tab=fees&fees=create&patient_id='.$patientId;
            }

            // Admit request → patient detail (Admit button).
            if (
                $link === ''
                || str_contains($link, 'management')
                || str_contains($link, 'admission')
                || str_contains($link, '/patients/')
            ) {
                return '/app/patients/'.$patientId;
            }
        }

        if ($link === '') {
            return null;
        }

        // Legacy admin Plans tab → cannot open a specific plan without id.
        if (str_contains($link, 'tab=plans')) {
            return '/app/admin/finance';
        }

        if ($link === '/app/billing' || str_ends_with($link, '/billing')) {
            $suffix = $patientId > 0 ? '&patient_id='.$patientId : '';

            return '/app/billing?tab=fees&fees=create'.$suffix;
        }

        return $link;
    }
}
