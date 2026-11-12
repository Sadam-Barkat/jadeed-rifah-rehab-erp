<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Doctor extends Model
{
    protected $fillable = [
        'doctor_code',
        'full_name',
        'specialization',
        'license_no',
        'phone',
        'email',
        'status',
        'user_id',
        'notes',
        'created_by',
    ];

    public function rounds(): HasMany
    {
        return $this->hasMany(DoctorRound::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
