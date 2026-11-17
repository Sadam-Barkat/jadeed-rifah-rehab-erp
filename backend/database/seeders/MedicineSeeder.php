<?php

namespace Database\Seeders;

use App\Models\Medicine;
use Illuminate\Database\Seeder;

class MedicineSeeder extends Seeder
{
    public function run(): void
    {
        $items = [
            ['name' => 'Paracetamol', 'generic_name' => 'Acetaminophen', 'category' => 'analgesics', 'form' => 'tablet', 'strength' => '500mg', 'unit' => 'tablet', 'stock_qty' => 18, 'reorder_level' => 40, 'unit_price' => 3],
            ['name' => 'Ibuprofen', 'generic_name' => 'Ibuprofen', 'category' => 'analgesics', 'form' => 'tablet', 'strength' => '400mg', 'unit' => 'tablet', 'stock_qty' => 12, 'reorder_level' => 30, 'unit_price' => 5],
            ['name' => 'Amoxicillin', 'generic_name' => 'Amoxicillin', 'category' => 'antibiotics', 'form' => 'capsule', 'strength' => '500mg', 'unit' => 'capsule', 'stock_qty' => 8, 'reorder_level' => 25, 'unit_price' => 15],
            ['name' => 'Azithromycin', 'generic_name' => 'Azithromycin', 'category' => 'antibiotics', 'form' => 'tablet', 'strength' => '250mg', 'unit' => 'tablet', 'stock_qty' => 60, 'reorder_level' => 20, 'unit_price' => 22],
            ['name' => 'Sertraline', 'generic_name' => 'Sertraline', 'category' => 'antidepressants', 'form' => 'tablet', 'strength' => '50mg', 'unit' => 'tablet', 'stock_qty' => 45, 'reorder_level' => 15, 'unit_price' => 18],
            ['name' => 'Diazepam', 'generic_name' => 'Diazepam', 'category' => 'anxiolytics', 'form' => 'tablet', 'strength' => '5mg', 'unit' => 'tablet', 'stock_qty' => 5, 'reorder_level' => 20, 'unit_price' => 12],
            ['name' => 'Clonazepam', 'generic_name' => 'Clonazepam', 'category' => 'anxiolytics', 'form' => 'tablet', 'strength' => '0.5mg', 'unit' => 'tablet', 'stock_qty' => 70, 'reorder_level' => 20, 'unit_price' => 14],
            ['name' => 'Risperidone', 'generic_name' => 'Risperidone', 'category' => 'antipsychotics', 'form' => 'tablet', 'strength' => '2mg', 'unit' => 'tablet', 'stock_qty' => 9, 'reorder_level' => 15, 'unit_price' => 28],
            ['name' => 'Multivitamin', 'generic_name' => 'Multivitamin', 'category' => 'vitamins', 'form' => 'tablet', 'strength' => '1 tab', 'unit' => 'tablet', 'stock_qty' => 180, 'reorder_level' => 40, 'unit_price' => 8],
            ['name' => 'Thiamine', 'generic_name' => 'Vitamin B1', 'category' => 'detox_support', 'form' => 'tablet', 'strength' => '100mg', 'unit' => 'tablet', 'stock_qty' => 6, 'reorder_level' => 30, 'unit_price' => 7],
            ['name' => 'ORS', 'generic_name' => 'Oral rehydration salts', 'category' => 'gastrointestinal', 'form' => 'powder', 'strength' => '1 sachet', 'unit' => 'sachet', 'stock_qty' => 150, 'reorder_level' => 40, 'unit_price' => 25],
            ['name' => 'Omeprazole', 'generic_name' => 'Omeprazole', 'category' => 'gastrointestinal', 'form' => 'capsule', 'strength' => '20mg', 'unit' => 'capsule', 'stock_qty' => 10, 'reorder_level' => 25, 'unit_price' => 10],
            ['name' => 'Cetirizine', 'generic_name' => 'Cetirizine', 'category' => 'antihistamines', 'form' => 'tablet', 'strength' => '10mg', 'unit' => 'tablet', 'stock_qty' => 90, 'reorder_level' => 20, 'unit_price' => 4],
            ['name' => 'Normal Saline', 'generic_name' => 'NaCl 0.9%', 'category' => 'iv_fluids', 'form' => 'injection', 'strength' => '500ml', 'unit' => 'bottle', 'stock_qty' => 4, 'reorder_level' => 12, 'unit_price' => 85],
        ];

        foreach ($items as $i => $item) {
            $code = 'MED-'.str_pad((string) ($i + 1), 4, '0', STR_PAD_LEFT);
            Medicine::query()->updateOrCreate(
                ['medicine_code' => $code],
                [
                    ...$item,
                    'status' => 'active',
                ]
            );
        }
    }
}
