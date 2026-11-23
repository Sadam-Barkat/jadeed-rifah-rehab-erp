<?php

namespace Database\Seeders;

use App\Models\Medicine;
use Illuminate\Database\Seeder;

class MedicineSeeder extends Seeder
{
    public function run(): void
    {
        $items = [
            ['name' => 'Paracetamol', 'generic_name' => 'Acetaminophen', 'category' => 'analgesics', 'form' => 'tablet', 'strength' => '500mg', 'unit' => 'tablet', 'stock_qty' => 40, 'reorder_level' => 20, 'unit_price' => 3],
            ['name' => 'Ibuprofen', 'generic_name' => 'Ibuprofen', 'category' => 'analgesics', 'form' => 'tablet', 'strength' => '400mg', 'unit' => 'tablet', 'stock_qty' => 30, 'reorder_level' => 15, 'unit_price' => 5],
            ['name' => 'Diclofenac', 'generic_name' => 'Diclofenac', 'category' => 'analgesics', 'form' => 'tablet', 'strength' => '50mg', 'unit' => 'tablet', 'stock_qty' => 6, 'reorder_level' => 20, 'unit_price' => 4],
            ['name' => 'Tramadol', 'generic_name' => 'Tramadol', 'category' => 'analgesics', 'form' => 'capsule', 'strength' => '50mg', 'unit' => 'capsule', 'stock_qty' => 18, 'reorder_level' => 10, 'unit_price' => 12],
            ['name' => 'Amoxicillin', 'generic_name' => 'Amoxicillin', 'category' => 'antibiotics', 'form' => 'capsule', 'strength' => '500mg', 'unit' => 'capsule', 'stock_qty' => 25, 'reorder_level' => 15, 'unit_price' => 15],
            ['name' => 'Azithromycin', 'generic_name' => 'Azithromycin', 'category' => 'antibiotics', 'form' => 'tablet', 'strength' => '500mg', 'unit' => 'tablet', 'stock_qty' => 4, 'reorder_level' => 12, 'unit_price' => 35],
            ['name' => 'Ciprofloxacin', 'generic_name' => 'Ciprofloxacin', 'category' => 'antibiotics', 'form' => 'tablet', 'strength' => '500mg', 'unit' => 'tablet', 'stock_qty' => 22, 'reorder_level' => 10, 'unit_price' => 18],
            ['name' => 'Metronidazole', 'generic_name' => 'Metronidazole', 'category' => 'antibiotics', 'form' => 'tablet', 'strength' => '400mg', 'unit' => 'tablet', 'stock_qty' => 30, 'reorder_level' => 15, 'unit_price' => 6],
            ['name' => 'Sertraline', 'generic_name' => 'Sertraline', 'category' => 'antidepressants', 'form' => 'tablet', 'strength' => '50mg', 'unit' => 'tablet', 'stock_qty' => 35, 'reorder_level' => 15, 'unit_price' => 18],
            ['name' => 'Fluoxetine', 'generic_name' => 'Fluoxetine', 'category' => 'antidepressants', 'form' => 'capsule', 'strength' => '20mg', 'unit' => 'capsule', 'stock_qty' => 9, 'reorder_level' => 15, 'unit_price' => 16],
            ['name' => 'Escitalopram', 'generic_name' => 'Escitalopram', 'category' => 'antidepressants', 'form' => 'tablet', 'strength' => '10mg', 'unit' => 'tablet', 'stock_qty' => 24, 'reorder_level' => 12, 'unit_price' => 22],
            ['name' => 'Diazepam', 'generic_name' => 'Diazepam', 'category' => 'anxiolytics', 'form' => 'tablet', 'strength' => '5mg', 'unit' => 'tablet', 'stock_qty' => 8, 'reorder_level' => 20, 'unit_price' => 12],
            ['name' => 'Clonazepam', 'generic_name' => 'Clonazepam', 'category' => 'anxiolytics', 'form' => 'tablet', 'strength' => '0.5mg', 'unit' => 'tablet', 'stock_qty' => 14, 'reorder_level' => 15, 'unit_price' => 10],
            ['name' => 'Lorazepam', 'generic_name' => 'Lorazepam', 'category' => 'anxiolytics', 'form' => 'tablet', 'strength' => '1mg', 'unit' => 'tablet', 'stock_qty' => 5, 'reorder_level' => 12, 'unit_price' => 14],
            ['name' => 'Risperidone', 'generic_name' => 'Risperidone', 'category' => 'antipsychotics', 'form' => 'tablet', 'strength' => '2mg', 'unit' => 'tablet', 'stock_qty' => 20, 'reorder_level' => 10, 'unit_price' => 28],
            ['name' => 'Olanzapine', 'generic_name' => 'Olanzapine', 'category' => 'antipsychotics', 'form' => 'tablet', 'strength' => '5mg', 'unit' => 'tablet', 'stock_qty' => 7, 'reorder_level' => 12, 'unit_price' => 32],
            ['name' => 'Quetiapine', 'generic_name' => 'Quetiapine', 'category' => 'antipsychotics', 'form' => 'tablet', 'strength' => '25mg', 'unit' => 'tablet', 'stock_qty' => 26, 'reorder_level' => 10, 'unit_price' => 20],
            ['name' => 'Multivitamin', 'generic_name' => 'Multivitamin', 'category' => 'vitamins', 'form' => 'tablet', 'strength' => '1 tab', 'unit' => 'tablet', 'stock_qty' => 60, 'reorder_level' => 20, 'unit_price' => 8],
            ['name' => 'Vitamin D3', 'generic_name' => 'Cholecalciferol', 'category' => 'vitamins', 'form' => 'capsule', 'strength' => '50000 IU', 'unit' => 'capsule', 'stock_qty' => 16, 'reorder_level' => 10, 'unit_price' => 15],
            ['name' => 'Folic Acid', 'generic_name' => 'Folic Acid', 'category' => 'vitamins', 'form' => 'tablet', 'strength' => '5mg', 'unit' => 'tablet', 'stock_qty' => 40, 'reorder_level' => 15, 'unit_price' => 2],
            ['name' => 'Thiamine', 'generic_name' => 'Vitamin B1', 'category' => 'detox_support', 'form' => 'tablet', 'strength' => '100mg', 'unit' => 'tablet', 'stock_qty' => 12, 'reorder_level' => 20, 'unit_price' => 7],
            ['name' => 'Naltrexone', 'generic_name' => 'Naltrexone', 'category' => 'detox_support', 'form' => 'tablet', 'strength' => '50mg', 'unit' => 'tablet', 'stock_qty' => 3, 'reorder_level' => 10, 'unit_price' => 45],
            ['name' => 'Clonidine', 'generic_name' => 'Clonidine', 'category' => 'detox_support', 'form' => 'tablet', 'strength' => '0.1mg', 'unit' => 'tablet', 'stock_qty' => 18, 'reorder_level' => 12, 'unit_price' => 9],
            ['name' => 'Omeprazole', 'generic_name' => 'Omeprazole', 'category' => 'gastrointestinal', 'form' => 'capsule', 'strength' => '20mg', 'unit' => 'capsule', 'stock_qty' => 28, 'reorder_level' => 15, 'unit_price' => 10],
            ['name' => 'Domperidone', 'generic_name' => 'Domperidone', 'category' => 'gastrointestinal', 'form' => 'tablet', 'strength' => '10mg', 'unit' => 'tablet', 'stock_qty' => 8, 'reorder_level' => 15, 'unit_price' => 5],
            ['name' => 'ORS Sachet', 'generic_name' => 'ORS', 'category' => 'gastrointestinal', 'form' => 'powder', 'strength' => '1 sachet', 'unit' => 'sachet', 'stock_qty' => 50, 'reorder_level' => 20, 'unit_price' => 12],
            ['name' => 'Amlodipine', 'generic_name' => 'Amlodipine', 'category' => 'cardiovascular', 'form' => 'tablet', 'strength' => '5mg', 'unit' => 'tablet', 'stock_qty' => 22, 'reorder_level' => 10, 'unit_price' => 6],
            ['name' => 'Atenolol', 'generic_name' => 'Atenolol', 'category' => 'cardiovascular', 'form' => 'tablet', 'strength' => '50mg', 'unit' => 'tablet', 'stock_qty' => 4, 'reorder_level' => 12, 'unit_price' => 5],
            ['name' => 'Salbutamol Inhaler', 'generic_name' => 'Salbutamol', 'category' => 'respiratory', 'form' => 'inhaler', 'strength' => '100mcg', 'unit' => 'unit', 'stock_qty' => 10, 'reorder_level' => 6, 'unit_price' => 280],
            ['name' => 'Montelukast', 'generic_name' => 'Montelukast', 'category' => 'respiratory', 'form' => 'tablet', 'strength' => '10mg', 'unit' => 'tablet', 'stock_qty' => 15, 'reorder_level' => 10, 'unit_price' => 18],
            ['name' => 'Cetirizine', 'generic_name' => 'Cetirizine', 'category' => 'antihistamines', 'form' => 'tablet', 'strength' => '10mg', 'unit' => 'tablet', 'stock_qty' => 45, 'reorder_level' => 15, 'unit_price' => 4],
            ['name' => 'Loratadine', 'generic_name' => 'Loratadine', 'category' => 'antihistamines', 'form' => 'tablet', 'strength' => '10mg', 'unit' => 'tablet', 'stock_qty' => 6, 'reorder_level' => 12, 'unit_price' => 5],
            ['name' => 'Hydrocortisone Cream', 'generic_name' => 'Hydrocortisone', 'category' => 'topical', 'form' => 'cream', 'strength' => '1%', 'unit' => 'tube', 'stock_qty' => 9, 'reorder_level' => 8, 'unit_price' => 90],
            ['name' => 'Povidone Iodine', 'generic_name' => 'Povidone Iodine', 'category' => 'topical', 'form' => 'other', 'strength' => '10%', 'unit' => 'bottle', 'stock_qty' => 3, 'reorder_level' => 6, 'unit_price' => 120],
            ['name' => 'Normal Saline', 'generic_name' => 'Sodium Chloride', 'category' => 'iv_fluids', 'form' => 'injection', 'strength' => '0.9%', 'unit' => 'bottle', 'stock_qty' => 20, 'reorder_level' => 10, 'unit_price' => 85],
            ['name' => 'Dextrose 5%', 'generic_name' => 'Dextrose', 'category' => 'iv_fluids', 'form' => 'injection', 'strength' => '5%', 'unit' => 'bottle', 'stock_qty' => 5, 'reorder_level' => 10, 'unit_price' => 95],
        ];

        foreach ($items as $i => $item) {
            $code = 'MED-'.str_pad((string) ($i + 1), 4, '0', STR_PAD_LEFT);
            Medicine::query()->updateOrCreate(
                ['medicine_code' => $code],
                [...$item, 'status' => 'active']
            );
        }
    }
}
