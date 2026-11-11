<?php

namespace Database\Seeders;

use App\Models\ComplianceItem;
use Illuminate\Database\Seeder;

class ComplianceSeeder extends Seeder
{
    public function run(): void
    {
        $items = [
            ['item_code' => 'CMP-0001', 'framework' => 'phc', 'category' => 'Facility', 'title' => 'Fire extinguisher inspection', 'frequency' => 'monthly'],
            ['item_code' => 'CMP-0002', 'framework' => 'phc', 'category' => 'Infection control', 'title' => 'Hand hygiene station stocked', 'frequency' => 'daily'],
            ['item_code' => 'CMP-0003', 'framework' => 'phc', 'category' => 'Clinical', 'title' => 'Emergency trolley checklist', 'frequency' => 'weekly'],
            ['item_code' => 'CMP-0004', 'framework' => 'msds', 'category' => 'Chemicals', 'title' => 'MSDS binder up to date', 'frequency' => 'quarterly'],
            ['item_code' => 'CMP-0005', 'framework' => 'msds', 'category' => 'Storage', 'title' => 'Hazardous chemical labeling', 'frequency' => 'monthly'],
            ['item_code' => 'CMP-0006', 'framework' => 'internal', 'category' => 'Records', 'title' => 'Patient consent forms archived', 'frequency' => 'monthly'],
        ];

        foreach ($items as $item) {
            ComplianceItem::query()->updateOrCreate(
                ['item_code' => $item['item_code']],
                [
                    ...$item,
                    'description' => null,
                    'status' => 'active',
                ]
            );
        }
    }
}
