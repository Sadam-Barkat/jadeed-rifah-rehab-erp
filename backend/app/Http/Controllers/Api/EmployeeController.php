<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class EmployeeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = Employee::query()->latest();

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($department = $request->get('department')) {
            $query->where('department', $department);
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('employee_code', 'like', "%{$search}%")
                    ->orWhere('full_name', 'like', "%{$search}%")
                    ->orWhere('cnic', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('designation', 'like', "%{$search}%");
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (Employee $e) => $this->payload($e)),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'full_name' => ['required', 'string', 'max:150'],
            'father_name' => ['nullable', 'string', 'max:150'],
            'cnic' => ['nullable', 'string', 'max:20'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:150'],
            'department' => ['nullable', 'string', 'max:100'],
            'designation' => ['nullable', 'string', 'max:100'],
            'join_date' => ['nullable', 'date'],
            'employment_type' => ['nullable', Rule::in(['full_time', 'part_time', 'contract'])],
            'basic_salary' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', Rule::in(['active', 'resigned', 'terminated'])],
            'address' => ['nullable', 'string', 'max:255'],
            'emergency_contact' => ['nullable', 'string', 'max:150'],
            'notes' => ['nullable', 'string'],
        ]);

        $employee = Employee::query()->create([
            'employee_code' => $this->nextCode(),
            'full_name' => $data['full_name'],
            'father_name' => $data['father_name'] ?? null,
            'cnic' => $data['cnic'] ?? null,
            'phone' => $data['phone'] ?? null,
            'email' => $data['email'] ?? null,
            'department' => $data['department'] ?? null,
            'designation' => $data['designation'] ?? null,
            'join_date' => $data['join_date'] ?? now()->toDateString(),
            'employment_type' => $data['employment_type'] ?? 'full_time',
            'basic_salary' => $data['basic_salary'] ?? 0,
            'status' => $data['status'] ?? 'active',
            'address' => $data['address'] ?? null,
            'emergency_contact' => $data['emergency_contact'] ?? null,
            'notes' => $data['notes'] ?? null,
            'created_by' => $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Employee created',
            'data' => $this->payload($employee),
        ], 201);
    }

    public function update(Request $request, Employee $employee): JsonResponse
    {
        $data = $request->validate([
            'full_name' => ['sometimes', 'required', 'string', 'max:150'],
            'father_name' => ['nullable', 'string', 'max:150'],
            'cnic' => ['nullable', 'string', 'max:20'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:150'],
            'department' => ['nullable', 'string', 'max:100'],
            'designation' => ['nullable', 'string', 'max:100'],
            'join_date' => ['nullable', 'date'],
            'employment_type' => ['nullable', Rule::in(['full_time', 'part_time', 'contract'])],
            'basic_salary' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', Rule::in(['active', 'resigned', 'terminated'])],
            'address' => ['nullable', 'string', 'max:255'],
            'emergency_contact' => ['nullable', 'string', 'max:150'],
            'notes' => ['nullable', 'string'],
        ]);

        $employee->update($data);

        return response()->json([
            'message' => 'Employee updated',
            'data' => $this->payload($employee->fresh()),
        ]);
    }

    public function show(Employee $employee): JsonResponse
    {
        return response()->json(['data' => $this->payload($employee)]);
    }

    private function payload(Employee $employee): array
    {
        return [
            'id' => $employee->id,
            'employee_code' => $employee->employee_code,
            'full_name' => $employee->full_name,
            'father_name' => $employee->father_name,
            'cnic' => $employee->cnic,
            'phone' => $employee->phone,
            'email' => $employee->email,
            'department' => $employee->department,
            'designation' => $employee->designation,
            'join_date' => $employee->join_date?->format('Y-m-d'),
            'employment_type' => $employee->employment_type,
            'basic_salary' => $employee->basic_salary,
            'status' => $employee->status,
            'address' => $employee->address,
            'emergency_contact' => $employee->emergency_contact,
            'notes' => $employee->notes,
        ];
    }

    private function nextCode(): string
    {
        $prefix = 'EMP-';
        $latest = Employee::query()
            ->where('employee_code', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('employee_code');

        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
