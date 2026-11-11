<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CanteenSaleItem extends Model
{
    protected $fillable = [
        'canteen_sale_id',
        'canteen_product_id',
        'quantity',
        'unit_price',
        'line_total',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'unit_price' => 'float',
            'line_total' => 'float',
        ];
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(CanteenSale::class, 'canteen_sale_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(CanteenProduct::class, 'canteen_product_id');
    }
}
