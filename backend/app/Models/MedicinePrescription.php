<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MedicinePrescription extends Model
{
    protected $fillable = [
        'prescription_code',
        'admission_id',
        'patient_id',
        'doctor_id',
        'nurse_id',
        'status',
        'notes',
        'handwritten_image_path',
        'prescribed_by',
        'dispensed_by',
        'prescribed_at',
        'dispensed_at',
        'slip_printed_at',
    ];

    protected function casts(): array
    {
        return [
            'prescribed_at' => 'datetime',
            'dispensed_at' => 'datetime',
            'slip_printed_at' => 'datetime',
        ];
    }

    public function admission(): BelongsTo
    {
        return $this->belongsTo(Admission::class);
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function doctor(): BelongsTo
    {
        return $this->belongsTo(Doctor::class);
    }

    public function nurse(): BelongsTo
    {
        return $this->belongsTo(User::class, 'nurse_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(MedicinePrescriptionItem::class);
    }

    public function prescriber(): BelongsTo
    {
        return $this->belongsTo(User::class, 'prescribed_by');
    }

    public function dispenser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dispensed_by');
    }
}
