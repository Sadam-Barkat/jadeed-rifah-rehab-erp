<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventoryItem extends Model
{
    public const DEFAULT_REORDER_LEVEL = 10;

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

    protected $fillable = [
        'item_code',
        'name',
        'category',
        'unit',
        'stock_qty',
        'reorder_level',
        'track_reorder',
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

    public static function isCountUnit(?string $unit): bool
    {
        return in_array(strtolower(trim((string) $unit)), [
            'pc', 'pcs', 'piece', 'pieces', 'unit', 'units', 'count',
        ], true);
    }

    public function scopeTracksReorder($query)
    {
        return $query->where('track_reorder', true);
    }

    public function stockStatusLabel(): string
    {
        if ((float) $this->stock_qty <= 0) {
            return 'Out of stock';
        }
        if ((float) $this->stock_qty <= (float) $this->reorder_level) {
            return 'Low stock';
        }

        return 'In stock';
    }

    public function isLowStock(): bool
    {
        return (float) $this->stock_qty <= (float) $this->reorder_level;
    }

    protected static function booted(): void
    {
        static::creating(function (InventoryItem $item) {
            $item->track_reorder = true;
            if ($item->reorder_level === null || (float) $item->reorder_level <= 0) {
                $item->reorder_level = self::DEFAULT_REORDER_LEVEL;
            }
        });
    }

    protected function casts(): array
    {
        return [
            'stock_qty' => 'float',
            'reorder_level' => 'float',
            'track_reorder' => 'boolean',
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
