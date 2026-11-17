<?php

namespace Database\Seeders;

use App\Models\Doctor;
use App\Models\User;
use Illuminate\Database\Seeder;

class DoctorSeeder extends Seeder
{
    public function run(): void
    {
        $doctorUser = User::query()->where('email', 'doctor@jadeed.local')->first();

        Doctor::query()->updateOrCreate(
            ['doctor_code' => 'DOC-0001'],
            [
                'full_name' => 'Dr. Kamran Siddiqui',
                'specialization' => 'Psychiatry',
                'license_no' => 'PMC-77821',
                'phone' => '03001110004',
                'email' => 'doctor@jadeed.local',
                'status' => 'active',
                'user_id' => $doctorUser?->id,
                'notes' => 'Lead psychiatrist',
            ]
        );
    }
}
