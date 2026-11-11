<?php

namespace Database\Seeders;

use App\Models\SecurityCamera;
use Illuminate\Database\Seeder;

class SecuritySeeder extends Seeder
{
    public function run(): void
    {
        $cameras = [
            ['camera_code' => 'CAM-001', 'location' => 'Main gate', 'zone' => 'Entrance', 'status' => 'online'],
            ['camera_code' => 'CAM-002', 'location' => 'Reception', 'zone' => 'Admin', 'status' => 'online'],
            ['camera_code' => 'CAM-003', 'location' => 'Ward A corridor', 'zone' => 'Clinical', 'status' => 'online'],
            ['camera_code' => 'CAM-004', 'location' => 'Pharmacy store', 'zone' => 'Stores', 'status' => 'maintenance'],
        ];

        foreach ($cameras as $camera) {
            SecurityCamera::query()->updateOrCreate(
                ['camera_code' => $camera['camera_code']],
                [
                    ...$camera,
                    'notes' => 'Inventory record only — no live feed control',
                ]
            );
        }
    }
}
