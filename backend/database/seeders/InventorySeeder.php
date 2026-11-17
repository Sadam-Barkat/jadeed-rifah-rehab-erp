<?php

namespace Database\Seeders;

use App\Models\InventoryItem;
use Illuminate\Database\Seeder;

class InventorySeeder extends Seeder
{
    public function run(): void
    {
        $items = [
            ['name' => 'Rice', 'category' => 'kitchen', 'unit' => 'kg', 'stock_qty' => 40, 'unit_cost' => 220, 'reorder_level' => 20],
            ['name' => 'Cooking Oil', 'category' => 'kitchen', 'unit' => 'liter', 'stock_qty' => 12, 'unit_cost' => 550, 'reorder_level' => 8],
            ['name' => 'Flour', 'category' => 'kitchen', 'unit' => 'kg', 'stock_qty' => 50, 'unit_cost' => 150, 'reorder_level' => 15],
            ['name' => 'Detergent', 'category' => 'cleaning', 'unit' => 'pack', 'stock_qty' => 6, 'unit_cost' => 300, 'reorder_level' => 8],
            ['name' => 'Floor Cleaner', 'category' => 'cleaning', 'unit' => 'liter', 'stock_qty' => 4, 'unit_cost' => 180, 'reorder_level' => 6],
            ['name' => 'Disposable Gloves', 'category' => 'medical_supply', 'unit' => 'box', 'stock_qty' => 8, 'unit_cost' => 450, 'reorder_level' => 5],
            ['name' => 'Face Masks', 'category' => 'medical_supply', 'unit' => 'box', 'stock_qty' => 20, 'unit_cost' => 200, 'reorder_level' => 10],
            ['name' => 'Bed Sheets', 'category' => 'linen', 'unit' => 'pcs', 'stock_qty' => 15, 'unit_cost' => 900, 'reorder_level' => 10],
            ['name' => 'Towels', 'category' => 'linen', 'unit' => 'pcs', 'stock_qty' => 18, 'unit_cost' => 450, 'reorder_level' => 10],
            ['name' => 'Office Chair', 'category' => 'furniture', 'unit' => 'pcs', 'stock_qty' => 6, 'unit_cost' => 6500, 'reorder_level' => 2],
        ];

        foreach ($items as $i => $item) {
            $code = 'INV-'.str_pad((string) ($i + 1), 4, '0', STR_PAD_LEFT);
            InventoryItem::query()->updateOrCreate(
                ['item_code' => $code],
                [...$item, 'status' => 'active']
            );
        }
    }
}
