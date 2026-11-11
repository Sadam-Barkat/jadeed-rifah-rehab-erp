<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Discharge extends Model
{
    protected $fillable = [
        'discharge_code',
        'admission_id',
        'patient_id',
        'discharged_at',
        'final_summary',
        'aftercare_instructions',
        'follow_up_date',
        'belongings_handover',
        'family_handover',
        'fee_clearance_notes',
        'status',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'discharged_at' => 'datetime',
            'follow_up_date' => 'date',
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
}
