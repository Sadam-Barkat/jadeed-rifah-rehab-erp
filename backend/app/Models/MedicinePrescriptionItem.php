<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MedicinePrescriptionItem extends Model
{
    protected $fillable = [
        'medicine_prescription_id',
        'medicine_id',
        'medicine_name',
        'quantity',
        'dosage',
        'frequency',
        'instructions',
        'dispensed_qty',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'dispensed_qty' => 'integer',
        ];
    }

    public function prescription(): BelongsTo
    {
        return $this->belongsTo(MedicinePrescription::class, 'medicine_prescription_id');
    }

    public function medicine(): BelongsTo
    {
        return $this->belongsTo(Medicine::class);
    }
}
