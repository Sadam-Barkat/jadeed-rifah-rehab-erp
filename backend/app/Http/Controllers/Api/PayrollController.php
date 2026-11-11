<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Employee;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PayrollController extends Controller
{
    public function indexRuns(Request $request): JsonResponse
    {
        $runs = PayrollRun::query()
            ->withCount('items')
            ->latest('year')
            ->latest('month')
            ->limit(24)
            ->get();

        return response()->json([
            'data' => $runs->map(fn (PayrollRun $r) => $this->runPayload($r)),
        ]);
    }

    public function indexItems(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = PayrollItem::query()
            ->with(['employee', 'payrollRun'])
            ->latest('id');

        if ($runId = $request->integer('payroll_run_id')) {
            $query->where('payroll_run_id', $runId);
        }

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('slip_code', 'like', "%{$search}%")
                    ->orWhereHas('employee', function ($eq) use ($search) {
                        $eq->where('employee_code', 'like', "%{$search}%")
                            ->orWhere('full_name', 'like', "%{$search}%");
                    });
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (PayrollItem $i) => $this->itemPayload($i)),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function generate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'year' => ['required', 'integer', 'min:2020', 'max:2100'],
            'month' => ['required', 'integer', 'min:1', 'max:12'],
            'notes' => ['nullable', 'string'],
            'allowances' => ['nullable', 'numeric', 'min:0'],
            'deductions' => ['nullable', 'numeric', 'min:0'],
        ]);

        $year = (int) $data['year'];
        $month = (int) $data['month'];

        if (PayrollRun::query()->where('year', $year)->where('month', $month)->exists()) {
            return response()->json(['message' => 'Payroll already exists for this month.'], 422);
        }

        $start = Carbon::create($year, $month, 1)->startOfDay();
        $end = (clone $start)->endOfMonth();
        $defaultAllowances = (float) ($data['allowances'] ?? 0);
        $defaultDeductions = (float) ($data['deductions'] ?? 0);

        $run = DB::transaction(function () use ($request, $year, $month, $start, $end, $data, $defaultAllowances, $defaultDeductions) {
            $run = PayrollRun::query()->create([
                'run_code' => $this->nextRunCode($year, $month),
                'year' => $year,
                'month' => $month,
                'status' => 'draft',
                'generated_at' => now(),
                'notes' => $data['notes'] ?? null,
                'created_by' => $request->user()->id,
            ]);

            $employees = Employee::query()->where('status', 'active')->orderBy('id')->get();
            $seq = 1;

            foreach ($employees as $employee) {
                $counts = $this->attendanceCounts($employee->id, $start, $end);
                $workingDays = 30;
                $marked = $counts['present'] + $counts['absent'] + $counts['leave'] + $counts['late'] + $counts['half_day'];
                // No attendance marked yet → pay full basic for the month
                $payableDays = $marked <= 0
                    ? $workingDays
                    : min($counts['present'] + $counts['late'] + $counts['leave'] + ($counts['half_day'] * 0.5), $workingDays);

                $basic = (float) $employee->basic_salary;
                $daily = $workingDays > 0 ? $basic / $workingDays : 0;
                $gross = round(($daily * $payableDays) + $defaultAllowances, 2);
                $net = round(max($gross - $defaultDeductions, 0), 2);

                PayrollItem::query()->create([
                    'slip_code' => sprintf('SLIP-%04d-%02d-%04d', $year, $month, $seq),
                    'payroll_run_id' => $run->id,
                    'employee_id' => $employee->id,
                    'basic_salary' => $basic,
                    'working_days' => $workingDays,
                    'days_present' => $counts['present'],
                    'days_absent' => $counts['absent'],
                    'days_leave' => $counts['leave'],
                    'days_late' => $counts['late'],
                    'days_half' => $counts['half_day'],
                    'payable_days' => $payableDays,
                    'allowances' => $defaultAllowances,
                    'deductions' => $defaultDeductions,
                    'gross_salary' => $gross,
                    'net_salary' => $net,
                    'status' => 'generated',
                ]);

                $seq++;
            }

            return $run->loadCount('items');
        });

        return response()->json([
            'message' => 'Payroll generated',
            'data' => $this->runPayload($run),
        ], 201);
    }

    public function finalize(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        if ($payrollRun->status === 'finalized') {
            return response()->json(['message' => 'Payroll is already finalized.'], 422);
        }

        $payrollRun->update([
            'status' => 'finalized',
            'finalized_at' => now(),
        ]);

        return response()->json([
            'message' => 'Payroll finalized',
            'data' => $this->runPayload($payrollRun->fresh()->loadCount('items')),
        ]);
    }

    public function markPaid(Request $request, PayrollItem $payrollItem): JsonResponse
    {
        $data = $request->validate([
            'payment_method' => ['nullable', Rule::in(['cash', 'bank', 'jazzcash', 'easypaisa', 'other'])],
            'paid_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        if ($payrollItem->status === 'paid') {
            return response()->json(['message' => 'Salary slip already marked paid.'], 422);
        }

        if ($payrollItem->status === 'void') {
            return response()->json(['message' => 'Cannot pay a void slip.'], 422);
        }

        $payrollItem->update([
            'status' => 'paid',
            'paid_at' => $data['paid_at'] ?? now(),
            'payment_method' => $data['payment_method'] ?? 'cash',
            'notes' => $data['notes'] ?? $payrollItem->notes,
        ]);

        $payrollItem->load(['employee', 'payrollRun']);

        return response()->json([
            'message' => 'Salary marked as paid',
            'data' => $this->itemPayload($payrollItem),
        ]);
    }

    private function attendanceCounts(int $employeeId, Carbon $start, Carbon $end): array
    {
        $rows = Attendance::query()
            ->where('employee_id', $employeeId)
            ->whereBetween('attendance_date', [$start->toDateString(), $end->toDateString()])
            ->get(['status']);

        $counts = [
            'present' => 0.0,
            'absent' => 0.0,
            'leave' => 0.0,
            'late' => 0.0,
            'half_day' => 0.0,
        ];

        foreach ($rows as $row) {
            if (isset($counts[$row->status])) {
                $counts[$row->status] += 1;
            }
        }

        return $counts;
    }

    private function runPayload(PayrollRun $run): array
    {
        return [
            'id' => $run->id,
            'run_code' => $run->run_code,
            'year' => $run->year,
            'month' => $run->month,
            'period' => sprintf('%04d-%02d', $run->year, $run->month),
            'status' => $run->status,
            'generated_at' => $run->generated_at?->toDateTimeString(),
            'finalized_at' => $run->finalized_at?->toDateTimeString(),
            'notes' => $run->notes,
            'items_count' => $run->items_count ?? $run->items()->count(),
        ];
    }

    private function itemPayload(PayrollItem $item): array
    {
        return [
            'id' => $item->id,
            'slip_code' => $item->slip_code,
            'basic_salary' => $item->basic_salary,
            'working_days' => $item->working_days,
            'days_present' => $item->days_present,
            'days_absent' => $item->days_absent,
            'days_leave' => $item->days_leave,
            'days_late' => $item->days_late,
            'days_half' => $item->days_half,
            'payable_days' => $item->payable_days,
            'allowances' => $item->allowances,
            'deductions' => $item->deductions,
            'gross_salary' => $item->gross_salary,
            'net_salary' => $item->net_salary,
            'status' => $item->status,
            'paid_at' => $item->paid_at?->toDateTimeString(),
            'payment_method' => $item->payment_method,
            'notes' => $item->notes,
            'employee' => [
                'id' => $item->employee?->id,
                'employee_code' => $item->employee?->employee_code,
                'full_name' => $item->employee?->full_name,
                'department' => $item->employee?->department,
                'designation' => $item->employee?->designation,
            ],
            'payroll_run' => [
                'id' => $item->payrollRun?->id,
                'run_code' => $item->payrollRun?->run_code,
                'period' => $item->payrollRun
                    ? sprintf('%04d-%02d', $item->payrollRun->year, $item->payrollRun->month)
                    : null,
                'status' => $item->payrollRun?->status,
            ],
        ];
    }

    private function nextRunCode(int $year, int $month): string
    {
        return sprintf('PR-%04d-%02d', $year, $month);
    }
}
