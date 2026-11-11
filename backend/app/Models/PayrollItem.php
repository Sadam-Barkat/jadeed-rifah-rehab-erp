<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PayrollItem extends Model
{
    protected $fillable = [
        'slip_code',
        'payroll_run_id',
        'employee_id',
        'basic_salary',
        'working_days',
        'days_present',
        'days_absent',
        'days_leave',
        'days_late',
        'days_half',
        'payable_days',
        'allowances',
        'deductions',
        'gross_salary',
        'net_salary',
        'status',
        'paid_at',
        'payment_method',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'basic_salary' => 'float',
            'working_days' => 'integer',
            'days_present' => 'float',
            'days_absent' => 'float',
            'days_leave' => 'float',
            'days_late' => 'float',
            'days_half' => 'float',
            'payable_days' => 'float',
            'allowances' => 'float',
            'deductions' => 'float',
            'gross_salary' => 'float',
            'net_salary' => 'float',
            'paid_at' => 'datetime',
        ];
    }

    public function payrollRun(): BelongsTo
    {
        return $this->belongsTo(PayrollRun::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }
}
