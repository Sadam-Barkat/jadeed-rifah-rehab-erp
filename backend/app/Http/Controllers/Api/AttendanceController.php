<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Employee;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AttendanceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);
        $date = $request->get('date') ?: now()->toDateString();

        $query = Attendance::query()
            ->with(['employee', 'marker'])
            ->whereDate('attendance_date', $date)
            ->latest('id');

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->whereHas('employee', function ($eq) use ($search) {
                $eq->where('employee_code', 'like', "%{$search}%")
                    ->orWhere('full_name', 'like', "%{$search}%");
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (Attendance $a) => $this->payload($a)),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'date' => $date,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'employee_id' => ['required', 'exists:employees,id'],
            'attendance_date' => ['nullable', 'date'],
            'status' => ['required', Rule::in(['present', 'absent', 'leave', 'late', 'half_day'])],
            'check_in' => ['nullable', 'date_format:H:i'],
            'check_out' => ['nullable', 'date_format:H:i'],
            'notes' => ['nullable', 'string'],
        ]);

        $employee = Employee::query()->findOrFail($data['employee_id']);
        if ($employee->status !== 'active') {
            return response()->json(['message' => 'Attendance can only be marked for active employees.'], 422);
        }

        $date = $data['attendance_date'] ?? now()->toDateString();

        $attendance = Attendance::query()->updateOrCreate(
            [
                'employee_id' => $employee->id,
                'attendance_date' => $date,
            ],
            [
                'status' => $data['status'],
                'check_in' => $data['check_in'] ?? null,
                'check_out' => $data['check_out'] ?? null,
                'notes' => $data['notes'] ?? null,
                'marked_by' => $request->user()->id,
            ]
        )->load(['employee', 'marker']);

        return response()->json([
            'message' => 'Attendance saved',
            'data' => $this->payload($attendance),
        ], 201);
    }

    private function payload(Attendance $attendance): array
    {
        return [
            'id' => $attendance->id,
            'attendance_date' => $attendance->attendance_date?->format('Y-m-d'),
            'status' => $attendance->status,
            'check_in' => $attendance->check_in ? substr((string) $attendance->check_in, 0, 5) : null,
            'check_out' => $attendance->check_out ? substr((string) $attendance->check_out, 0, 5) : null,
            'notes' => $attendance->notes,
            'marked_by_name' => $attendance->marker?->name,
            'employee' => [
                'id' => $attendance->employee?->id,
                'employee_code' => $attendance->employee?->employee_code,
                'full_name' => $attendance->employee?->full_name,
                'department' => $attendance->employee?->department,
                'designation' => $attendance->employee?->designation,
            ],
        ];
    }
}
