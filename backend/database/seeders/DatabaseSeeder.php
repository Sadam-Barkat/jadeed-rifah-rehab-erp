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
            InventorySeeder::class,
            DoctorSeeder::class,
            SettingsSeeder::class,
        ]);
    }
}
