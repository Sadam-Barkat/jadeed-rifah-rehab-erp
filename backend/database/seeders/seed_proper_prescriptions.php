<?php

use App\Models\Admission;
use App\Models\Doctor;
use App\Models\Medicine;
use App\Models\MedicinePrescription;
use App\Models\MedicinePrescriptionItem;
use App\Models\User;
use Illuminate\Support\Facades\Storage;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$doctorUser = User::query()->where('email', 'doctor@jadeed.local')->first();
$nurse = User::query()->whereHas('role', fn ($q) => $q->where('slug', 'nurse'))->orderBy('id')->first();
$doctor = Doctor::query()->where('status', 'active')->orderBy('id')->first();
$medicines = Medicine::query()->where('status', 'active')->orderBy('id')->get();
$admissions = Admission::query()->where('status', 'active')->with('patient')->orderBy('id')->get();

if (! $doctorUser || ! $nurse || ! $doctor || $medicines->isEmpty() || $admissions->isEmpty()) {
    echo "Missing required seed data\n";
    exit(1);
}

MedicinePrescription::query()
    ->whereIn('prescription_code', [
        'RX-'.now()->format('Y').'-DEMO',
        'RX-'.now()->format('Y').'-HW01',
        'RX-'.now()->format('Y').'-P001',
        'RX-'.now()->format('Y').'-P002',
        'RX-'.now()->format('Y').'-HW02',
    ])
    ->each(function (MedicinePrescription $rx) {
        $rx->items()->delete();
        $rx->delete();
    });

$linesA = [
    ['name' => 'Paracetamol 500mg', 'qty' => 20, 'dosage' => '1 tab', 'frequency' => 'Morning · Evening · Night'],
    ['name' => 'Omeprazole 20mg', 'qty' => 14, 'dosage' => '1 cap', 'frequency' => 'Morning · Before meals'],
    ['name' => 'Multivitamin', 'qty' => 30, 'dosage' => '1 tab', 'frequency' => 'Morning'],
    ['name' => 'Diazepam 5mg', 'qty' => 10, 'dosage' => '1 tab', 'frequency' => 'Night'],
    ['name' => 'ORS sachets', 'qty' => 8, 'dosage' => '1 sachet', 'frequency' => 'SOS'],
    ['name' => 'Cetirizine 10mg', 'qty' => 10, 'dosage' => '1 tab', 'frequency' => 'Night'],
    ['name' => 'Domperidone 10mg', 'qty' => 20, 'dosage' => '1 tab', 'frequency' => 'Before meals'],
    ['name' => 'Vitamin B complex', 'qty' => 30, 'dosage' => '1 tab', 'frequency' => 'Morning'],
    ['name' => 'Ibuprofen 400mg', 'qty' => 15, 'dosage' => '1 tab', 'frequency' => 'After meals'],
    ['name' => 'Amoxicillin 500mg', 'qty' => 21, 'dosage' => '1 cap', 'frequency' => '8:00 AM · 8:00 PM'],
];

$admA = $admissions[0];
$rxA = MedicinePrescription::query()->create([
    'prescription_code' => 'RX-'.now()->format('Y').'-P001',
    'admission_id' => $admA->id,
    'patient_id' => $admA->patient_id,
    'doctor_id' => $doctor->id,
    'nurse_id' => $nurse->id,
    'status' => 'pending',
    'notes' => 'Typed multi-medicine sample',
    'prescribed_by' => $doctorUser->id,
    'prescribed_at' => now()->subMinutes(20),
]);

foreach ($linesA as $i => $line) {
    $med = $medicines[$i % $medicines->count()];
    MedicinePrescriptionItem::query()->create([
        'medicine_prescription_id' => $rxA->id,
        'medicine_id' => $med->id,
        'medicine_name' => $line['name'],
        'quantity' => $line['qty'],
        'dosage' => $line['dosage'],
        'frequency' => $line['frequency'],
    ]);
}

