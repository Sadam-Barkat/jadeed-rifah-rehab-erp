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
            FeePackageSeeder::class,
            EmployeeSeeder::class,
            InventorySeeder::class,
            PurchaseCanteenSeeder::class,
            AssetSeeder::class,
            DoctorSeeder::class,
            ComplianceSeeder::class,
            SecuritySeeder::class,
            SettingsSeeder::class,
        ]);
    }
}
