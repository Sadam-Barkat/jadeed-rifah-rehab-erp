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
            'receptionist' => ['reception', 'registration', 'admission', 'patients', 'beds'],
            'gatekeeper' => ['visitors'],
            'consultant-psychiatrist' => [
                'patients', 'medical-records', 'doctors', 'nursing',
                'treatment', 'discharge',
            ],
            'medical-officer' => [
                'patients', 'medical-records', 'doctors', 'nursing',
                'treatment', 'discharge',
            ],
            'nurse' => ['patients', 'nursing', 'medical-records'],
            'finance' => ['billing'],
            'dispenser' => ['pharmacy'],
            'inventory-manager' => ['inventory'],
            'cook' => ['inventory'],
            'clinical-psychologist' => ['psychology', 'patients'],
            'maulana' => ['spiritual', 'patients'],
            'security-guard' => [],
            'cleaner' => [],
        ];

        $roleNames = [
            'admin' => 'Admin',
            'receptionist' => 'Receptionist',
            'gatekeeper' => 'Gatekeeper',
            'consultant-psychiatrist' => 'Consultant Psychiatrist',
            'medical-officer' => 'Medical Officer',
            'nurse' => 'Nurse',
            'finance' => 'Finance',
            'dispenser' => 'Dispenser',
            'inventory-manager' => 'Inventory Manager',
            'cook' => 'Cook',
            'clinical-psychologist' => 'Clinical Psychologist / Manager',
            'maulana' => 'Maulana / Islamic Scholar',
            'security-guard' => 'Security Guard',
            'cleaner' => 'Cleaner',
        ];

        Role::query()->where('slug', 'pharmacist')->update([
            'slug' => 'dispenser',
            'name' => 'Dispenser',
            'modules' => ['pharmacy'],
        ]);

        foreach ($roleNames as $slug => $name) {
            Role::query()->updateOrCreate(
                ['slug' => $slug],
                [
                    'name' => $name,
                    'modules' => $roleModules[$slug] ?? [],
                ]
            );
        }

        // Legacy generic "doctor" → Consultant Psychiatrist
        $legacyDoctor = Role::query()->where('slug', 'doctor')->first();
        $psychRoleId = Role::query()->where('slug', 'consultant-psychiatrist')->value('id');
        if ($legacyDoctor && $psychRoleId) {
            User::query()->where('role_id', $legacyDoctor->id)->update(['role_id' => $psychRoleId]);
            $legacyDoctor->delete();
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
                'email' => 'psychiatrist@jadeed.local',
                'staff_code' => 'CPS-0001',
                'name' => 'Dr. Kamran Siddiqui',
                'password' => 'Psychiatrist@123',
                'role' => 'consultant-psychiatrist',
                'phone' => '03001110004',
            ],
            [
                'email' => 'mo@jadeed.local',
                'staff_code' => 'MO-0001',
                'name' => 'Dr. Sara Malik',
                'password' => 'MO@123',
                'role' => 'medical-officer',
                'phone' => '03001110014',
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
                'email' => 'dispenser@jadeed.local',
                'staff_code' => 'DSP-0001',
                'name' => 'Dispenser Ahmad',
                'password' => 'Dispenser@123',
                'role' => 'dispenser',
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
            [
                'email' => 'cook@jadeed.local',
                'staff_code' => 'COK-0001',
                'name' => 'Cook Staff',
                'password' => 'Cook@123',
                'role' => 'cook',
                'phone' => '03001110009',
            ],
            [
                'email' => 'psychologist@jadeed.local',
                'staff_code' => 'CPM-0001',
                'name' => 'Ayesha Maheen',
                'password' => 'Psychologist@123',
                'role' => 'clinical-psychologist',
                'phone' => '03001110010',
            ],
            [
                'email' => 'maulana@jadeed.local',
                'staff_code' => 'MAU-0001',
                'name' => 'Syed Ahmad Raza',
                'password' => 'Maulana@123',
                'role' => 'maulana',
                'phone' => '03001110011',
            ],
        ];

        User::query()
            ->where('email', 'pharmacist@jadeed.local')
            ->update(['email' => 'dispenser@jadeed.local']);

        User::query()
            ->where('email', 'doctor@jadeed.local')
            ->update(['email' => 'psychiatrist@jadeed.local']);

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
