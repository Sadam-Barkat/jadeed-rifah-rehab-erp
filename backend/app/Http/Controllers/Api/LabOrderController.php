<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Admission;
use App\Models\LabOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LabOrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = LabOrder::query()
            ->with(['patient', 'admission'])
            ->latest('ordered_at');

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('order_code', 'like', "%{$search}%")
                    ->orWhere('test_name', 'like', "%{$search}%")
                    ->orWhereHas('patient', function ($pq) use ($search) {
                        $pq->where('patient_code', 'like', "%{$search}%")
                            ->orWhere('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%");
                    });
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (LabOrder $o) => $this->payload($o)),
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
            'admission_id' => ['required', 'exists:admissions,id'],
            'test_name' => ['required', 'string', 'max:255'],
            'ordered_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        $admission = Admission::query()->findOrFail($data['admission_id']);
        if ($admission->status !== 'active') {
            return response()->json(['message' => 'Lab order requires an active admission.'], 422);
        }

        $order = LabOrder::query()->create([
            'order_code' => $this->nextCode(),
            'admission_id' => $admission->id,
            'patient_id' => $admission->patient_id,
            'test_name' => $data['test_name'],
            'ordered_at' => $data['ordered_at'] ?? now(),
            'status' => 'pending',
            'notes' => $data['notes'] ?? null,
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ])->load(['patient', 'admission']);

        return response()->json([
            'message' => 'Lab order created',
            'data' => $this->payload($order),
        ], 201);
    }

    public function update(Request $request, LabOrder $labOrder): JsonResponse
    {
        $data = $request->validate([
            'status' => ['nullable', Rule::in(['pending', 'sample_collected', 'completed', 'cancelled'])],
            'result_summary' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'result_at' => ['nullable', 'date'],
        ]);

        $status = $data['status'] ?? $labOrder->status;
        $resultAt = $data['result_at'] ?? $labOrder->result_at;

        if ($status === 'completed' && ! $resultAt) {
            $resultAt = now();
        }

        $labOrder->update([
            'status' => $status,
            'result_summary' => array_key_exists('result_summary', $data)
                ? $data['result_summary']
                : $labOrder->result_summary,
            'notes' => array_key_exists('notes', $data) ? $data['notes'] : $labOrder->notes,
            'result_at' => $resultAt,
            'updated_by' => $request->user()->id,
        ]);

        $labOrder->load(['patient', 'admission']);

        return response()->json([
            'message' => 'Lab order updated',
            'data' => $this->payload($labOrder),
        ]);
    }

    public function show(LabOrder $labOrder): JsonResponse
    {
        $labOrder->load(['patient', 'admission']);

        return response()->json(['data' => $this->payload($labOrder)]);
    }

    private function payload(LabOrder $order): array
    {
        return [
            'id' => $order->id,
            'order_code' => $order->order_code,
            'test_name' => $order->test_name,
            'status' => $order->status,
            'ordered_at' => $order->ordered_at?->toDateTimeString(),
            'result_at' => $order->result_at?->toDateTimeString(),
            'result_summary' => $order->result_summary,
            'notes' => $order->notes,
            'patient' => [
                'id' => $order->patient?->id,
                'patient_code' => $order->patient?->patient_code,
                'full_name' => $order->patient?->full_name,
            ],
            'admission' => [
                'id' => $order->admission?->id,
                'admission_code' => $order->admission?->admission_code,
                'status' => $order->admission?->status,
            ],
        ];
    }

    private function nextCode(): string
    {
        $year = now()->format('Y');
        $prefix = "LAB-{$year}-";
        $latest = LabOrder::query()
            ->where('order_code', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('order_code');

        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
