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

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
