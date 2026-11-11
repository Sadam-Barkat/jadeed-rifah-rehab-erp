<?php

namespace Database\Seeders;

use App\Models\Employee;
use Illuminate\Database\Seeder;

class EmployeeSeeder extends Seeder
{
    public function run(): void
    {
        $items = [
            ['full_name' => 'Ayesha Malik', 'department' => 'Nursing', 'designation' => 'Head Nurse', 'basic_salary' => 65000],
            ['full_name' => 'Imran Qureshi', 'department' => 'Security', 'designation' => 'Gate Supervisor', 'basic_salary' => 45000],
            ['full_name' => 'Sara Ahmed', 'department' => 'Psychology', 'designation' => 'Counselor', 'basic_salary' => 70000],
            ['full_name' => 'Bilal Hussain', 'department' => 'Kitchen', 'designation' => 'Cook', 'basic_salary' => 40000],
        ];

        foreach ($items as $i => $item) {
            $code = 'EMP-'.str_pad((string) ($i + 1), 4, '0', STR_PAD_LEFT);
            Employee::query()->updateOrCreate(
                ['employee_code' => $code],
                [
                    ...$item,
                    'phone' => '0300'.str_pad((string) (1000000 + $i), 7, '0', STR_PAD_LEFT),
                    'employment_type' => 'full_time',
                    'join_date' => now()->subMonths(6 - $i)->toDateString(),
                    'status' => 'active',
                ]
            );
        }
    }
}
