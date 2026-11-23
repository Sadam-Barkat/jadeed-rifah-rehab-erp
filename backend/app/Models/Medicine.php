<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Medicine extends Model
{
    /** Default + common rehab/pharmacy categories (slug keys). */
    public const CATEGORIES = [
        'analgesics',
        'antibiotics',
        'antidepressants',
        'anxiolytics',
        'antipsychotics',
        'vitamins',
        'detox_support',
        'gastrointestinal',
        'cardiovascular',
        'respiratory',
        'antihistamines',
        'topical',
        'iv_fluids',
        'other',
    ];

    public const CATEGORY_LABELS = [
        'analgesics' => 'Analgesics',
        'antibiotics' => 'Antibiotics',
        'antidepressants' => 'Antidepressants',
        'anxiolytics' => 'Anxiolytics / sedatives',
        'antipsychotics' => 'Antipsychotics',
        'vitamins' => 'Vitamins & supplements',
        'detox_support' => 'Detox / withdrawal support',
        'gastrointestinal' => 'Gastrointestinal',
        'cardiovascular' => 'Cardiovascular',
        'respiratory' => 'Respiratory',
        'antihistamines' => 'Antihistamines',
        'topical' => 'Topical',
        'iv_fluids' => 'IV / fluids',
        'other' => 'Other',
    ];

    protected $fillable = [
        'medicine_code',
        'name',
        'generic_name',
        'category',
        'form',
        'strength',
        'unit',
        'manufacturer',
        'stock_qty',
        'reorder_level',
        'unit_price',
        'status',
        'created_by',
    ];

    public static function categoryLabel(?string $key): string
    {
        $key = $key ?: 'other';
        if (isset(self::CATEGORY_LABELS[$key])) {
            return self::CATEGORY_LABELS[$key];
        }

        return ucwords(str_replace('_', ' ', $key));
    }

    public static function normalizeCategory(?string $raw): string
    {
        $s = strtolower(trim((string) $raw));
        $s = preg_replace('/[^a-z0-9]+/', '_', $s) ?? '';
        $s = trim($s, '_');

        return $s !== '' ? $s : 'other';
    }

    protected function casts(): array
    {
        return [
            'stock_qty' => 'integer',
            'reorder_level' => 'integer',
            'unit_price' => 'float',
        ];
    }

    public function dispenses(): HasMany
    {
        return $this->hasMany(MedicineDispense::class);
    }

    public function movements(): HasMany
    {
        return $this->hasMany(MedicineMovement::class);
    }

    /** Earliest IN-batch expiry (any dated batch). */
    public function scopeWithNearestExpiry($query)
    {
        return $query->withMin([
            'movements as nearest_expiry_date' => function ($q) {
                $q->where('type', 'in')->whereNotNull('expiry_date');
            },
        ], 'expiry_date');
    }

    /** Earliest still-valid IN-batch expiry (today or later). */
    public function scopeWithUsableExpiry($query)
    {
        $today = now()->toDateString();

        return $query->withMin([
            'movements as usable_expiry_date' => function ($q) use ($today) {
                $q->where('type', 'in')
                    ->whereNotNull('expiry_date')
                    ->whereDate('expiry_date', '>=', $today);
            },
        ], 'expiry_date');
    }

    /** Hide medicines whose dated stock is only expired (new valid stock still shows). */
    public function scopeUsableForDispense($query)
    {
        $today = now()->toDateString();

        return $query->where(function ($q) use ($today) {
            $q->whereDoesntHave('movements', function ($m) {
                $m->where('type', 'in')->whereNotNull('expiry_date');
            })->orWhereHas('movements', function ($m) use ($today) {
                $m->where('type', 'in')
                    ->where(function ($inner) use ($today) {
                        $inner->whereNull('expiry_date')
                            ->orWhereDate('expiry_date', '>=', $today);
                    });
            });
        });
    }

    public function scopeWithExpiryFlags($query)
    {
        $today = now()->toDateString();

        return $query
            ->withExists([
                'movements as has_expired_batch' => function ($q) use ($today) {
                    $q->where('type', 'in')
                        ->whereNotNull('expiry_date')
                        ->whereDate('expiry_date', '<', $today);
                },
            ])
            ->withExists([
                'movements as has_usable_batch' => function ($q) use ($today) {
                    $q->where('type', 'in')
                        ->where(function ($inner) use ($today) {
                            $inner->whereNull('expiry_date')
                                ->orWhereDate('expiry_date', '>=', $today);
                        });
                },
            ]);
    }

    public function nearestExpiryDate(): ?string
    {
        $raw = $this->usable_expiry_date ?? $this->nearest_expiry_date ?? null;
        if (! $raw) {
            return null;
        }

        return \Illuminate\Support\Carbon::parse($raw)->toDateString();
    }

    public function isFullyExpired(): bool
    {
        if (array_key_exists('has_expired_batch', $this->getAttributes())
            || array_key_exists('has_usable_batch', $this->getAttributes())) {
            return (bool) $this->has_expired_batch && ! (bool) $this->has_usable_batch;
        }

        $today = now()->toDateString();
        $hasExpired = $this->movements()
            ->where('type', 'in')
            ->whereNotNull('expiry_date')
            ->whereDate('expiry_date', '<', $today)
            ->exists();
        if (! $hasExpired) {
            return false;
        }

        return ! $this->movements()
            ->where('type', 'in')
            ->where(function ($q) use ($today) {
                $q->whereNull('expiry_date')
                    ->orWhereDate('expiry_date', '>=', $today);
            })
            ->exists();
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
