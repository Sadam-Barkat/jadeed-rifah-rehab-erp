<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CanteenProduct extends Model
{
    protected $fillable = [
        'product_code',
        'name',
        'unit_price',
        'stock_qty',
        'status',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'unit_price' => 'float',
            'stock_qty' => 'integer',
        ];
    }

    public function saleItems(): HasMany
    {
        return $this->hasMany(CanteenSaleItem::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
