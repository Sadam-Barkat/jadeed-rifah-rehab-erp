<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Invoice extends Model
{
    protected $fillable = [
        'invoice_code',
        'admission_id',
        'patient_id',
        'fee_package_id',
        'package_name',
        'program_days',
        'amount',
        'discount',
        'total_amount',
        'paid_amount',
        'balance',
        'status',
        'issued_at',
        'due_date',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'program_days' => 'integer',
            'amount' => 'float',
            'discount' => 'float',
            'total_amount' => 'float',
            'paid_amount' => 'float',
            'balance' => 'float',
            'issued_at' => 'datetime',
            'due_date' => 'date',
        ];
    }

    public function admission(): BelongsTo
    {
        return $this->belongsTo(Admission::class);
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function feePackage(): BelongsTo
    {
        return $this->belongsTo(FeePackage::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
