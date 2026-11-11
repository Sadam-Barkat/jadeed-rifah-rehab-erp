<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SecurityShift extends Model
{
    protected $fillable = [
        'shift_code',
        'shift_date',
        'shift',
        'guard_name',
        'check_in_at',
        'check_out_at',
        'notes',
        'status',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'shift_date' => 'date',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
