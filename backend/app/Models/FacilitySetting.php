<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FacilitySetting extends Model
{
    protected $fillable = [
        'facility_name',
        'short_name',
        'phone',
        'email',
        'address',
        'city',
        'timezone',
        'currency',
        'session_timeout_minutes',
        'notes',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'session_timeout_minutes' => 'integer',
        ];
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
