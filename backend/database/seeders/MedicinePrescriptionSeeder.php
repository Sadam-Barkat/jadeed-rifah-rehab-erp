<?php

namespace Database\Seeders;

use App\Models\Admission;
use App\Models\Medicine;
use App\Models\MedicinePrescription;
use App\Models\MedicinePrescriptionItem;
use App\Models\User;
use Illuminate\Database\Seeder;

class MedicinePrescriptionSeeder extends Seeder
{
    public function run(): void
    {
        $doctor = User::query()
            ->whereHas('role', fn ($q) => $q->where('slug', 'doctor'))
            ->where('is_active', true)
            ->orderBy('id')
            ->first();

        if (! $doctor) {
            return;
        }

        $admissions = Admission::query()
            ->with('patient')
            ->where('status', 'active')
            ->orderBy('id')
            ->limit(5)
            ->get();

        $medicines = Medicine::query()
            ->where('status', 'active')
            ->orderBy('id')
            ->limit(8)
            ->get();

        if ($admissions->isEmpty() || $medicines->isEmpty()) {
            return;
        }

        $existing = MedicinePrescription::query()->count();
        if ($existing >= 3) {
            return;
        }

        $samples = [
            [
                'notes' => 'Morning ward round',
                'lines' => [
                    ['qty' => 10, 'dosage' => '1 tablet', 'frequency' => '8am · 8pm', 'instructions' => 'After food'],
                    ['qty' => 5, 'dosage' => '5 ml', 'frequency' => '2pm', 'instructions' => 'With water'],
                ],
            ],
            [
                'notes' => 'Detox support',
                'lines' => [
                    ['qty' => 14, 'dosage' => '1 capsule', 'frequency' => '8am · 2pm · 8pm', 'instructions' => null],
                ],
            ],
            [
                'notes' => null,
                'lines' => [
                    ['qty' => 7, 'dosage' => '1 tablet', 'frequency' => 'Night 10pm', 'instructions' => 'Before sleep'],
                    ['qty' => 7, 'dosage' => '2 tablets', 'frequency' => '8am', 'instructions' => 'After breakfast'],
                ],
            ],
        ];

        $year = now()->format('Y');
        $next = MedicinePrescription::query()
            ->where('prescription_code', 'like', "RX-{$year}-%")
            ->count() + 1;

        foreach ($samples as $i => $sample) {
            $admission = $admissions[$i % $admissions->count()];
            $code = 'RX-'.$year.'-'.str_pad((string) ($next + $i), 4, '0', STR_PAD_LEFT);

            if (MedicinePrescription::query()->where('prescription_code', $code)->exists()) {
                continue;
            }

            $rx = MedicinePrescription::query()->create([
                'prescription_code' => $code,
                'admission_id' => $admission->id,
                'patient_id' => $admission->patient_id,
                'status' => 'pending',
                'notes' => $sample['notes'],
                'prescribed_by' => $doctor->id,
                'prescribed_at' => now()->subHours(2 + $i),
            ]);

            foreach ($sample['lines'] as $j => $line) {
                $medicine = $medicines[($i + $j) % $medicines->count()];
                MedicinePrescriptionItem::query()->create([
                    'medicine_prescription_id' => $rx->id,
                    'medicine_id' => $medicine->id,
                    'medicine_name' => $medicine->name,
                    'quantity' => $line['qty'],
                    'dosage' => $line['dosage'],
                    'frequency' => $line['frequency'],
                    'instructions' => $line['instructions'],
                ]);
            }
        }
    }
}
