<?php

namespace Database\Seeders;

use App\Models\PettyExpense;
use App\Models\User;
use Illuminate\Database\Seeder;

class PettyExpenseSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::query()->where('email', 'finance@jadeed.local')->first();
        if (! $user) {
            return;
        }

        $rows = [
            ['Tea & snacks', 450, 'Sadam', 'Guest visit'],
            ['Cold drinks', 320, 'Ali', 'Visitor refreshments'],
            ['Mineral water', 250, 'Sadam', 'Waiting area'],
            ['Biscuits pack', 180, 'Hassan', 'Meeting snacks'],
            ['Juice boxes', 600, 'Sadam', 'Family visit day'],
            ['Samosa / bakery', 700, 'Bilal', 'Staff tea break'],
            ['Tissue pack', 150, 'Sadam', 'Reception kit'],
            ['Cold drink crate', 1200, 'Usman', 'Monthly guest stock'],
            ['Coffee cups', 280, 'Ali', 'Office pantry'],
            ['Guest lunch', 2200, 'Sadam', 'Counseling day guests'],
        ];

        $year = now()->format('Y');
        foreach ($rows as $i => [$title, $amount, $spentFor, $reason]) {
            $code = 'PE-'.$year.'-T'.str_pad((string) ($i + 1), 4, '0', STR_PAD_LEFT);
            PettyExpense::query()->updateOrCreate(
                ['expense_code' => $code],
                [
                    'expense_date' => now()->subDays(10 - $i)->toDateString(),
                    'title' => $title,
                    'amount' => $amount,
                    'spent_for' => $spentFor,
                    'reason' => $reason,
                    'payment_method' => $i % 2 === 0 ? 'cash' : 'bank',
                    'notes' => null,
                    'status' => 'posted',
                    'created_by' => $user->id,
                ]
            );
        }
    }
}
