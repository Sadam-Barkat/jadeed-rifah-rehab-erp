<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class KitchenMenu extends Model
{
    protected $fillable = [
        'menu_code',
        'menu_date',
        'meal_type',
        'menu_items',
        'portions',
        'notes',
        'status',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'menu_date' => 'date',
            'portions' => 'integer',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
