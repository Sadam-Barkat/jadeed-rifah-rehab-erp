<?php

namespace Database\Seeders;

use App\Models\Admission;
use App\Models\Medicine;
use App\Models\MedicineDispense;
use App\Models\MedicineMovement;
use App\Models\User;
use Illuminate\Database\Seeder;

class PharmacyActivitySeeder extends Seeder
{
    public function run(): void
    {
        $pharmacist = User::query()->where('email', 'pharmacist@jadeed.local')->first();
        if (! $pharmacist) {
            return;
        }

        $medicines = Medicine::query()->where('status', 'active')->orderBy('id')->get();
        $admissions = Admission::query()->where('status', 'active')->orderBy('id')->get();
        if ($medicines->isEmpty() || $admissions->isEmpty()) {
            return;
        }

        $year = now()->format('Y');

        for ($i = 1; $i <= 10; $i++) {
            $medicine = $medicines[($i - 1) % $medicines->count()];
            $qty = 8 + $i;
            $code = 'MM-'.$year.'-T'.str_pad((string) $i, 3, '0', STR_PAD_LEFT);

            if (! MedicineMovement::query()->where('movement_code', $code)->exists()) {
                $medicine->update(['stock_qty' => (int) $medicine->stock_qty + $qty]);
                MedicineMovement::query()->create([
                    'movement_code' => $code,
                    'medicine_id' => $medicine->id,
                    'type' => 'in',
                    'quantity' => $qty,
                    'batch_no' => 'BATCH-'.$i,
                    'supplier' => 'Local Supplier',
                    'unit_cost' => $medicine->unit_price,
                    'notes' => 'Test stock in',
                    'moved_at' => now()->subDays(11 - $i),
                    'created_by' => $pharmacist->id,
                ]);
            }
        }

        for ($i = 1; $i <= 10; $i++) {
            $medicine = $medicines[($i - 1) % $medicines->count()]->fresh();
            $admission = $admissions[($i - 1) % $admissions->count()];
            $qty = ($i % 3) + 1;
            $code = 'DSP-'.$year.'-T'.str_pad((string) $i, 3, '0', STR_PAD_LEFT);

            if (MedicineDispense::query()->where('dispense_code', $code)->exists()) {
                continue;
            }
            if ((int) $medicine->stock_qty < $qty) {
                continue;
            }

            $medicine->update(['stock_qty' => (int) $medicine->stock_qty - $qty]);
            MedicineDispense::query()->create([
                'dispense_code' => $code,
                'admission_id' => $admission->id,
                'patient_id' => $admission->patient_id,
                'medicine_id' => $medicine->id,
                'quantity' => $qty,
                'dosage' => '1 tab',
                'frequency' => 'BD',
                'notes' => 'Test dispense',
                'dispensed_at' => now()->subDays(10 - $i),
                'status' => 'dispensed',
                'created_by' => $pharmacist->id,
            ]);
        }
    }
}
