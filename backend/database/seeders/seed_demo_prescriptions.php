<?php

use App\Models\Admission;
use App\Models\Doctor;
use App\Models\Medicine;
use App\Models\MedicinePrescription;
use App\Models\MedicinePrescriptionItem;
use App\Models\User;
use App\Support\SecureUpload;
use Illuminate\Support\Facades\Storage;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$doctorUser = User::query()->where('email', 'doctor@jadeed.local')->first()
    ?: User::query()->whereHas('role', fn ($q) => $q->where('slug', 'doctor'))->first();
$admission = Admission::query()->where('status', 'active')->with('patient')->orderBy('id')->first();
$doctor = Doctor::query()->where('status', 'active')->orderBy('id')->first();
$medicines = Medicine::query()->where('status', 'active')->orderBy('id')->get();

if (! $doctorUser || ! $admission || $medicines->isEmpty()) {
    echo "Missing doctor user, admission, or medicines\n";
    exit(1);
}

$lines = [
    ['name' => 'Paracetamol 500mg', 'qty' => 20, 'dosage' => '1 tab', 'frequency' => '8am · 2pm · 8pm'],
    ['name' => 'Ibuprofen 400mg', 'qty' => 15, 'dosage' => '1 tab', 'frequency' => 'After meals'],
    ['name' => 'Omeprazole 20mg', 'qty' => 14, 'dosage' => '1 cap', 'frequency' => 'Morning'],
    ['name' => 'Amoxicillin 500mg', 'qty' => 21, 'dosage' => '1 cap', 'frequency' => '8am · 8pm'],
    ['name' => 'Metronidazole 400mg', 'qty' => 15, 'dosage' => '1 tab', 'frequency' => 'With food'],
    ['name' => 'ORS sachets', 'qty' => 10, 'dosage' => '1 sachet', 'frequency' => 'As needed'],
    ['name' => 'Diazepam 5mg', 'qty' => 10, 'dosage' => '1 tab', 'frequency' => 'Night'],
    ['name' => 'Multivitamin', 'qty' => 30, 'dosage' => '1 tab', 'frequency' => 'Morning'],
    ['name' => 'Cetirizine 10mg', 'qty' => 10, 'dosage' => '1 tab', 'frequency' => 'Night'],
    ['name' => 'Domperidone 10mg', 'qty' => 20, 'dosage' => '1 tab', 'frequency' => 'Before meals'],
    ['name' => 'Lorazepam 1mg', 'qty' => 7, 'dosage' => '1 tab', 'frequency' => 'Night'],
    ['name' => 'Vitamin B complex', 'qty' => 30, 'dosage' => '1 tab', 'frequency' => 'Morning'],
];

$rx = MedicinePrescription::query()->create([
    'prescription_code' => 'RX-'.now()->format('Y').'-DEMO',
    'admission_id' => $admission->id,
    'patient_id' => $admission->patient_id,
    'doctor_id' => $doctor?->id,
    'status' => 'pending',
    'notes' => 'Demo multi-medicine prescription for scroll testing',
    'prescribed_by' => $doctorUser->id,
    'prescribed_at' => now(),
]);

foreach ($lines as $i => $line) {
    $med = $medicines[$i % $medicines->count()];
    MedicinePrescriptionItem::query()->create([
        'medicine_prescription_id' => $rx->id,
        'medicine_id' => $med->id,
        'medicine_name' => $line['name'],
        'quantity' => $line['qty'],
        'dosage' => $line['dosage'],
        'frequency' => $line['frequency'],
        'instructions' => null,
    ]);
}

$w = 800;
$h = 1100;
$img = imagecreatetruecolor($w, $h);
$bg = imagecolorallocate($img, 252, 250, 245);
$ink = imagecolorallocate($img, 30, 30, 30);
$accent = imagecolorallocate($img, 40, 110, 70);
imagefilledrectangle($img, 0, 0, $w, $h, $bg);
imagestring($img, 5, 48, 48, 'Jadeed Rifah - Handwritten Rx (Demo)', $accent);
imagestring($img, 4, 48, 100, '1. Paracetamol 500mg - 1 tab TDS', $ink);
imagestring($img, 4, 48, 130, '2. Omeprazole 20mg - 1 cap OD', $ink);
ob_start();
imagepng($img);
$png = ob_get_clean();
imagedestroy($img);
$path = 'prescription-photos/'.now()->format('Y/m').'/rx_demo_handwritten.png';
Storage::disk('public')->put($path, $png);

$hw = MedicinePrescription::query()->create([
    'prescription_code' => 'RX-'.now()->format('Y').'-HW01',
    'admission_id' => null,
    'patient_id' => null,
    'doctor_id' => null,
    'status' => 'pending',
    'notes' => 'Demo handwritten Rx — assign patient & doctor on dispense',
    'handwritten_image_path' => $path,
    'prescribed_by' => $doctorUser->id,
    'prescribed_at' => now(),
]);

echo "Created {$rx->prescription_code} with {$rx->items()->count()} items\n";
echo "Created {$hw->prescription_code} handwritten (photo only)\n";
echo 'URL path: '.SecureUpload::url($path)."\n";
