<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SecurityIncident;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SecurityIncidentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = SecurityIncident::query()
            ->with(['reporter'])
            ->latest('occurred_at');

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($severity = $request->get('severity')) {
            $query->where('severity', $severity);
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('incident_code', 'like', "%{$search}%")
                    ->orWhere('title', 'like', "%{$search}%")
                    ->orWhere('location', 'like', "%{$search}%");
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (SecurityIncident $i) => $this->payload($i)),
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
            'occurred_at' => ['nullable', 'date'],
            'location' => ['nullable', 'string', 'max:150'],
            'severity' => ['nullable', Rule::in(['low', 'medium', 'high', 'critical'])],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'action_taken' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['open', 'investigating', 'resolved', 'closed'])],
        ]);

        $incident = SecurityIncident::query()->create([
            'incident_code' => $this->nextCode(),
            'occurred_at' => $data['occurred_at'] ?? now(),
            'location' => $data['location'] ?? null,
            'severity' => $data['severity'] ?? 'medium',
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'action_taken' => $data['action_taken'] ?? null,
            'status' => $data['status'] ?? 'open',
            'reported_by' => $request->user()->id,
        ])->load(['reporter']);

        return response()->json([
            'message' => 'Security incident recorded',
            'data' => $this->payload($incident),
        ], 201);
    }

    public function update(Request $request, SecurityIncident $securityIncident): JsonResponse
    {
        $data = $request->validate([
            'severity' => ['nullable', Rule::in(['low', 'medium', 'high', 'critical'])],
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'action_taken' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['open', 'investigating', 'resolved', 'closed'])],
            'location' => ['nullable', 'string', 'max:150'],
        ]);

        $securityIncident->update($data);
        $securityIncident->load(['reporter']);

        return response()->json([
            'message' => 'Security incident updated',
            'data' => $this->payload($securityIncident),
        ]);
    }

    private function payload(SecurityIncident $incident): array
    {
        return [
            'id' => $incident->id,
            'incident_code' => $incident->incident_code,
            'occurred_at' => $incident->occurred_at?->toDateTimeString(),
            'location' => $incident->location,
            'severity' => $incident->severity,
            'title' => $incident->title,
            'description' => $incident->description,
            'action_taken' => $incident->action_taken,
            'status' => $incident->status,
            'reported_by' => $incident->reporter?->name,
        ];
    }

    private function nextCode(): string
    {
        $n = SecurityIncident::query()->count() + 1;

        return 'SEC-'.str_pad((string) $n, 5, '0', STR_PAD_LEFT);
    }
}
