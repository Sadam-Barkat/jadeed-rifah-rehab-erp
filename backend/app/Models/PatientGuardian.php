<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PatientGuardian extends Model
{
    protected $fillable = [
        'patient_id',
        'name',
        'relation',
        'phone',
        'cnic',
        'address',
        'is_primary',
        'is_emergency',
    ];

    protected function casts(): array
    {
        return [
            'is_primary' => 'boolean',
            'is_emergency' => 'boolean',
        ];
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }
}
