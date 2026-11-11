<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CanteenSale extends Model
{
    protected $fillable = [
        'sale_code',
        'sold_at',
        'customer_name',
        'total_amount',
        'payment_method',
        'status',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'sold_at' => 'datetime',
            'total_amount' => 'float',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(CanteenSaleItem::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
