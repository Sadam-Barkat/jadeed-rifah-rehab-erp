<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Admission extends Model
{
    protected $fillable = [
        'admission_code',
        'patient_id',
        'bed_id',
        'admitted_at',
        'program_days',
        'package_name',
        'status',
        'clinical_notes',
        'belongings_notes',
        'consent_notes',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'admitted_at' => 'datetime',
            'program_days' => 'integer',
        ];
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function bed(): BelongsTo
    {
        return $this->belongsTo(Bed::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