$admB = $admissions[1] ?? $admissions[0];
$rxB = MedicinePrescription::query()->create([
    'prescription_code' => 'RX-'.now()->format('Y').'-P002',
    'admission_id' => $admB->id,
    'patient_id' => $admB->patient_id,
    'doctor_id' => $doctor->id,
    'nurse_id' => $nurse->id,
    'status' => 'pending',
    'notes' => 'Short typed sample',
    'prescribed_by' => $doctorUser->id,
    'prescribed_at' => now()->subMinutes(10),
]);

foreach (
    [
        ['name' => 'Paracetamol 500mg', 'qty' => 12, 'dosage' => '1 tab', 'frequency' => 'TDS'],
        ['name' => 'Omeprazole 20mg', 'qty' => 7, 'dosage' => '1 cap', 'frequency' => 'OD · Morning'],
        ['name' => 'Lorazepam 1mg', 'qty' => 5, 'dosage' => '1 tab', 'frequency' => 'Night'],
    ] as $i => $line
) {
    $med = $medicines[$i % $medicines->count()];
    MedicinePrescriptionItem::query()->create([
        'medicine_prescription_id' => $rxB->id,
        'medicine_id' => $med->id,
        'medicine_name' => $line['name'],
        'quantity' => $line['qty'],
        'dosage' => $line['dosage'],
        'frequency' => $line['frequency'],
    ]);
}

$w = 800;
$h = 1100;
$img = imagecreatetruecolor($w, $h);
$bg = imagecolorallocate($img, 252, 250, 245);
$ink = imagecolorallocate($img, 30, 30, 30);
$accent = imagecolorallocate($img, 40, 110, 70);
imagefilledrectangle($img, 0, 0, $w, $h, $bg);
$patientName = $admissions[2]->patient->full_name ?? 'Patient';
imagestring($img, 5, 48, 48, 'Jadeed Rifah - Handwritten Rx', $accent);
imagestring($img, 4, 48, 90, 'Patient: '.$patientName, $ink);
imagestring($img, 4, 48, 120, 'Doctor: '.$doctor->full_name, $ink);
imagestring($img, 4, 48, 150, 'Specialty: '.$doctor->specialization, $ink);
imagestring($img, 4, 48, 200, '1. Paracetamol 500mg - 1 tab TDS', $ink);
imagestring($img, 4, 48, 230, '2. Omeprazole 20mg - 1 cap OD', $ink);
imagestring($img, 4, 48, 260, '3. Multivitamin - 1 tab Morning', $ink);
ob_start();
imagepng($img);
$png = ob_get_clean();
imagedestroy($img);

$path = 'prescription-photos/'.now()->format('Y/m').'/rx_hw_sample.png';
Storage::disk('public')->put($path, $png);

$admC = $admissions[2] ?? $admissions[0];
$rxC = MedicinePrescription::query()->create([
    'prescription_code' => 'RX-'.now()->format('Y').'-HW02',
    'admission_id' => $admC->id,
    'patient_id' => $admC->patient_id,
    'doctor_id' => $doctor->id,
    'nurse_id' => $nurse->id,
    'status' => 'pending',
    'notes' => 'Handwritten sample with patient + nurse',
    'handwritten_image_path' => $path,
    'prescribed_by' => $doctorUser->id,
    'prescribed_at' => now()->subMinutes(5),
]);

echo "Created {$rxA->prescription_code} · {$admA->patient->full_name} · {$doctor->full_name} · {$rxA->items()->count()} items\n";
echo "Created {$rxB->prescription_code} · {$admB->patient->full_name} · {$doctor->full_name} · {$rxB->items()->count()} items\n";
echo "Created {$rxC->prescription_code} · {$admC->patient->full_name} · {$doctor->full_name} · Photo\n";
echo "Nurse: {$nurse->name}\n";
echo "Specialty: {$doctor->specialization}\n";
