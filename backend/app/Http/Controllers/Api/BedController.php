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
        $activeBeds = fn ($q) => $q->where('status', '!=', 'discarded')->orderBy('bed_code');

        $rooms = Room::query()
            ->with(['beds' => $activeBeds])
            ->orderBy('code')
            ->get();

        $live = Bed::query()->where('status', '!=', 'discarded');

        $summary = [
            'total_beds' => (clone $live)->count(),
            'available' => (clone $live)->where('status', 'available')->count(),
            'occupied' => (clone $live)->where('status', 'occupied')->count(),
            'cleaning' => (clone $live)->where('status', 'cleaning')->count(),
            'maintenance' => (clone $live)->where('status', 'maintenance')->count(),
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

    /** Beds selectable for Inventory maintenance / discard. */
    public function forInventory(): JsonResponse
    {
        $beds = Bed::query()
            ->with('room:id,name,code,floor')
            ->withExists(['admissions as has_active_admission' => fn ($q) => $q->where('status', 'active')])
            ->where('status', '!=', 'discarded')
            ->orderBy('bed_code')
            ->get();

        return response()->json([
            'data' => $beds->map(function (Bed $bed) {
                $inUse = $bed->status === 'occupied' || (bool) $bed->has_active_admission;

                return [
                    'id' => $bed->id,
                    'bed_code' => $bed->bed_code,
                    'status' => $bed->status,
                    'in_use' => $inUse,
                    'room_name' => $bed->room?->name,
                    'room_code' => $bed->room?->code,
                    'floor' => $bed->room?->floor,
                    'label' => trim(
                        $bed->bed_code
                        .' · '.($bed->room?->name ?: 'Room')
                        .' · '.$bed->status
                        .($inUse ? ' (in use)' : '')
                    ),
                ];
            }),
        ]);
    }

    public function updateStatus(Request $request, Bed $bed): JsonResponse
    {
        if ($bed->status === 'discarded') {
            return response()->json(['message' => 'Discarded beds cannot be updated.'], 422);
        }

        $data = $request->validate([
            'status' => ['required', Rule::in(['available', 'occupied', 'cleaning', 'maintenance'])],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $active = $bed->admissions()->where('status', 'active')->exists();
        if ($active && in_array($data['status'], ['available', 'cleaning', 'maintenance'], true)) {
            return response()->json([
                'message' => 'Bed has an active admission. Discharge first.',
            ], 422);
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
