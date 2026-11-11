<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use App\Models\StaffTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StaffTaskController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = StaffTask::query()
            ->with(['assignee', 'creator'])
            ->latest();

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($request->boolean('mine')) {
            $query->where('assigned_to', $request->user()->id);
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('task_code', 'like', "%{$search}%")
                    ->orWhere('title', 'like', "%{$search}%");
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (StaffTask $t) => $this->payload($t)),
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
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'assigned_to' => ['nullable', 'exists:users,id'],
            'priority' => ['nullable', Rule::in(['low', 'medium', 'high'])],
            'due_date' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in(['pending', 'in_progress', 'completed', 'cancelled'])],
        ]);

        $task = StaffTask::query()->create([
            'task_code' => $this->nextCode(),
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'assigned_to' => $data['assigned_to'] ?? null,
            'priority' => $data['priority'] ?? 'medium',
            'due_date' => $data['due_date'] ?? null,
            'status' => $data['status'] ?? 'pending',
            'created_by' => $request->user()->id,
        ])->load(['assignee', 'creator']);

        if ($task->assigned_to) {
            AppNotification::query()->create([
                'user_id' => $task->assigned_to,
                'title' => 'New task assigned',
                'message' => $task->title,
                'type' => 'info',
                'link' => '/app/tasks',
                'created_by' => $request->user()->id,
            ]);
        }

        return response()->json([
            'message' => 'Task created',
            'data' => $this->payload($task),
        ], 201);
    }

    public function update(Request $request, StaffTask $staffTask): JsonResponse
    {
        $data = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'assigned_to' => ['nullable', 'exists:users,id'],
            'priority' => ['nullable', Rule::in(['low', 'medium', 'high'])],
            'due_date' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in(['pending', 'in_progress', 'completed', 'cancelled'])],
        ]);

        $status = $data['status'] ?? $staffTask->status;
        $completedAt = $staffTask->completed_at;
        if ($status === 'completed' && ! $completedAt) {
            $completedAt = now();
        }
        if ($status !== 'completed') {
            $completedAt = null;
        }

        $staffTask->update([
            ...collect($data)->except('status')->all(),
            'status' => $status,
            'completed_at' => $completedAt,
        ]);

        $staffTask->load(['assignee', 'creator']);

        return response()->json([
            'message' => 'Task updated',
            'data' => $this->payload($staffTask),
        ]);
    }

    private function payload(StaffTask $task): array
    {
        return [
            'id' => $task->id,
            'task_code' => $task->task_code,
            'title' => $task->title,
            'description' => $task->description,
            'priority' => $task->priority,
            'status' => $task->status,
            'due_date' => $task->due_date?->format('Y-m-d'),
            'completed_at' => $task->completed_at?->toDateTimeString(),
            'assignee' => $task->assignee ? [
                'id' => $task->assignee->id,
                'name' => $task->assignee->name,
                'email' => $task->assignee->email,
            ] : null,
            'created_by_name' => $task->creator?->name,
        ];
    }

    private function nextCode(): string
    {
        $year = now()->format('Y');
        $prefix = "TSK-{$year}-";
        $latest = StaffTask::query()
            ->where('task_code', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('task_code');

        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
