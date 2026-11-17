<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FacilityBill extends Model
{
    public const TYPES = [
        'electricity',
        'gas',
        'rent',
        'water',
        'internet',
        'other',
    ];

    public const TYPE_LABELS = [
        'electricity' => 'Electricity',
        'gas' => 'Gas',
        'rent' => 'Rent',
        'water' => 'Water',
        'internet' => 'Internet',
        'other' => 'Other',
    ];

    protected $fillable = [
        'bill_code',
        'bill_date',
        'bill_type',
        'amount',
        'payment_method',
        'reference',
        'notes',
        'status',
        'void_reason',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'bill_date' => 'date',
            'amount' => 'float',
        ];
    }

    public static function typeLabel(?string $type): string
    {
        $type = (string) $type;

        return self::TYPE_LABELS[$type] ?? ucwords(str_replace('_', ' ', $type));
    }

    public static function normalizeType(?string $raw): string
    {
        $s = strtolower(trim((string) $raw));
        $s = preg_replace('/[^a-z0-9]+/', '_', $s) ?? '';
        $s = trim($s, '_');

        return $s !== '' ? $s : 'other';
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
