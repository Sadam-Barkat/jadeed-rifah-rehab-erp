<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ComplianceItem extends Model
{
    protected $fillable = [
        'item_code',
        'framework',
        'category',
        'title',
        'description',
        'frequency',
        'status',
        'created_by',
    ];

    public function checks(): HasMany
    {
        return $this->hasMany(ComplianceCheck::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
