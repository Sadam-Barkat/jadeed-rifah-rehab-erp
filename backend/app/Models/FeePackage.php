<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FeePackage extends Model
{
    protected $fillable = [
        'name',
        'program_days',
        'amount',
        'description',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'program_days' => 'integer',
            'amount' => 'float',
        ];
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }
}
