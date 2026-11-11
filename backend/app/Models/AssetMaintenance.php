<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetMaintenance extends Model
{
    protected $fillable = [
        'maintenance_code',
        'asset_id',
        'maintained_at',
        'issue',
        'work_done',
        'cost',
        'status',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'maintained_at' => 'datetime',
            'cost' => 'float',
        ];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
