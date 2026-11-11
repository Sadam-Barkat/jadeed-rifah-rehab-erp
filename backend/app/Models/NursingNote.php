<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NursingNote extends Model
{
    protected $fillable = [
        'note_code',
        'admission_id',
        'patient_id',
        'recorded_at',
        'shift',
        'temperature',
        'pulse',
        'bp_systolic',
        'bp_diastolic',
        'spo2',
        'weight_kg',
        'mood',
        'sleep_quality',
        'appetite',
        'observations',
        'interventions',
        'status',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'recorded_at' => 'datetime',
            'temperature' => 'float',
            'pulse' => 'integer',
            'bp_systolic' => 'integer',
            'bp_diastolic' => 'integer',
            'spo2' => 'integer',
            'weight_kg' => 'float',
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

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
