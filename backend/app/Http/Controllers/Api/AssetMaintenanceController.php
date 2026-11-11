<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\AssetMaintenance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AssetMaintenanceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = AssetMaintenance::query()
            ->with('asset')
            ->latest('maintained_at');

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (AssetMaintenance $m) => $this->payload($m)),
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
            'asset_id' => ['required', 'exists:assets,id'],
            'issue' => ['required', 'string', 'max:255'],
            'work_done' => ['nullable', 'string'],
            'cost' => ['nullable', 'numeric', 'min:0'],
            'maintained_at' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in(['open', 'completed'])],
        ]);

        $maintenance = DB::transaction(function () use ($request, $data) {
            $asset = Asset::query()->lockForUpdate()->findOrFail($data['asset_id']);
            $status = $data['status'] ?? 'open';

            if ($status === 'open') {
                $asset->update(['status' => 'under_maintenance']);
            }

            return AssetMaintenance::query()->create([
                'maintenance_code' => $this->nextCode(),
                'asset_id' => $asset->id,
                'maintained_at' => $data['maintained_at'] ?? now(),
                'issue' => $data['issue'],
                'work_done' => $data['work_done'] ?? null,
                'cost' => $data['cost'] ?? 0,
                'status' => $status,
                'created_by' => $request->user()->id,
            ])->load('asset');
        });

        return response()->json([
            'message' => 'Maintenance logged',
            'data' => $this->payload($maintenance),
        ], 201);
    }

    public function complete(Request $request, AssetMaintenance $assetMaintenance): JsonResponse
    {
        if ($assetMaintenance->status === 'completed') {
            return response()->json(['message' => 'Maintenance already completed.'], 422);
        }

        $data = $request->validate([
            'work_done' => ['nullable', 'string'],
            'cost' => ['nullable', 'numeric', 'min:0'],
        ]);

        $maintenance = DB::transaction(function () use ($assetMaintenance, $data) {
            $assetMaintenance->update([
                'status' => 'completed',
                'work_done' => $data['work_done'] ?? $assetMaintenance->work_done,
                'cost' => array_key_exists('cost', $data) ? $data['cost'] : $assetMaintenance->cost,
                'maintained_at' => now(),
            ]);

            $asset = Asset::query()->lockForUpdate()->find($assetMaintenance->asset_id);
            if ($asset && $asset->status === 'under_maintenance') {
                $stillOpen = AssetMaintenance::query()
                    ->where('asset_id', $asset->id)
                    ->where('status', 'open')
                    ->exists();
                if (! $stillOpen) {
                    $asset->update(['status' => 'active']);
                }
            }

            return $assetMaintenance->fresh()->load('asset');
        });

        return response()->json([
            'message' => 'Maintenance completed',
            'data' => $this->payload($maintenance),
        ]);
    }

    private function payload(AssetMaintenance $m): array
    {
        return [
            'id' => $m->id,
            'maintenance_code' => $m->maintenance_code,
            'issue' => $m->issue,
            'work_done' => $m->work_done,
            'cost' => $m->cost,
            'status' => $m->status,
            'maintained_at' => $m->maintained_at?->toDateTimeString(),
            'asset' => [
                'id' => $m->asset?->id,
                'asset_code' => $m->asset?->asset_code,
                'name' => $m->asset?->name,
                'status' => $m->asset?->status,
            ],
        ];
    }

    private function nextCode(): string
    {
        $year = now()->format('Y');
        $prefix = "MNT-{$year}-";
        $latest = AssetMaintenance::query()
            ->where('maintenance_code', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('maintenance_code');

        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
