<?php

namespace Database\Seeders;

use App\Models\Asset;
use Illuminate\Database\Seeder;

class AssetSeeder extends Seeder
{
    public function run(): void
    {
        $items = [
            ['name' => 'Generator 20kVA', 'category' => 'equipment', 'location' => 'Backyard', 'purchase_cost' => 450000],
            ['name' => 'CCTV DVR System', 'category' => 'electronics', 'location' => 'Security Room', 'purchase_cost' => 85000],
            ['name' => 'Patient Beds (Batch)', 'category' => 'furniture', 'location' => 'Wards', 'purchase_cost' => 320000],
        ];

        foreach ($items as $i => $item) {
            $code = 'AST-'.str_pad((string) ($i + 1), 4, '0', STR_PAD_LEFT);
            Asset::query()->updateOrCreate(
                ['asset_code' => $code],
                [
                    ...$item,
                    'purchase_date' => now()->subMonths(8 - $i)->toDateString(),
                    'current_value' => $item['purchase_cost'],
                    'condition' => 'good',
                    'status' => 'active',
                ]
            );
        }
    }
}
