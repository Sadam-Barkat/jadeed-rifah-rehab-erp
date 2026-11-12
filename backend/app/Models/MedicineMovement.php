<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MedicineMovement extends Model
{
    protected $fillable = [
        'movement_code',
        'medicine_id',
        'type',
        'quantity',
        'batch_no',
        'expiry_date',
        'supplier',
        'unit_cost',
        'reference',
        'notes',
        'moved_at',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'unit_cost' => 'float',
            'expiry_date' => 'date',
            'moved_at' => 'datetime',
        ];
    }

    public function medicine(): BelongsTo
    {
        return $this->belongsTo(Medicine::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
