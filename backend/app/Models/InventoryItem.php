<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventoryItem extends Model
{
    protected $fillable = [
        'item_code',
        'name',
        'category',
        'unit',
        'stock_qty',
        'reorder_level',
        'unit_cost',
        'status',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'stock_qty' => 'float',
            'reorder_level' => 'float',
            'unit_cost' => 'float',
        ];
    }

    public function movements(): HasMany
    {
        return $this->hasMany(InventoryMovement::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
