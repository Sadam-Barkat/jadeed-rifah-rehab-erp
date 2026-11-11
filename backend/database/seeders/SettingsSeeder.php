<?php

namespace Database\Seeders;

use App\Models\FacilitySetting;
use Illuminate\Database\Seeder;

class SettingsSeeder extends Seeder
{
    public function run(): void
    {
        if (FacilitySetting::query()->exists()) {
            return;
        }

        FacilitySetting::query()->create([
            'facility_name' => 'Jadeed Rifah Rehab Center',
            'short_name' => 'Jadeed Rifah',
            'phone' => '051-0000000',
            'email' => 'info@jadeedrifah.local',
            'address' => 'Islamabad',
            'city' => 'Islamabad',
            'timezone' => 'Asia/Karachi',
            'currency' => 'PKR',
            'session_timeout_minutes' => 60,
        ]);
    }
}
