<?php

namespace Database\Seeders;

use App\Models\FeePackage;
use Illuminate\Database\Seeder;

class FeePackageSeeder extends Seeder
{
    public function run(): void
    {
        $packages = [
            ['name' => '30-Day Program', 'program_days' => 30, 'amount' => 150000, 'description' => 'Standard 30-day rehab package'],
            ['name' => '60-Day Program', 'program_days' => 60, 'amount' => 280000, 'description' => 'Extended 60-day rehab package'],
            ['name' => '90-Day Program', 'program_days' => 90, 'amount' => 390000, 'description' => 'Full 90-day rehab package'],
        ];

        foreach ($packages as $package) {
            FeePackage::query()->updateOrCreate(
                ['name' => $package['name'], 'program_days' => $package['program_days']],
                [
                    'amount' => $package['amount'],
                    'description' => $package['description'],
                    'status' => 'active',
                ]
            );
        }
    }
}
