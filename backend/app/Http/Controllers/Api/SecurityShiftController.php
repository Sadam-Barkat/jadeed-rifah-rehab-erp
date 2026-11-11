<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SecurityShift;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SecurityShiftController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = SecurityShift::query()->latest('shift_date')->latest('id');

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($shift = $request->get('shift')) {
            $query->where('shift', $shift);
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('shift_code', 'like', "%{$search}%")
                    ->orWhere('guard_name', 'like', "%{$search}%");
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (SecurityShift $s) => $this->payload($s)),
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
            'shift_date' => ['nullable', 'date'],
            'shift' => ['nullable', Rule::in(['morning', 'evening', 'night'])],
            'guard_name' => ['required', 'string', 'max:150'],
            'check_in_at' => ['nullable', 'date_format:H:i'],
            'check_out_at' => ['nullable', 'date_format:H:i'],
            'notes' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['on_duty', 'completed'])],
        ]);

        $shift = SecurityShift::query()->create([
            'shift_code' => $this->nextCode(),
            'shift_date' => $data['shift_date'] ?? now()->toDateString(),
            'shift' => $data['shift'] ?? 'morning',
            'guard_name' => $data['guard_name'],
            'check_in_at' => $data['check_in_at'] ?? null,
            'check_out_at' => $data['check_out_at'] ?? null,
            'notes' => $data['notes'] ?? null,
            'status' => $data['status'] ?? 'on_duty',
            'created_by' => $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Security shift logged',
            'data' => $this->payload($shift),
        ], 201);
    }

    public function update(Request $request, SecurityShift $securityShift): JsonResponse
    {
        $data = $request->validate([
            'check_out_at' => ['nullable', 'date_format:H:i'],
            'notes' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['on_duty', 'completed'])],
        ]);

        $securityShift->update($data);

        return response()->json([
            'message' => 'Security shift updated',
            'data' => $this->payload($securityShift),
        ]);
    }

    private function payload(SecurityShift $shift): array
    {
        return [
            'id' => $shift->id,
            'shift_code' => $shift->shift_code,
            'shift_date' => $shift->shift_date?->format('Y-m-d'),
            'shift' => $shift->shift,
            'guard_name' => $shift->guard_name,
            'check_in_at' => $shift->check_in_at ? substr((string) $shift->check_in_at, 0, 5) : null,
            'check_out_at' => $shift->check_out_at ? substr((string) $shift->check_out_at, 0, 5) : null,
            'notes' => $shift->notes,
            'status' => $shift->status,
        ];
    }

    private function nextCode(): string
    {
        $n = SecurityShift::query()->count() + 1;

        return 'SFT-'.str_pad((string) $n, 5, '0', STR_PAD_LEFT);
    }
}
