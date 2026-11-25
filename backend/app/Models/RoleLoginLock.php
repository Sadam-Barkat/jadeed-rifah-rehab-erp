<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RoleLoginLock extends Model
{
    protected $primaryKey = 'role_slug';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'role_slug',
        'user_id',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
