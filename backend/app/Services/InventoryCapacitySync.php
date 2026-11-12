<?php

namespace App\Services;

use App\Models\Bed;
use App\Models\InventoryItem;
use App\Models\Room;

/**
 * Beds inventory ↔ beds table:
 * - stock in / opening stock → create available beds
 * - maintenance → mark bed maintenance (stock unchanged)
 * - discard → mark bed discarded + reduce inventory stock by 1
 * Occupied / active-admission beds cannot be maintained or discarded.
 */
class InventoryCapacitySync
{
    public function syncItemChange(InventoryItem $item, float $addedQty, float $removedQty = 0): array
    {
        if ($item->category !== 'beds') {
            return ['beds_added' => 0, 'beds_removed' => 0, 'beds_maintenance' => 0];
        }

        // Beds are never bulk-removed; only discard via selected bed.
        unset($removedQty);

        $added = max(0, (int) floor($addedQty));

        return [
            'beds_added' => $added > 0 ? $this->addBeds($added, $item) : 0,
            'beds_removed' => 0,
            'beds_maintenance' => 0,
        ];
    }

    public function syncStockIn(InventoryItem $item, float $quantity): array
    {
        return $this->syncItemChange($item, $quantity, 0);
    }

    /**
     * @return array{beds_added:int,beds_removed:int,beds_maintenance:int,bed_code:?string,action:?string}
     */
    public function applyBedAction(InventoryItem $item, Bed $bed, string $action): array
    {
        if ($item->category !== 'beds') {
            throw new \RuntimeException('Bed actions are only for inventory items in Beds category.');
        }

        if ($bed->status === 'discarded') {
            throw new \RuntimeException('This bed is already discarded.');
        }

        if ($bed->status === 'occupied' || $bed->admissions()->where('status', 'active')->exists()) {
            throw new \RuntimeException('Bed is in use by a patient. Discharge the patient first.');
        }

        if ($action === 'maintenance') {
            if ($bed->status === 'maintenance') {
                throw new \RuntimeException('Bed is already on maintenance.');
            }

            $bed->update([
                'status' => 'maintenance',
                'notes' => trim(($bed->notes ? $bed->notes.' · ' : '').'Inventory maintenance'),
            ]);

            return [
                'beds_added' => 0,
                'beds_removed' => 0,
                'beds_maintenance' => 1,
                'bed_code' => $bed->bed_code,
                'action' => 'maintenance',
            ];
        }

        if ($action === 'discard') {
            $bed->update([
                'status' => 'discarded',
                'notes' => trim(($bed->notes ? $bed->notes.' · ' : '').'Inventory discard'),
            ]);

            $stock = max(0, (float) $item->stock_qty - 1);
            $item->update(['stock_qty' => round($stock, 2)]);

            return [
                'beds_added' => 0,
                'beds_removed' => 1,
                'beds_maintenance' => 0,
                'bed_code' => $bed->bed_code,
                'action' => 'discard',
            ];
        }

        throw new \RuntimeException('Invalid bed action. Use maintenance or discard.');
    }

    private function inventoryRoom(): Room
    {
        return Room::query()->firstOrCreate(
            ['code' => 'INV'],
            [
                'name' => 'Inventory Beds',
                'floor' => '—',
                'room_type' => 'Inventory',
                'status' => 'active',
                'notes' => 'Auto-created beds from Inventory stock in',
            ]
        );
    }

    private function addBeds(int $count, InventoryItem $item): int
    {
        $room = $this->inventoryRoom();
        $created = 0;

        for ($i = 0; $i < $count; $i++) {
            Bed::query()->create([
                'room_id' => $room->id,
                'bed_code' => $this->nextBedCode($room->code),
                'status' => 'available',
                'notes' => 'From inventory '.$item->item_code.' · '.$item->name,
            ]);
            $created++;
        }

        return $created;
    }

    private function nextBedCode(string $roomCode): string
    {
        $latest = Bed::query()
            ->where('bed_code', 'like', $roomCode.'-%')
            ->orderByDesc('id')
            ->value('bed_code');

        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        do {
            $code = $roomCode.'-'.str_pad((string) $next, 2, '0', STR_PAD_LEFT);
            $exists = Bed::query()->where('bed_code', $code)->exists();
            $next++;
        } while ($exists);

        return $code;
    }
}
