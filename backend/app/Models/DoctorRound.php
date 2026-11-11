<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DoctorRound extends Model
{
    protected $fillable = [
        'round_code',
        'doctor_id',
        'admission_id',
        'patient_id',
        'round_at',
        'round_type',
        'vitals_summary',
        'findings',
        'orders',
        'next_review_at',
        'status',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'round_at' => 'datetime',
            'next_review_at' => 'datetime',
        ];
    }

    public function doctor(): BelongsTo
    {
        return $this->belongsTo(Doctor::class);
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
