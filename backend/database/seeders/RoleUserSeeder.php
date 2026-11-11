<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class RoleUserSeeder extends Seeder
{
    public function run(): void
    {
        $allModules = [
            'owner-dashboard', 'ceo-control', 'general-management', 'tasks',
            'attendance', 'hr', 'payroll', 'users',
            'registration', 'admission', 'patients', 'medical-records', 'doctors',
            'psychology', 'nursing', 'pharmacy', 'lab', 'treatment', 'discharge', 'beds',
            'billing', 'accounts', 'purchase', 'inventory',
            'kitchen', 'canteen', 'assets', 'visitors',
            'compliance', 'reports', 'complaints', 'security', 'documents',
            'notifications', 'settings',
        ];

        $roleModules = [
            'owner' => $allModules,
            'general-manager' => array_values(array_diff($allModules, ['settings'])),
            'administrator' => [
                'general-management', 'tasks', 'attendance', 'registration', 'admission',
                'patients', 'beds', 'discharge', 'visitors', 'documents', 'notifications',
            ],
            'doctor' => [
                'patients', 'medical-records', 'doctors', 'nursing', 'pharmacy', 'lab',
                'treatment', 'discharge', 'documents',
            ],
            'psychologist' => ['patients', 'psychology', 'treatment', 'documents'],
            'nurse' => ['patients', 'nursing', 'medical-records', 'pharmacy', 'documents'],
            'accountant' => ['billing', 'accounts', 'purchase', 'reports', 'documents'],
            'hr-officer' => ['attendance', 'hr', 'payroll', 'users', 'documents'],
            'pharmacist' => ['pharmacy', 'inventory', 'purchase', 'documents'],
            'kitchen-manager' => ['kitchen', 'canteen', 'inventory', 'purchase'],
            'security-staff' => ['visitors', 'security', 'complaints'],
        ];

        $roleNames = [
            'owner' => 'Owner / Chairman',
            'general-manager' => 'General Manager',
            'administrator' => 'Administrator',
            'doctor' => 'Psychiatrist / Doctor',
            'psychologist' => 'Psychologist',
            'nurse' => 'Nurse',
            'accountant' => 'Accountant',
            'hr-officer' => 'HR Officer',
            'pharmacist' => 'Pharmacist',
            'kitchen-manager' => 'Kitchen / Canteen Manager',
            'security-staff' => 'Gate / Security Staff',
        ];

        foreach ($roleNames as $slug => $name) {
            Role::query()->updateOrCreate(
                ['slug' => $slug],
                [
                    'name' => $name,
                    'modules' => $roleModules[$slug] ?? [],
                ]
            );
        }

        $ownerRole = Role::query()->where('slug', 'owner')->firstOrFail();

        User::query()->updateOrCreate(
            ['email' => 'owner@jadeed.local'],
            [
                'name' => 'Owner',
                'password' => Hash::make('Owner@123'),
                'role_id' => $ownerRole->id,
                'is_active' => true,
            ]
        );

        foreach ($roleNames as $slug => $name) {
            if ($slug === 'owner') {
                continue;
            }

            $role = Role::query()->where('slug', $slug)->firstOrFail();
            User::query()->updateOrCreate(
                ['email' => $slug.'@jadeed.local'],
                [
                    'name' => $name,
                    'password' => Hash::make('Demo@123'),
                    'role_id' => $role->id,
                    'is_active' => true,
                ]
            );
        }
    }
}
