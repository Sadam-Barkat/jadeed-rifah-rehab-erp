<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SecurityCamera;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SecurityCameraController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = SecurityCamera::query()->latest('id');

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('camera_code', 'like', "%{$search}%")
                    ->orWhere('location', 'like', "%{$search}%")
                    ->orWhere('zone', 'like', "%{$search}%");
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (SecurityCamera $c) => $this->payload($c)),
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
            'location' => ['required', 'string', 'max:150'],
            'zone' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(['online', 'offline', 'maintenance'])],
            'notes' => ['nullable', 'string'],
        ]);

        $camera = SecurityCamera::query()->create([
            'camera_code' => $this->nextCode(),
            'location' => $data['location'],
            'zone' => $data['zone'] ?? null,
            'status' => $data['status'] ?? 'online',
            'notes' => $data['notes'] ?? null,
            'created_by' => $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Camera registered',
            'data' => $this->payload($camera),
        ], 201);
    }

    public function update(Request $request, SecurityCamera $securityCamera): JsonResponse
    {
        $data = $request->validate([
            'location' => ['sometimes', 'required', 'string', 'max:150'],
            'zone' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(['online', 'offline', 'maintenance'])],
            'notes' => ['nullable', 'string'],
        ]);

        $securityCamera->update($data);

        return response()->json([
            'message' => 'Camera updated',
            'data' => $this->payload($securityCamera),
        ]);
    }

    private function payload(SecurityCamera $camera): array
    {
        return [
            'id' => $camera->id,
            'camera_code' => $camera->camera_code,
            'location' => $camera->location,
            'zone' => $camera->zone,
            'status' => $camera->status,
            'notes' => $camera->notes,
        ];
    }

    private function nextCode(): string
    {
        $n = SecurityCamera::query()->count() + 1;

        return 'CAM-'.str_pad((string) $n, 3, '0', STR_PAD_LEFT);
    }
}
