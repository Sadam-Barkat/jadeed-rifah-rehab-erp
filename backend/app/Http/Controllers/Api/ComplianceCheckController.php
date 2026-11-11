<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ComplianceCheck;
use App\Models\ComplianceItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ComplianceCheckController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = ComplianceCheck::query()
            ->with(['item', 'checker'])
            ->latest('checked_on')
            ->latest('id');

        if ($result = $request->get('result')) {
            $query->where('result', $result);
        }

        if ($itemId = $request->integer('compliance_item_id')) {
            $query->where('compliance_item_id', $itemId);
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('check_code', 'like', "%{$search}%")
                    ->orWhere('evidence_note', 'like', "%{$search}%")
                    ->orWhereHas('item', function ($iq) use ($search) {
                        $iq->where('title', 'like', "%{$search}%")
                            ->orWhere('item_code', 'like', "%{$search}%");
                    });
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (ComplianceCheck $c) => $this->payload($c)),
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
            'compliance_item_id' => ['required', 'exists:compliance_items,id'],
            'checked_on' => ['nullable', 'date'],
            'result' => ['nullable', Rule::in(['pass', 'partial', 'fail', 'na'])],
            'evidence_note' => ['nullable', 'string', 'max:255'],
            'action_required' => ['nullable', 'string'],
            'next_due_on' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in(['open', 'closed'])],
        ]);

        $item = ComplianceItem::query()->findOrFail($data['compliance_item_id']);
        if ($item->status !== 'active') {
            return response()->json(['message' => 'Compliance item must be active.'], 422);
        }

        $result = $data['result'] ?? 'pass';
        $status = $data['status'] ?? (in_array($result, ['fail', 'partial'], true) ? 'open' : 'closed');

        $check = ComplianceCheck::query()->create([
            'check_code' => $this->nextCode(),
            'compliance_item_id' => $item->id,
            'checked_on' => $data['checked_on'] ?? now()->toDateString(),
            'result' => $result,
            'evidence_note' => $data['evidence_note'] ?? null,
            'action_required' => $data['action_required'] ?? null,
            'next_due_on' => $data['next_due_on'] ?? null,
            'status' => $status,
            'checked_by' => $request->user()->id,
        ])->load(['item', 'checker']);

        return response()->json([
            'message' => 'Compliance check recorded',
            'data' => $this->payload($check),
        ], 201);
    }

    public function update(Request $request, ComplianceCheck $complianceCheck): JsonResponse
    {
        $data = $request->validate([
            'result' => ['nullable', Rule::in(['pass', 'partial', 'fail', 'na'])],
            'evidence_note' => ['nullable', 'string', 'max:255'],
            'action_required' => ['nullable', 'string'],
            'next_due_on' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in(['open', 'closed'])],
        ]);

        $complianceCheck->update($data);
        $complianceCheck->load(['item', 'checker']);

        return response()->json([
            'message' => 'Compliance check updated',
            'data' => $this->payload($complianceCheck),
        ]);
    }

    private function payload(ComplianceCheck $check): array
    {
        return [
            'id' => $check->id,
            'check_code' => $check->check_code,
            'checked_on' => $check->checked_on?->format('Y-m-d'),
            'result' => $check->result,
            'evidence_note' => $check->evidence_note,
            'action_required' => $check->action_required,
            'next_due_on' => $check->next_due_on?->format('Y-m-d'),
            'status' => $check->status,
            'checked_by' => $check->checker?->name,
            'item' => $check->item ? [
                'id' => $check->item->id,
                'item_code' => $check->item->item_code,
                'framework' => $check->item->framework,
                'title' => $check->item->title,
                'category' => $check->item->category,
            ] : null,
        ];
    }

    private function nextCode(): string
    {
        $n = ComplianceCheck::query()->count() + 1;

        return 'CHK-'.str_pad((string) $n, 5, '0', STR_PAD_LEFT);
    }
}
