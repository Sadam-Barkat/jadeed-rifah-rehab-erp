<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Medicine extends Model
{
    protected $fillable = [
        'medicine_code',
        'name',
        'generic_name',
        'form',
        'strength',
        'unit',
        'stock_qty',
        'reorder_level',
        'unit_price',
        'status',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'stock_qty' => 'integer',
            'reorder_level' => 'integer',
            'unit_price' => 'float',
        ];
    }

    public function dispenses(): HasMany
    {
        return $this->hasMany(MedicineDispense::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
