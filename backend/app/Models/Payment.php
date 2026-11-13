<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    protected $fillable = [
        'payment_code',
        'invoice_id',
        'patient_id',
        'amount',
        'installment_no',
        'method',
        'paid_at',
        'reference',
        'notes',
        'proof_image_path',
        'approval_status',
        'approved_by',
        'approved_at',
        'rejection_reason',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'float',
            'installment_no' => 'integer',
            'paid_at' => 'datetime',
            'approved_at' => 'datetime',
        ];
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
