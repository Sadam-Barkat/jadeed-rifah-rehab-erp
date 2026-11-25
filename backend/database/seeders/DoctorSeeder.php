<?php

namespace Database\Seeders;

use App\Models\Doctor;
use App\Models\User;
use Illuminate\Database\Seeder;

class DoctorSeeder extends Seeder
{
    public function run(): void
    {
        $psychUser = User::query()->where('email', 'psychiatrist@jadeed.local')->first()
            ?: User::query()->where('email', 'doctor@jadeed.local')->first();
        $moUser = User::query()->where('email', 'mo@jadeed.local')->first();

        // Keep legacy DOC-0001 row in sync with Consultant Psychiatrist login.
        Doctor::query()->updateOrCreate(
            ['doctor_code' => 'DOC-0001'],
            [
                'full_name' => 'Dr. Kamran Siddiqui',
                'specialization' => 'Consultant Psychiatrist',
                'license_no' => 'PMC-77821',
                'phone' => '03001110004',
                'email' => 'psychiatrist@jadeed.local',
                'status' => 'active',
                'user_id' => $psychUser?->id,
                'notes' => 'Lead psychiatrist — prescribe, rounds, discharge request, vitals review',
            ]
        );

        Doctor::query()->updateOrCreate(
            ['doctor_code' => 'DOC-0002'],
            [
                'full_name' => 'Dr. Sara Malik',
                'specialization' => 'Medical Officer',
                'license_no' => 'PMC-88412',
                'phone' => '03001110014',
                'email' => 'mo@jadeed.local',
                'status' => 'active',
                'user_id' => $moUser?->id,
                'notes' => 'Medical Officer — daily medical rounds and general medical care',
            ]
        );

        // Redirect old doctor@ login email if still present.
        if ($psychUser && $psychUser->email === 'doctor@jadeed.local') {
            $psychUser->update(['email' => 'psychiatrist@jadeed.local']);
        }
    }
}
