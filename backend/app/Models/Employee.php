<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Employee extends Model
{
    protected $fillable = [
        'employee_code',
        'full_name',
        'father_name',
        'cnic',
        'phone',
        'email',
        'department',
        'designation',
        'join_date',
        'employment_type',
        'basic_salary',
        'status',
        'address',
        'emergency_contact',
        'notes',
        'user_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'join_date' => 'date',
            'basic_salary' => 'float',
        ];
    }

    public function attendances(): HasMany
    {
        return $this->hasMany(Attendance::class);
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
