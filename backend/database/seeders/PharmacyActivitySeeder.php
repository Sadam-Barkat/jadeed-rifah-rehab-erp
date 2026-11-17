<?php

namespace Database\Seeders;

use App\Models\Admission;
use App\Models\Bed;
use App\Models\Medicine;
use App\Models\MedicineDispense;
use App\Models\MedicineMovement;
use App\Models\Patient;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/** Demo stock-in + dispense rows by pharmacists (for admin Pharmacy filters). */
class PharmacyActivitySeeder extends Seeder
{
    public function run(): void
    {
        $pharmacistRoleId = Role::query()->where('slug', 'pharmacist')->value('id');
        if (! $pharmacistRoleId) {
            return;
        }

        $ahmad = User::query()->updateOrCreate(
            ['email' => 'ahmad.pharmacist@jadeed.local'],
            [
                'staff_code' => 'PHR-0001',
                'name' => 'Ahmad',
                'password' => Hash::make('Pharmacist@123'),
                'role_id' => $pharmacistRoleId,
                'is_active' => true,
                'must_change_password' => false,
            ]
        );

        $alishaba = User::query()->updateOrCreate(
            ['email' => 'alishaba.pharmacist@jadeed.local'],
            [
                'staff_code' => 'PHR-0002',
                'name' => 'Alishaba',
                'password' => Hash::make('Pharmacist@123'),
                'role_id' => $pharmacistRoleId,
                'is_active' => true,
                'must_change_password' => false,
            ]
        );

        $medicines = Medicine::query()->where('status', 'active')->orderBy('id')->get();
        if ($medicines->isEmpty()) {
            return;
        }

        $year = now()->format('Y');
        $stockIns = [
            [$ahmad->id, $medicines[0]->id, 40, 'BATCH-AH-01', now()->subDays(6)],
            [$ahmad->id, $medicines[1]->id ?? $medicines[0]->id, 30, 'BATCH-AH-02', now()->subDays(4)],
            [$alishaba->id, $medicines[2]->id ?? $medicines[0]->id, 50, 'BATCH-AL-01', now()->subDays(3)],
            [$alishaba->id, $medicines[3]->id ?? $medicines[0]->id, 25, 'BATCH-AL-02', now()->subDays(1)],
            [$ahmad->id, $medicines[4]->id ?? $medicines[0]->id, 20, 'BATCH-AH-03', now()],
        ];

        foreach ($stockIns as $i => [$userId, $medicineId, $qty, $batch, $when]) {
            $code = 'MM-'.$year.'-D'.str_pad((string) ($i + 1), 3, '0', STR_PAD_LEFT);
            $exists = MedicineMovement::query()->where('movement_code', $code)->exists();
            if ($exists) {
                continue;
            }

            $medicine = Medicine::query()->find($medicineId);
            if (! $medicine) {
                continue;
            }

            $medicine->update(['stock_qty' => (int) $medicine->stock_qty + (int) $qty]);

            MedicineMovement::query()->create([
                'movement_code' => $code,
                'medicine_id' => $medicine->id,
                'type' => 'in',
                'quantity' => $qty,
                'batch_no' => $batch,
                'supplier' => 'Demo Supplier',
                'unit_cost' => $medicine->unit_price,
                'notes' => 'Demo stock in',
                'moved_at' => $when,
                'created_by' => $userId,
            ]);
        }

        $patient = Patient::query()->first();
        if (! $patient) {
            $patient = Patient::query()->create([
                'patient_code' => 'PAT-DEMO-01',
                'first_name' => 'Demo',
                'last_name' => 'Patient',
                'phone' => '03000000001',
                'status' => 'admitted',
                'created_by' => $ahmad->id,
            ]);
        }

        $admission = Admission::query()->where('status', 'active')->first();
        if (! $admission) {
            $bed = Bed::query()->where('status', 'available')->first()
                ?? Bed::query()->first();
            if ($bed) {
                $bed->update(['status' => 'occupied']);
            }
            $admission = Admission::query()->create([
                'admission_code' => 'ADM-DEMO-01',
                'patient_id' => $patient->id,
                'bed_id' => $bed?->id,
                'admitted_at' => now()->subDays(10),
                'program_days' => 30,
                'package_name' => 'Demo package',
                'status' => 'active',
                'created_by' => $ahmad->id,
            ]);
            $patient->update(['status' => 'admitted']);
        }

        $dispensePlan = [
            [$ahmad->id, $medicines[0]->id, 2, now()->subDays(5)],
            [$ahmad->id, $medicines[1]->id ?? $medicines[0]->id, 1, now()->subDays(2)],
            [$alishaba->id, $medicines[4]->id ?? $medicines[0]->id, 2, now()->subDays(1)],
            [$alishaba->id, $medicines[0]->id, 1, now()],
        ];

        foreach ($dispensePlan as $i => [$userId, $medicineId, $qty, $when]) {
            $code = 'DSP-'.$year.'-D'.str_pad((string) ($i + 1), 3, '0', STR_PAD_LEFT);
            if (MedicineDispense::query()->where('dispense_code', $code)->exists()) {
                continue;
            }

            $medicine = Medicine::query()->find($medicineId);
            if (! $medicine || (int) $medicine->stock_qty < $qty) {
                continue;
            }

            $medicine->update(['stock_qty' => (int) $medicine->stock_qty - (int) $qty]);

            MedicineDispense::query()->create([
                'dispense_code' => $code,
                'admission_id' => $admission->id,
                'patient_id' => $admission->patient_id,
                'medicine_id' => $medicine->id,
                'quantity' => $qty,
                'dosage' => '1 tab',
                'frequency' => 'BD',
                'notes' => 'Demo dispense',
                'dispensed_at' => $when,
                'status' => 'dispensed',
                'created_by' => $userId,
            ]);
        }
    }
}
