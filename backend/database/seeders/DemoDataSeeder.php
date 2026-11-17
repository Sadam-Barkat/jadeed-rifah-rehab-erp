<?php

namespace Database\Seeders;

use App\Models\AccountEntry;
use App\Models\Admission;
use App\Models\Bed;
use App\Models\Doctor;
use App\Models\DoctorRound;
use App\Models\FeePackage;
use App\Models\Invoice;
use App\Models\NursingNote;
use App\Models\Patient;
use App\Models\Payment;
use App\Models\StaffAttendance;
use App\Models\User;
use App\Models\VisitorLog;
use Illuminate\Database\Seeder;

/** Shared demo rows for testing — at least 10 per major list. */
class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        $reception = User::query()->where('email', 'reception@jadeed.local')->first();
        $finance = User::query()->where('email', 'finance@jadeed.local')->first();
        $gate = User::query()->where('email', 'gate@jadeed.local')->first();
        $nurse = User::query()->where('email', 'nurse@jadeed.local')->first();
        $doctorUser = User::query()->where('email', 'doctor@jadeed.local')->first();
        $admin = User::query()->where('email', 'admin@jadeed.local')->first();
        $doctor = Doctor::query()->where('doctor_code', 'DOC-0001')->first();
        $package = FeePackage::query()->orderBy('id')->first();

        if (! $reception || ! $finance || ! $package) {
            return;
        }

        $names = [
            ['Ali', 'Raza'], ['Hassan', 'Khan'], ['Bilal', 'Ahmed'], ['Usman', 'Malik'],
            ['Omar', 'Sheikh'], ['Zain', 'Iqbal'], ['Hamza', 'Nawaz'], ['Saad', 'Farooq'],
            ['Tariq', 'Javed'], ['Imran', 'Qureshi'],
        ];

        $patients = collect();
        foreach ($names as $i => [$first, $last]) {
            $n = $i + 1;
            $patients->push(Patient::query()->updateOrCreate(
                ['patient_code' => 'PAT-'.str_pad((string) $n, 4, '0', STR_PAD_LEFT)],
                [
                    'first_name' => $first,
                    'last_name' => $last,
                    'father_name' => 'Father '.$last,
                    'cnic' => '42101'.str_pad((string) (1000000 + $n), 7, '0', STR_PAD_LEFT),
                    'gender' => 'male',
                    'phone' => '0300'.str_pad((string) (1000000 + $n), 7, '0', STR_PAD_LEFT),
                    'city' => 'Lahore',
                    'plan_days' => 30,
                    'status' => $n <= 8 ? 'admitted' : 'registered',
                    'created_by' => $reception->id,
                ]
            ));
        }

        $beds = Bed::query()->where('status', 'available')->orderBy('id')->get();
        $admissions = collect();
        foreach ($patients->take(10) as $i => $patient) {
            $n = $i + 1;
            $code = 'ADM-'.str_pad((string) $n, 4, '0', STR_PAD_LEFT);
            $active = $n <= 8;
            $bed = $active ? ($beds[$i] ?? null) : null;
            if ($bed) {
                $bed->update(['status' => 'occupied']);
            }

            $admissions->push(Admission::query()->updateOrCreate(
                ['admission_code' => $code],
                [
                    'patient_id' => $patient->id,
                    'bed_id' => $bed?->id,
                    'admitted_at' => now()->subDays(12 - $n),
                    'program_days' => 30,
                    'package_name' => $package->name,
                    'status' => $active ? 'active' : 'discharged',
                    'created_by' => $reception->id,
                ]
            ));

            if ($active) {
                $patient->update(['status' => 'admitted']);
            }
        }

        foreach ($admissions->take(10) as $i => $admission) {
            $n = $i + 1;
            $code = 'INV-'.now()->format('Y').'-'.str_pad((string) $n, 4, '0', STR_PAD_LEFT);
            $amount = (float) $package->amount;
            $paid = $n <= 3 ? $amount : ($n <= 6 ? round($amount * 0.4, 2) : 0);
            $balance = round($amount - $paid, 2);
            $status = $balance <= 0 ? 'paid' : 'unpaid';

            $invoice = Invoice::query()->updateOrCreate(
                ['invoice_code' => $code],
                [
                    'admission_id' => $admission->id,
                    'patient_id' => $admission->patient_id,
                    'fee_package_id' => $package->id,
                    'package_name' => $package->name,
                    'program_days' => $package->program_days,
                    'amount' => $amount,
                    'discount' => 0,
                    'total_amount' => $amount,
                    'installment_count' => $n % 2 === 0 ? 3 : 1,
                    'paid_amount' => $paid,
                    'balance' => $balance,
                    'status' => $status,
                    'issued_at' => now()->subDays(10 - min($n, 9)),
                    'due_date' => now()->addDays(20),
                    'notes' => 'Test invoice',
                    'created_by' => $finance->id,
                ]
            );

            if ($paid > 0) {
                $payCode = 'PAY-'.now()->format('Y').'-'.str_pad((string) $n, 4, '0', STR_PAD_LEFT);
                Payment::query()->updateOrCreate(
                    ['payment_code' => $payCode],
                    [
                        'invoice_id' => $invoice->id,
                        'patient_id' => $invoice->patient_id,
                        'amount' => $paid,
                        'installment_no' => 1,
                        'method' => $n % 2 === 0 ? 'bank' : 'cash',
                        'paid_at' => now()->subDays(8 - min($n, 7)),
                        'reference' => 'REF-'.$n,
                        'notes' => 'Test payment',
                        'approval_status' => 'approved',
                        'approved_by' => $admin?->id,
                        'approved_at' => now()->subDays(7 - min($n, 6)),
                        'created_by' => $finance->id,
                    ]
                );
            }
        }

        // Extra payments to reach 10 payment rows if some invoices unpaid.
        $extraPay = 1;
        foreach (Invoice::query()->where('balance', '>', 0)->orderBy('id')->limit(10)->get() as $invoice) {
            if (Payment::query()->where('invoice_id', $invoice->id)->exists()) {
                continue;
            }
            $payCode = 'PAY-'.now()->format('Y').'-X'.str_pad((string) $extraPay, 3, '0', STR_PAD_LEFT);
            Payment::query()->updateOrCreate(
                ['payment_code' => $payCode],
                [
                    'invoice_id' => $invoice->id,
                    'patient_id' => $invoice->patient_id,
                    'amount' => min(25000, (float) $invoice->balance),
                    'installment_no' => 1,
                    'method' => 'jazzcash',
                    'paid_at' => now()->subDays($extraPay),
                    'reference' => 'PENDING-'.$extraPay,
                    'notes' => 'Pending approval test',
                    'approval_status' => $extraPay <= 3 ? 'pending' : 'approved',
                    'approved_by' => $extraPay <= 3 ? null : $admin?->id,
                    'approved_at' => $extraPay <= 3 ? null : now()->subHours($extraPay),
                    'created_by' => $finance->id,
                ]
            );
            $extraPay++;
            if ($extraPay > 7) {
                break;
            }
        }

        $visitorNames = [
            ['Ahmed Ali', '35202-1234567-1'],
            ['Sara Khan', '35202-2345678-2'],
            ['Usman Raza', '35202-3456789-3'],
            ['Nadia Malik', '35202-4567890-4'],
            ['Farhan Iqbal', '35202-5678901-5'],
            ['Hina Sheikh', '35202-6789012-6'],
            ['Kashif Nawaz', '35202-7890123-7'],
            ['Maryam Javed', '35202-8901234-8'],
            ['Rehan Qureshi', '35202-9012345-9'],
            ['Ayesha Farooq', '35202-0123456-0'],
        ];

        foreach ($visitorNames as $i => [$name, $cnic]) {
            $n = $i + 1;
            $code = 'VIS-'.now()->format('Y').'-'.str_pad((string) $n, 4, '0', STR_PAD_LEFT);
            $admission = $admissions[$i % max(1, $admissions->count())] ?? null;
            $linked = $n <= 6 && $admission && $admission->status === 'active';
            $inside = $n <= 4;

            VisitorLog::query()->updateOrCreate(
                ['visit_code' => $code],
                [
                    'admission_id' => $linked ? $admission->id : null,
                    'patient_id' => $linked ? $admission->patient_id : null,
                    'visitor_name' => $name,
                    'party_size' => ($n % 3) + 1,
                    'relation' => $linked ? 'relative' : null,
                    'phone' => '0321'.str_pad((string) (1000000 + $n), 7, '0', STR_PAD_LEFT),
                    'cnic' => $cnic,
                    'purpose' => $linked ? 'Family visit' : 'General inquiry',
                    'check_in_at' => now()->subHours(10 - $n),
                    'check_out_at' => $inside ? null : now()->subHours(9 - $n),
                    'status' => $inside ? 'checked_in' : 'checked_out',
                    'created_by' => $gate?->id ?: $reception->id,
                ]
            );
        }

        if ($nurse) {
            $notePool = $admissions->values();
            for ($n = 1; $n <= 10; $n++) {
                $admission = $notePool[($n - 1) % max(1, $notePool->count())];
                NursingNote::query()->updateOrCreate(
                    ['note_code' => 'NN-'.now()->format('Y').'-'.str_pad((string) $n, 4, '0', STR_PAD_LEFT)],
                    [
                        'admission_id' => $admission->id,
                        'patient_id' => $admission->patient_id,
                        'recorded_at' => now()->subHours(12 - $n),
                        'shift' => $n % 3 === 0 ? 'night' : ($n % 2 === 0 ? 'evening' : 'morning'),
                        'temperature' => 98.0 + ($n * 0.1),
                        'pulse' => 70 + $n,
                        'bp_systolic' => 110 + $n,
                        'bp_diastolic' => 70 + ($n % 5),
                        'spo2' => 97,
                        'mood' => 'stable',
                        'sleep_quality' => 'fair',
                        'appetite' => 'good',
                        'observations' => 'Test nursing note '.$n,
                        'interventions' => 'Routine vitals',
                        'status' => $n === 10 ? 'flagged' : 'recorded',
                        'created_by' => $nurse->id,
                    ]
                );
            }
        }

        if ($doctor && $doctorUser) {
            $roundTypes = ['morning', 'evening', 'follow_up', 'emergency'];
            $roundPool = $admissions->values();
            for ($n = 1; $n <= 10; $n++) {
                $admission = $roundPool[($n - 1) % max(1, $roundPool->count())];
                DoctorRound::query()->updateOrCreate(
                    ['round_code' => 'DR-'.now()->format('Y').'-'.str_pad((string) $n, 4, '0', STR_PAD_LEFT)],
                    [
                        'doctor_id' => $doctor->id,
                        'admission_id' => $admission->id,
                        'patient_id' => $admission->patient_id,
                        'round_at' => now()->subHours(14 - $n),
                        'round_type' => $roundTypes[($n - 1) % count($roundTypes)],
                        'vitals_summary' => 'Stable',
                        'findings' => 'Test doctor round '.$n,
                        'orders' => 'Continue current plan',
                        'next_review_at' => now()->addDay(),
                        'status' => 'completed',
                        'created_by' => $doctorUser->id,
                    ]
                );
            }
        }

        $accountRows = [
            ['income', 'fee_collection', 50000],
            ['income', 'fee_collection', 35000],
            ['income', 'other', 8000],
            ['expense', 'utilities', 18500],
            ['expense', 'utilities', 9200],
            ['expense', 'supplies', 12000],
            ['expense', 'petty', 4500],
            ['expense', 'salary', 80000],
            ['expense', 'maintenance', 15000],
            ['income', 'fee_collection', 42000],
        ];
        foreach ($accountRows as $i => [$type, $category, $amount]) {
            $n = $i + 1;
            AccountEntry::query()->updateOrCreate(
                ['entry_code' => 'AE-'.now()->format('Y').'-'.str_pad((string) $n, 4, '0', STR_PAD_LEFT)],
                [
                    'entry_date' => now()->subDays(10 - $i)->toDateString(),
                    'type' => $type,
                    'category' => $category,
                    'amount' => $amount,
                    'payment_method' => $type === 'income' ? 'bank' : 'cash',
                    'reference' => 'ACC-'.$n,
                    'description' => 'Test ledger entry '.$n,
                    'status' => 'posted',
                    'created_by' => $finance->id,
                ]
            );
        }

        $staff = User::query()->where('is_active', true)->orderBy('id')->get();
        foreach ($staff->take(8) as $i => $user) {
            for ($d = 0; $d < 2; $d++) {
                $date = now()->subDays($d)->toDateString();
                StaffAttendance::query()->updateOrCreate(
                    [
                        'user_id' => $user->id,
                        'attendance_date' => $date,
                    ],
                    [
                        'check_in_at' => now()->subDays($d)->setTime(9, $i),
                        'checked_in_by' => $gate?->id ?: $admin?->id,
                        'status' => 'present',
                        'notes' => 'Test attendance',
                    ]
                );
            }
        }
    }
}
