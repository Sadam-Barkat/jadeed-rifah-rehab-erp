<?php

namespace Database\Seeders;

use App\Models\Medicine;
use Illuminate\Database\Seeder;

class MedicineSeeder extends Seeder
{
    public function run(): void
    {
        $items = [
            ['name' => 'Paracetamol', 'generic_name' => 'Acetaminophen', 'form' => 'Tablet', 'strength' => '500mg', 'unit' => 'tablet', 'stock_qty' => 200, 'unit_price' => 3],
            ['name' => 'Diazepam', 'generic_name' => 'Diazepam', 'form' => 'Tablet', 'strength' => '5mg', 'unit' => 'tablet', 'stock_qty' => 100, 'unit_price' => 12],
            ['name' => 'ORS', 'generic_name' => 'Oral rehydration salts', 'form' => 'Sachet', 'strength' => '1 sachet', 'unit' => 'sachet', 'stock_qty' => 150, 'unit_price' => 25],
            ['name' => 'Multivitamin', 'generic_name' => 'Multivitamin', 'form' => 'Tablet', 'strength' => '1 tab', 'unit' => 'tablet', 'stock_qty' => 180, 'unit_price' => 8],
            ['name' => 'Omeprazole', 'generic_name' => 'Omeprazole', 'form' => 'Capsule', 'strength' => '20mg', 'unit' => 'capsule', 'stock_qty' => 120, 'unit_price' => 10],
        ];

        foreach ($items as $i => $item) {
            $code = 'MED-'.str_pad((string) ($i + 1), 4, '0', STR_PAD_LEFT);
            Medicine::query()->updateOrCreate(
                ['medicine_code' => $code],
                [
                    ...$item,
                    'reorder_level' => 20,
                    'status' => 'active',
                ]
            );
        }
    }
}
