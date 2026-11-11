<?php

namespace Database\Seeders;

use App\Models\CanteenProduct;
use App\Models\Supplier;
use Illuminate\Database\Seeder;

class PurchaseCanteenSeeder extends Seeder
{
    public function run(): void
    {
        Supplier::query()->updateOrCreate(
            ['supplier_code' => 'SUP-0001'],
            [
                'name' => 'Al-Noor Traders',
                'contact_person' => 'Hassan Ali',
                'phone' => '03001230001',
                'address' => 'Lahore',
                'status' => 'active',
            ]
        );

        Supplier::query()->updateOrCreate(
            ['supplier_code' => 'SUP-0002'],
            [
                'name' => 'Fresh Mart Supplies',
                'contact_person' => 'Nadia Bibi',
                'phone' => '03001230002',
                'address' => 'Lahore',
                'status' => 'active',
            ]
        );

        $products = [
            ['product_code' => 'CNP-0001', 'name' => 'Tea', 'unit_price' => 50, 'stock_qty' => 100],
            ['product_code' => 'CNP-0002', 'name' => 'Biscuit Pack', 'unit_price' => 80, 'stock_qty' => 60],
            ['product_code' => 'CNP-0003', 'name' => 'Soft Drink', 'unit_price' => 120, 'stock_qty' => 40],
        ];

        foreach ($products as $p) {
            CanteenProduct::query()->updateOrCreate(
                ['product_code' => $p['product_code']],
                [...$p, 'status' => 'active']
            );
        }
    }
}
