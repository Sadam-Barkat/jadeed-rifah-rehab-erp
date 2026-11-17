<?php

namespace Database\Seeders;

use App\Models\FacilityBill;
use App\Models\User;
use Illuminate\Database\Seeder;

class FacilityBillSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::query()->where('email', 'finance@jadeed.local')->first();
        if (! $user) {
            return;
        }

        $rows = [
            ['electricity', 18500, 'LESCO'],
            ['gas', 9200, 'Sui Gas'],
            ['water', 2500, 'WASA'],
            ['internet', 4500, 'Fiber'],
            ['rent', 75000, 'Landlord'],
            ['electricity', 17200, 'LESCO'],
            ['gas', 8800, 'Sui Gas'],
            ['water', 2400, 'WASA'],
            ['internet', 4500, 'Fiber'],
            ['other', 6500, 'Generator fuel'],
        ];

        $year = now()->format('Y');
        foreach ($rows as $i => [$type, $amount, $ref]) {
            $code = 'FB-'.$year.'-T'.str_pad((string) ($i + 1), 4, '0', STR_PAD_LEFT);
            FacilityBill::query()->updateOrCreate(
                ['bill_code' => $code],
                [
                    'bill_date' => now()->subDays(20 - $i)->toDateString(),
                    'bill_type' => $type,
                    'amount' => $amount,
                    'payment_method' => 'bank',
                    'reference' => $ref,
                    'notes' => null,
                    'status' => 'posted',
                    'created_by' => $user->id,
                ]
            );
        }
    }
}
