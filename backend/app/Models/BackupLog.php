<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BackupLog extends Model
{
    protected $fillable = [
        'backup_code',
        'backed_up_at',
        'method',
        'status',
        'storage_note',
        'notes',
        'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'backed_up_at' => 'datetime',
        ];
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
