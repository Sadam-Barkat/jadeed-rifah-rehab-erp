<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bed;
use App\Models\Room;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class BedController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $rooms = Room::query()
            ->with(['beds' => fn ($q) => $q->orderBy('bed_code')])
            ->orderBy('code')
            ->get();

        $summary = [
            'total_beds' => Bed::query()->count(),
            'available' => Bed::query()->where('status', 'available')->count(),
            'occupied' => Bed::query()->where('status', 'occupied')->count(),
            'cleaning' => Bed::query()->where('status', 'cleaning')->count(),
            'maintenance' => Bed::query()->where('status', 'maintenance')->count(),
        ];

        return response()->json([
            'summary' => $summary,
            'data' => $rooms->map(fn (Room $room) => [
                'id' => $room->id,
                'name' => $room->name,
                'code' => $room->code,
                'floor' => $room->floor,
                'room_type' => $room->room_type,
                'status' => $room->status,
                'beds' => $room->beds->map(fn (Bed $bed) => [
                    'id' => $bed->id,
                    'bed_code' => $bed->bed_code,
                    'status' => $bed->status,
                    'notes' => $bed->notes,
                ]),
            ]),
        ]);
    }

    public function available(): JsonResponse
    {
        $beds = Bed::query()
            ->with('room')
            ->where('status', 'available')
            ->whereHas('room', fn ($q) => $q->where('status', 'active'))
            ->orderBy('bed_code')
            ->get();

        return response()->json([
            'data' => $beds->map(fn (Bed $bed) => [
                'id' => $bed->id,
                'bed_code' => $bed->bed_code,
                'room_name' => $bed->room?->name,
                'room_code' => $bed->room?->code,
                'floor' => $bed->room?->floor,
            ]),
        ]);
    }

    public function updateStatus(Request $request, Bed $bed): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['available', 'occupied', 'cleaning', 'maintenance'])],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        if ($data['status'] === 'available' && $bed->status === 'occupied') {
            $active = $bed->admissions()->where('status', 'active')->exists();
            if ($active) {
                return response()->json([
                    'message' => 'Bed has an active admission. Discharge first.',
                ], 422);
            }
        }

        $bed->update([
            'status' => $data['status'],
            'notes' => $data['notes'] ?? $bed->notes,
        ]);

        return response()->json([
            'message' => 'Bed status updated',
            'data' => [
                'id' => $bed->id,
                'bed_code' => $bed->bed_code,
                'status' => $bed->status,
            ],
        ]);
    }
}
