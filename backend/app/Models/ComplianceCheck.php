<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ComplianceCheck extends Model
{
    protected $fillable = [
        'check_code',
        'compliance_item_id',
        'checked_on',
        'result',
        'evidence_note',
        'action_required',
        'next_due_on',
        'status',
        'checked_by',
    ];

    protected function casts(): array
    {
        return [
            'checked_on' => 'date',
            'next_due_on' => 'date',
        ];
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(ComplianceItem::class, 'compliance_item_id');
    }

    public function checker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'checked_by');
    }
}
