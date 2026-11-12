<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventoryItem extends Model
{
    public const CATEGORIES = [
        'kitchen',
        'beds',
        'security',
        'furniture',
        'equipment',
        'electronics',
        'cleaning',
        'linen',
        'maintenance',
        'medical_supply',
        'general',
        'other',
    ];

    protected $fillable = [
        'item_code',
        'name',
        'category',
        'unit',
        'stock_qty',
        'reorder_level',
        'unit_cost',
        'bill_image_path',
        'supplier',
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
