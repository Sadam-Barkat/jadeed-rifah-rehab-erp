<?php

namespace Database\Seeders;

use App\Models\FacilityBill;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class FacilityBillSeeder extends Seeder
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

        $rows = [
            ['electricity', 18500, now()->subDays(20), 'LESCO Nov'],
            ['gas', 9200, now()->subDays(18), 'Sui Gas'],
            ['water', 2500, now()->subDays(15), 'WASA'],
            ['internet', 4500, now()->subDays(10), 'Fiber'],
            ['rent', 0, now()->subDays(5), 'Owned — no rent'],
            ['electricity', 17200, now()->subDays(2), 'LESCO Dec'],
        ];

        $year = now()->format('Y');
        foreach ($rows as $i => [$type, $amount, $when, $ref]) {
            $code = 'FB-'.$year.'-D'.str_pad((string) ($i + 1), 4, '0', STR_PAD_LEFT);
            if (FacilityBill::query()->where('bill_code', $code)->exists()) {
                continue;
            }

            FacilityBill::query()->create([
                'bill_code' => $code,
                'bill_date' => $when->toDateString(),
                'bill_type' => $type,
                'amount' => $amount,
                'payment_method' => 'bank',
                'reference' => $ref,
                'notes' => 'Demo facility bill',
                'status' => 'posted',
                'created_by' => $imran->id,
            ]);
        }
    }
}
