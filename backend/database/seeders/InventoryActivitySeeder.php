<?php

namespace Database\Seeders;

use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/** Demo stock-in / stock-out rows so inventory KPIs are visible. */
class InventoryActivitySeeder extends Seeder
{
    public function run(): void
    {
        $roleId = Role::query()->where('slug', 'inventory-manager')->value('id');
        if (! $roleId) {
            return;
        }

        $imran = User::query()->updateOrCreate(
            ['email' => 'imran.inventory@jadeed.local'],
            [
                'staff_code' => 'INV-0001',
                'name' => 'Imran',
                'password' => Hash::make('Inventory@123'),
                'role_id' => $roleId,
                'is_active' => true,
                'must_change_password' => false,
            ]
        );

        $sara = User::query()->updateOrCreate(
            ['email' => 'sara.inventory@jadeed.local'],
            [
                'staff_code' => 'INV-0002',
                'name' => 'Sara',
                'password' => Hash::make('Inventory@123'),
                'role_id' => $roleId,
                'is_active' => true,
                'must_change_password' => false,
            ]
        );

        $byName = InventoryItem::query()
            ->where('status', 'active')
            ->get()
            ->keyBy(fn (InventoryItem $i) => strtolower($i->name));

        if ($byName->isEmpty()) {
            return;
        }

        // Force a clear KPI mix: critical (0), low, and healthy.
        $stockTargets = [
            'rice' => 8,
            'cooking oil' => 3,
            'flour' => 80,
            'detergent' => 2,
            'floor cleaner' => 0,
            'disposable gloves' => 2,
            'face masks' => 40,
            'bed sheets' => 4,
            'towels' => 0,
            'cctv camera' => 1,
            'extension board' => 0,
            'office chair' => 12,
        ];
        foreach ($stockTargets as $name => $qty) {
            $item = $byName->get($name);
            if ($item) {
                $item->update(['stock_qty' => $qty, 'created_by' => $item->created_by ?: $imran->id]);
            }
        }

        $year = now()->format('Y');
        $adminId = User::query()->where('email', 'admin@jadeed.local')->value('id') ?: $imran->id;

        $stockIns = [
            ['Rice', 50, 'purchase', 'kitchen', $imran, now()->subDays(8), 'Weekly kitchen purchase'],
            ['Cooking Oil', 20, 'purchase', 'kitchen', $imran, now()->subDays(7), 'Oil restock'],
            ['Flour', 40, 'purchase', 'kitchen', $sara, now()->subDays(6), 'Flour purchase'],
            ['Detergent', 15, 'purchase', 'cleaning', $sara, now()->subDays(5), 'Cleaning supplies'],
            ['Face Masks', 30, 'purchase', 'nursing', $imran, now()->subDays(4), 'Nursing PPE'],
            ['Bed Sheets', 20, 'purchase', 'admin', $sara, now()->subDays(3), 'Linen purchase'],
            ['Office Chair', 4, 'purchase', 'admin', $imran, now()->subDays(2), 'Admin furniture'],
            ['Disposable Gloves', 10, 'purchase', 'nursing', $sara, now()->subDays(1), 'Gloves restock'],
        ];

        $n = 0;
        foreach ($stockIns as [$name, $qty, $purpose, $dept, $user, $when, $notes]) {
            $item = $byName->get(strtolower($name));
            if (! $item) {
                continue;
            }
            $n++;
            $code = 'IM-'.$year.'-IN'.str_pad((string) $n, 3, '0', STR_PAD_LEFT);
            if (InventoryMovement::query()->where('movement_code', $code)->exists()) {
                continue;
            }

            InventoryMovement::query()->create([
                'movement_code' => $code,
                'inventory_item_id' => $item->id,
                'type' => 'in',
                'purpose' => $purpose,
                'department' => $dept,
                'issued_to' => 'Demo Supplier',
                'used_for' => null,
                'quantity' => $qty,
                'unit' => $item->unit,
                'reference' => 'PO-DEMO-'.$n,
                'notes' => $notes,
                'moved_at' => $when,
                'created_by' => $user->id,
            ]);
        }

        $stockOuts = [
            ['Rice', 10, 'kitchen_use', 'kitchen', 'Daily meal cooking', $imran, now()->subDays(7)],
            ['Rice', 8, 'kitchen_use', 'kitchen', 'Patient lunch service', $sara, now()->subDays(5)],
            ['Cooking Oil', 4, 'kitchen_use', 'kitchen', 'Kitchen frying', $imran, now()->subDays(6)],
            ['Flour', 12, 'kitchen_use', 'kitchen', 'Roti / bread prep', $sara, now()->subDays(4)],
            ['Detergent', 3, 'cleaning', 'cleaning', 'Laundry wash', $sara, now()->subDays(3)],
            ['Floor Cleaner', 2, 'cleaning', 'cleaning', 'Hallway cleaning', $imran, now()->subDays(3)],
            ['Disposable Gloves', 4, 'patient_care', 'nursing', 'Ward patient care', $imran, now()->subDays(2)],
            ['Face Masks', 6, 'patient_care', 'nursing', 'Nursing rounds', $sara, now()->subDays(2)],
            ['Bed Sheets', 5, 'patient_care', 'nursing', 'Bed change', $imran, now()->subDays(1)],
            ['Towels', 4, 'patient_care', 'nursing', 'Patient hygiene', $sara, now()->subDays(1)],
            ['Extension Board', 1, 'maintenance', 'maintenance', 'Room wiring fix', $imran, now()],
            ['CCTV Camera', 1, 'maintenance', 'gate', 'Gate camera replace', $sara, now()],
        ];

        $o = 0;
        foreach ($stockOuts as [$name, $qty, $purpose, $dept, $usedFor, $user, $when]) {
            $item = $byName->get(strtolower($name));
            if (! $item) {
                continue;
            }
            $o++;
            $code = 'IM-'.$year.'-OUT'.str_pad((string) $o, 3, '0', STR_PAD_LEFT);
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
                'quantity' => $qty,
                'unit' => $item->unit,
                'reference' => 'USE-DEMO-'.$o,
                'notes' => 'Demo stock out',
                'moved_at' => $when,
                'created_by' => $user->id ?: $adminId,
            ]);
        }
    }
}
