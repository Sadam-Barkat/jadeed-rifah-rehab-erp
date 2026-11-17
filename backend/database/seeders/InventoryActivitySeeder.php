<?php

namespace Database\Seeders;

use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\User;
use Illuminate\Database\Seeder;

class InventoryActivitySeeder extends Seeder
{
    public function run(): void
    {
        $user = User::query()->where('email', 'inventory@jadeed.local')->first();
        if (! $user) {
            return;
        }

        $items = InventoryItem::query()->where('status', 'active')->orderBy('id')->get();
        if ($items->isEmpty()) {
            return;
        }

        $year = now()->format('Y');
        $purposesIn = 'purchase';
        $outPlan = [
            ['kitchen_use', 'kitchen', 'Meal prep'],
            ['kitchen_use', 'kitchen', 'Cooking'],
            ['cleaning', 'cleaning', 'Laundry'],
            ['patient_care', 'nursing', 'Ward use'],
            ['patient_care', 'nursing', 'Bed change'],
            ['maintenance', 'maintenance', 'Repair'],
            ['kitchen_use', 'kitchen', 'Breakfast'],
            ['cleaning', 'cleaning', 'Floor wash'],
            ['patient_care', 'nursing', 'Hygiene'],
            ['other', 'admin', 'Office use'],
        ];

        for ($i = 1; $i <= 10; $i++) {
            $item = $items[($i - 1) % $items->count()];
            $code = 'IM-'.$year.'-IN'.str_pad((string) $i, 3, '0', STR_PAD_LEFT);
            if (InventoryMovement::query()->where('movement_code', $code)->exists()) {
                continue;
            }

            InventoryMovement::query()->create([
                'movement_code' => $code,
                'inventory_item_id' => $item->id,
                'type' => 'in',
                'purpose' => $purposesIn,
                'department' => 'admin',
                'issued_to' => 'Supplier',
                'used_for' => null,
                'quantity' => 5 + $i,
                'unit' => $item->unit,
                'reference' => 'PO-T'.$i,
                'notes' => 'Test stock in',
                'moved_at' => now()->subDays(12 - $i),
                'created_by' => $user->id,
            ]);
        }

        for ($i = 1; $i <= 10; $i++) {
            $item = $items[($i - 1) % $items->count()];
            [$purpose, $dept, $usedFor] = $outPlan[$i - 1];
            $code = 'IM-'.$year.'-OUT'.str_pad((string) $i, 3, '0', STR_PAD_LEFT);
            if (InventoryMovement::query()->where('movement_code', $code)->exists()) {
                continue;
            }

            InventoryMovement::query()->create([
                'movement_code' => $code,
                'inventory_item_id' => $item->id,
                'type' => 'out',
                'purpose' => $purpose,
                'department' => $dept,
                'issued_to' => $user->name,
                'used_for' => $usedFor,
                'quantity' => 1 + ($i % 3),
                'unit' => $item->unit,
                'reference' => 'USE-T'.$i,
                'notes' => 'Test stock out',
                'moved_at' => now()->subDays(11 - $i),
                'created_by' => $user->id,
            ]);
        }
    }
}
