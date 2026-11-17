<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PettyExpense extends Model
{
    protected $fillable = [
        'expense_code',
        'expense_date',
        'title',
        'amount',
        'spent_for',
        'reason',
        'payment_method',
        'notes',
        'status',
        'void_reason',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'expense_date' => 'date',
            'amount' => 'float',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
