<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FeePlan extends Model
{
    protected $fillable = [
        'plan_code',
        'admission_id',
        'patient_id',
        'fee_package_id',
        'package_name',
        'program_days',
        'amount',
        'discount',
        'total_amount',
        'installment_count',
        'installment_amounts',
        'status',
        'notes',
        'rejection_reason',
        'requested_by',
        'reviewed_by',
        'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'program_days' => 'integer',
            'amount' => 'float',
            'discount' => 'float',
            'total_amount' => 'float',
            'installment_count' => 'integer',
            'installment_amounts' => 'array',
            'reviewed_at' => 'datetime',
        ];
    }

    public static function maxInstallments(int $programDays): int
    {
        if ($programDays >= 90) {
            return 3;
        }
        if ($programDays >= 60) {
            return 2;
        }

        return 1;
    }

    /** Even split; last row absorbs rounding remainder. */
    public static function splitAmounts(float $total, int $count): array
    {
        $count = max(1, $count);
        $total = round($total, 2);
        $base = round($total / $count, 2);
        $amounts = array_fill(0, $count, $base);
        $sum = round(array_sum($amounts), 2);
        $diff = round($total - $sum, 2);
        $amounts[$count - 1] = round($amounts[$count - 1] + $diff, 2);

        return $amounts;
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

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
