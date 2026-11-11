<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Complaint;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ComplaintController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = Complaint::query()
            ->with(['patient', 'creator'])
            ->latest('reported_at');

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($type = $request->get('type')) {
            $query->where('type', $type);
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('complaint_code', 'like', "%{$search}%")
                    ->orWhere('title', 'like', "%{$search}%")
                    ->orWhere('reported_by_name', 'like', "%{$search}%");
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (Complaint $c) => $this->payload($c)),
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
            'type' => ['nullable', Rule::in(['complaint', 'incident'])],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'reported_by_name' => ['nullable', 'string', 'max:150'],
            'reporter_phone' => ['nullable', 'string', 'max:30'],
            'patient_id' => ['nullable', 'exists:patients,id'],
            'severity' => ['nullable', Rule::in(['low', 'medium', 'high', 'critical'])],
            'reported_at' => ['nullable', 'date'],
        ]);

        $complaint = Complaint::query()->create([
            'complaint_code' => $this->nextCode(),
            'type' => $data['type'] ?? 'complaint',
            'title' => $data['title'],
            'description' => $data['description'],
            'reported_by_name' => $data['reported_by_name'] ?? null,
            'reporter_phone' => $data['reporter_phone'] ?? null,
            'patient_id' => $data['patient_id'] ?? null,
            'severity' => $data['severity'] ?? 'medium',
            'status' => 'open',
            'reported_at' => $data['reported_at'] ?? now(),
            'created_by' => $request->user()->id,
        ])->load(['patient', 'creator']);

        return response()->json([
            'message' => 'Complaint recorded',
            'data' => $this->payload($complaint),
        ], 201);
    }

    public function update(Request $request, Complaint $complaint): JsonResponse
    {
        $data = $request->validate([
            'status' => ['nullable', Rule::in(['open', 'in_progress', 'resolved', 'closed'])],
            'action_taken' => ['nullable', 'string'],
            'severity' => ['nullable', Rule::in(['low', 'medium', 'high', 'critical'])],
        ]);

        $status = $data['status'] ?? $complaint->status;
        $resolvedAt = $complaint->resolved_at;

        if (in_array($status, ['resolved', 'closed'], true) && ! $resolvedAt) {
            $resolvedAt = now();
        }

        $complaint->update([
            'status' => $status,
            'action_taken' => array_key_exists('action_taken', $data)
                ? $data['action_taken']
                : $complaint->action_taken,
            'severity' => $data['severity'] ?? $complaint->severity,
            'resolved_at' => $resolvedAt,
        ]);

        $complaint->load(['patient', 'creator']);

        return response()->json([
            'message' => 'Complaint updated',
            'data' => $this->payload($complaint),
        ]);
    }

    private function payload(Complaint $complaint): array
    {
        return [
            'id' => $complaint->id,
            'complaint_code' => $complaint->complaint_code,
            'type' => $complaint->type,
            'title' => $complaint->title,
            'description' => $complaint->description,
            'reported_by_name' => $complaint->reported_by_name,
            'reporter_phone' => $complaint->reporter_phone,
            'severity' => $complaint->severity,
            'status' => $complaint->status,
            'action_taken' => $complaint->action_taken,
            'reported_at' => $complaint->reported_at?->toDateTimeString(),
            'resolved_at' => $complaint->resolved_at?->toDateTimeString(),
            'created_by_name' => $complaint->creator?->name,
            'patient' => $complaint->patient ? [
                'id' => $complaint->patient->id,
                'patient_code' => $complaint->patient->patient_code,
                'full_name' => $complaint->patient->full_name,
            ] : null,
        ];
    }

    private function nextCode(): string
    {
        $year = now()->format('Y');
        $prefix = "CMP-{$year}-";
        $latest = Complaint::query()
            ->where('complaint_code', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('complaint_code');

        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
