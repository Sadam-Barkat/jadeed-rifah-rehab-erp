<?php

namespace Database\Seeders;

use App\Models\PettyExpense;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class PettyExpenseSeeder extends Seeder
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

        $rows = [
            ['Tea & snacks', 450, 'Sadam', 'Guest visit — admin office', $imran, now()->subDays(8)],
            ['Cold drinks', 320, 'Sadam', 'Visitor refreshments', $sara, now()->subDays(6)],
            ['Biscuits pack', 180, 'Ali', 'Meeting snacks', $imran, now()->subDays(5)],
            ['Mineral water', 250, 'Sadam', 'Guest waiting area', $imran, now()->subDays(4)],
            ['Juice boxes', 600, 'Dr. Hassan', 'Family counselling day', $sara, now()->subDays(3)],
            ['Samosa / bakery', 700, 'Ali', 'Staff + guest tea break', $sara, now()->subDays(2)],
            ['Tissue / small supplies', 150, 'Sadam', 'Reception guest kit', $imran, now()->subDays(1)],
            ['Cold drink crate', 1200, 'Sadam', 'Monthly guest stock', $sara, now()],
        ];

        $year = now()->format('Y');
        foreach ($rows as $i => [$title, $amount, $spentFor, $reason, $user, $when]) {
            $code = 'PE-'.$year.'-D'.str_pad((string) ($i + 1), 4, '0', STR_PAD_LEFT);
            if (PettyExpense::query()->where('expense_code', $code)->exists()) {
                continue;
            }

            PettyExpense::query()->create([
                'expense_code' => $code,
                'expense_date' => $when->toDateString(),
                'title' => $title,
                'amount' => $amount,
                'spent_for' => $spentFor,
                'reason' => $reason,
                'payment_method' => 'cash',
                'notes' => 'Demo petty expense',
                'status' => 'posted',
                'created_by' => $user->id,
            ]);
        }
    }
}
