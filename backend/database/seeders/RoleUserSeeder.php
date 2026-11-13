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
        // Admin: overview tabs + management. `patients` is API-only for Management tab.
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
            'finance' => ['billing', 'accounts', 'reports'],
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

        $adminRole = Role::query()->where('slug', 'admin')->firstOrFail();

        User::query()->updateOrCreate(
            ['email' => 'admin@jadeed.local'],
            [
                'staff_code' => 'ADM-0001',
                'name' => 'Admin',
                'password' => Hash::make('Admin@123'),
                'role_id' => $adminRole->id,
                'is_active' => true,
                'must_change_password' => false,
            ]
        );

        $fallbackRoleId = Role::query()->where('slug', 'receptionist')->value('id') ?? $adminRole->id;

        User::query()
            ->where('email', '!=', 'admin@jadeed.local')
            ->update([
                'is_active' => false,
                'role_id' => $fallbackRoleId,
            ]);

        Role::query()
            ->whereNotIn('slug', array_keys($roleNames))
            ->delete();
    }
}
