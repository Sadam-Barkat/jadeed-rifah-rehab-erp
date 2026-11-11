<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Patient extends Model
{
    protected $fillable = [
        'patient_code',
        'first_name',
        'last_name',
        'father_name',
        'cnic',
        'gender',
        'date_of_birth',
        'age',
        'phone',
        'email',
        'address',
        'city',
        'blood_group',
        'marital_status',
        'referral_source',
        'photo_path',
        'status',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'age' => 'integer',
        ];
    }

    public function guardians(): HasMany
    {
        return $this->hasMany(PatientGuardian::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function getFullNameAttribute(): string
    {
        return trim(($this->first_name ?? '').' '.($this->last_name ?? ''));
    }
}
