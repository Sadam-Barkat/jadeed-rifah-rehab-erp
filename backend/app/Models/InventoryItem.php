<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventoryItem extends Model
{
    public const CATEGORIES = [
        'kitchen',
        'beds',
        'security',
        'furniture',
        'equipment',
        'electronics',
        'cleaning',
        'linen',
        'maintenance',
        'medical_supply',
        'general',
        'other',
    ];

    public const CATEGORY_LABELS = [
        'kitchen' => 'Kitchen',
        'beds' => 'Beds',
        'security' => 'Security / cameras',
        'furniture' => 'Furniture',
        'equipment' => 'Equipment',
        'electronics' => 'Electronics',
        'cleaning' => 'Cleaning',
        'linen' => 'Linen',
        'maintenance' => 'Maintenance',
        'medical_supply' => 'Medical supply (non-medicine)',
        'general' => 'General',
        'other' => 'Other',
    ];

    /** Only these get Low / Critical alerts (consumables). Assets still move in stock in/out. */
    public const REORDER_ALERT_CATEGORIES = [
        'kitchen',
        'cleaning',
        'linen',
        'medical_supply',
    ];

    protected $fillable = [
        'item_code',
        'name',
        'category',
        'unit',
        'stock_qty',
        'reorder_level',
        'unit_cost',
        'bill_image_path',
        'supplier',
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

    public static function tracksReorderAlert(?string $category): bool
    {
        return in_array((string) $category, self::REORDER_ALERT_CATEGORIES, true);
    }

    public function scopeTracksReorder($query)
    {
        return $query->whereIn('category', self::REORDER_ALERT_CATEGORIES);
    }

    public function stockStatusLabel(): string
    {
        if (! self::tracksReorderAlert($this->category)) {
            return '—';
        }
        if ((float) $this->stock_qty <= 0) {
            return 'Critical';
        }
        if ((float) $this->stock_qty <= (float) $this->reorder_level) {
            return 'Low';
        }

        return 'Good';
    }

    public function isLowStock(): bool
    {
        return self::tracksReorderAlert($this->category)
            && (float) $this->stock_qty <= (float) $this->reorder_level;
    }

    protected function casts(): array
    {
        return [
            'stock_qty' => 'float',
            'reorder_level' => 'float',
            'unit_cost' => 'float',
        ];
    }

    public function movements(): HasMany
    {
        return $this->hasMany(InventoryMovement::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
