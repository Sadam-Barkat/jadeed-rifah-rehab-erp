<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ComplianceItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ComplianceItemController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = ComplianceItem::query()->latest('id');

        if ($framework = $request->get('framework')) {
            $query->where('framework', $framework);
        }

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        } else {
            $query->where('status', 'active');
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('item_code', 'like', "%{$search}%")
                    ->orWhere('title', 'like', "%{$search}%")
                    ->orWhere('category', 'like', "%{$search}%");
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (ComplianceItem $i) => $this->payload($i)),
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
            'framework' => ['nullable', Rule::in(['phc', 'msds', 'internal'])],
            'category' => ['nullable', 'string', 'max:100'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'frequency' => ['nullable', Rule::in(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'as_needed'])],
            'status' => ['nullable', Rule::in(['active', 'archived'])],
        ]);

        $item = ComplianceItem::query()->create([
            'item_code' => $this->nextCode(),
            'framework' => $data['framework'] ?? 'phc',
            'category' => $data['category'] ?? null,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'frequency' => $data['frequency'] ?? 'monthly',
            'status' => $data['status'] ?? 'active',
            'created_by' => $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Compliance item created',
            'data' => $this->payload($item),
        ], 201);
    }

    public function update(Request $request, ComplianceItem $complianceItem): JsonResponse
    {
        $data = $request->validate([
            'framework' => ['nullable', Rule::in(['phc', 'msds', 'internal'])],
            'category' => ['nullable', 'string', 'max:100'],
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'frequency' => ['nullable', Rule::in(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'as_needed'])],
            'status' => ['nullable', Rule::in(['active', 'archived'])],
        ]);

        $complianceItem->update($data);

        return response()->json([
            'message' => 'Compliance item updated',
            'data' => $this->payload($complianceItem),
        ]);
    }

    private function payload(ComplianceItem $item): array
    {
        return [
            'id' => $item->id,
            'item_code' => $item->item_code,
            'framework' => $item->framework,
            'category' => $item->category,
            'title' => $item->title,
            'description' => $item->description,
            'frequency' => $item->frequency,
            'status' => $item->status,
        ];
    }

    private function nextCode(): string
    {
        $n = ComplianceItem::query()->count() + 1;

        return 'CMP-'.str_pad((string) $n, 4, '0', STR_PAD_LEFT);
    }
}
