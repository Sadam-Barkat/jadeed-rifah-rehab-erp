<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryMovement extends Model
{
    public const PURPOSES = [
        'purchase',
        'kitchen_use',
        'cleaning',
        'patient_care',
        'maintenance',
        'return',
        'waste',
        'transfer',
        'adjustment',
        'other',
    ];

    public const DEPARTMENTS = [
        'kitchen',
        'nursing',
        'pharmacy',
        'admin',
        'cleaning',
        'maintenance',
        'gate',
        'other',
    ];

    protected $fillable = [
        'movement_code',
        'inventory_item_id',
        'type',
        'purpose',
        'department',
        'issued_to',
        'used_for',
        'quantity',
        'unit',
        'reference',
        'bill_image_path',
        'notes',
        'moved_at',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'float',
            'moved_at' => 'datetime',
        ];
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
