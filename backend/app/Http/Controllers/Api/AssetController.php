<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AssetController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = Asset::query()->latest();

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($category = $request->get('category')) {
            $query->where('category', $category);
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('asset_code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%")
                    ->orWhere('location', 'like', "%{$search}%");
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (Asset $a) => $this->payload($a)),
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
            'name' => ['required', 'string', 'max:255'],
            'category' => ['nullable', Rule::in(['furniture', 'equipment', 'vehicle', 'electronics', 'other'])],
            'location' => ['nullable', 'string', 'max:150'],
            'purchase_date' => ['nullable', 'date'],
            'purchase_cost' => ['nullable', 'numeric', 'min:0'],
            'current_value' => ['nullable', 'numeric', 'min:0'],
            'condition' => ['nullable', Rule::in(['good', 'fair', 'poor'])],
            'status' => ['nullable', Rule::in(['active', 'under_maintenance', 'retired'])],
            'notes' => ['nullable', 'string'],
        ]);

        $asset = Asset::query()->create([
            'asset_code' => $this->nextCode(),
            'name' => $data['name'],
            'category' => $data['category'] ?? 'equipment',
            'location' => $data['location'] ?? null,
            'purchase_date' => $data['purchase_date'] ?? null,
            'purchase_cost' => $data['purchase_cost'] ?? 0,
            'current_value' => $data['current_value'] ?? ($data['purchase_cost'] ?? 0),
            'condition' => $data['condition'] ?? 'good',
            'status' => $data['status'] ?? 'active',
            'notes' => $data['notes'] ?? null,
            'created_by' => $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Asset registered',
            'data' => $this->payload($asset),
        ], 201);
    }

    public function update(Request $request, Asset $asset): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'category' => ['nullable', Rule::in(['furniture', 'equipment', 'vehicle', 'electronics', 'other'])],
            'location' => ['nullable', 'string', 'max:150'],
            'purchase_date' => ['nullable', 'date'],
            'purchase_cost' => ['nullable', 'numeric', 'min:0'],
            'current_value' => ['nullable', 'numeric', 'min:0'],
            'condition' => ['nullable', Rule::in(['good', 'fair', 'poor'])],
            'status' => ['nullable', Rule::in(['active', 'under_maintenance', 'retired'])],
            'notes' => ['nullable', 'string'],
        ]);

        $asset->update($data);

        return response()->json([
            'message' => 'Asset updated',
            'data' => $this->payload($asset->fresh()),
        ]);
    }

    private function payload(Asset $asset): array
    {
        return [
            'id' => $asset->id,
            'asset_code' => $asset->asset_code,
            'name' => $asset->name,
            'category' => $asset->category,
            'location' => $asset->location,
            'purchase_date' => $asset->purchase_date?->format('Y-m-d'),
            'purchase_cost' => $asset->purchase_cost,
            'current_value' => $asset->current_value,
            'condition' => $asset->condition,
            'status' => $asset->status,
            'notes' => $asset->notes,
        ];
    }

    private function nextCode(): string
    {
        $prefix = 'AST-';
        $latest = Asset::query()
            ->where('asset_code', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('asset_code');

        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
