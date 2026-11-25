<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PsychologySession extends Model
{
    protected $fillable = [
        'session_code',
        'admission_id',
        'patient_id',
        'session_at',
        'session_type',
        'duration_minutes',
        'mood_before',
        'mood_after',
        'topics',
        'observations',
        'homework',
        'next_session_date',
        'status',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'session_at' => 'datetime',
            'next_session_date' => 'date',
            'duration_minutes' => 'integer',
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
