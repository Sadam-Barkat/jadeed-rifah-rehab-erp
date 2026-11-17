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
        $adminModules = [
            'owner-dashboard',
            'admin-patients',
            'admin-pharmacy',
            'admin-inventory',
            'admin-finance',
            'admin-visitors',
            'admin-staff',
            'users',
            'settings',
            'logs',
            'patients',
            'registration',
            'admission',
            'discharge',
            'billing',
        ];

        $roleModules = [
            'admin' => $adminModules,
            'receptionist' => ['registration', 'admission', 'patients', 'beds'],
            'gatekeeper' => ['visitors'],
            'doctor' => [
                'patients', 'medical-records', 'doctors', 'nursing',
                'treatment', 'discharge',
            ],
            'nurse' => ['patients', 'nursing', 'medical-records'],
            'finance' => ['billing'],
            'pharmacist' => ['pharmacy'],
            'inventory-manager' => ['inventory', 'kitchen'],
        ];

        $roleNames = [
            'admin' => 'Admin',
            'receptionist' => 'Receptionist',
            'gatekeeper' => 'Gatekeeper',
            'doctor' => 'Doctor',
            'nurse' => 'Nurse',
            'finance' => 'Finance',
            'pharmacist' => 'Pharmacist',
            'inventory-manager' => 'Inventory Manager',
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

        Role::query()
            ->whereNotIn('slug', array_keys($roleNames))
            ->delete();

        $staff = [
            [
                'email' => 'admin@jadeed.local',
                'staff_code' => 'ADM-0001',
                'name' => 'Admin',
                'password' => 'Admin@123',
                'role' => 'admin',
                'phone' => '03001110001',
            ],
            [
                'email' => 'reception@jadeed.local',
                'staff_code' => 'REC-0001',
                'name' => 'Reception Staff',
                'password' => 'Reception@123',
                'role' => 'receptionist',
                'phone' => '03001110002',
            ],
            [
                'email' => 'gate@jadeed.local',
                'staff_code' => 'GAT-0001',
                'name' => 'Gate Staff',
                'password' => 'Gate@123',
                'role' => 'gatekeeper',
                'phone' => '03001110003',
            ],
            [
                'email' => 'doctor@jadeed.local',
                'staff_code' => 'DOC-0001',
                'name' => 'Dr. Kamran Siddiqui',
                'password' => 'Doctor@123',
                'role' => 'doctor',
                'phone' => '03001110004',
            ],
            [
                'email' => 'nurse@jadeed.local',
                'staff_code' => 'NUR-0001',
                'name' => 'Nurse Ayesha',
                'password' => 'Nurse@123',
                'role' => 'nurse',
                'phone' => '03001110005',
            ],
            [
                'email' => 'finance@jadeed.local',
                'staff_code' => 'FIN-0001',
                'name' => 'Finance Staff',
                'password' => 'Finance@123',
                'role' => 'finance',
                'phone' => '03001110006',
            ],
            [
                'email' => 'pharmacist@jadeed.local',
                'staff_code' => 'PHR-0001',
                'name' => 'Pharmacist Ahmad',
                'password' => 'Pharmacist@123',
                'role' => 'pharmacist',
                'phone' => '03001110007',
            ],
            [
                'email' => 'inventory@jadeed.local',
                'staff_code' => 'INV-0001',
                'name' => 'Inventory Staff',
                'password' => 'Inventory@123',
                'role' => 'inventory-manager',
                'phone' => '03001110008',
            ],
        ];

        $keepEmails = [];
        foreach ($staff as $row) {
            $keepEmails[] = $row['email'];
            $roleId = Role::query()->where('slug', $row['role'])->value('id');
            User::query()->updateOrCreate(
                ['email' => $row['email']],
                [
                    'staff_code' => $row['staff_code'],
                    'name' => $row['name'],
                    'phone' => $row['phone'],
                    'password' => Hash::make($row['password']),
                    'role_id' => $roleId,
                    'is_active' => true,
                    'must_change_password' => false,
                ]
            );
        }

        User::query()
            ->whereNotIn('email', $keepEmails)
            ->update(['is_active' => false]);
    }
}
