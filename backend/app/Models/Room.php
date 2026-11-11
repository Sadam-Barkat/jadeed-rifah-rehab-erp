<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Room extends Model
{
    protected $fillable = [
        'name',
        'code',
        'floor',
        'room_type',
        'status',
        'notes',
    ];

    public function beds(): HasMany
    {
        return $this->hasMany(Bed::class);
    }
}
