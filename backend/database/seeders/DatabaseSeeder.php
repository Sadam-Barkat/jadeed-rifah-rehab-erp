<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RoleUserSeeder::class,
            RoomBedSeeder::class,
            MedicineSeeder::class,
            PharmacyActivitySeeder::class,
            FeePackageSeeder::class,
            InventorySeeder::class,
            InventoryActivitySeeder::class,
            PettyExpenseSeeder::class,
            FacilityBillSeeder::class,
            DoctorSeeder::class,
            SettingsSeeder::class,
        ]);
    }
}
