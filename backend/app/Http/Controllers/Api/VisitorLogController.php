<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Admission;
use App\Models\VisitorLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class VisitorLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = VisitorLog::query()
            ->with(['patient', 'admission'])
            ->latest('check_in_at');

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('visit_code', 'like', "%{$search}%")
                    ->orWhere('visitor_name', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhereHas('patient', function ($pq) use ($search) {
                        $pq->where('patient_code', 'like', "%{$search}%")
                            ->orWhere('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%");
                    });
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (VisitorLog $v) => $this->payload($v)),
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
            'visitor_name' => ['required', 'string', 'max:150'],
            'relation' => ['nullable', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:30'],
            'cnic' => ['nullable', 'string', 'max:20'],
            'purpose' => ['nullable', 'string', 'max:255'],
            'check_in_at' => ['nullable', 'date'],
            'items_brought' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
        ]);

        $admission = Admission::query()->findOrFail($data['admission_id']);
        if ($admission->status !== 'active') {
            return response()->json(['message' => 'Visitor check-in requires an active admission.'], 422);
        }

        $visit = VisitorLog::query()->create([
            'visit_code' => $this->nextCode(),
            'admission_id' => $admission->id,
            'patient_id' => $admission->patient_id,
            'visitor_name' => $data['visitor_name'],
            'relation' => $data['relation'] ?? null,
            'phone' => $data['phone'] ?? null,
            'cnic' => $data['cnic'] ?? null,
            'purpose' => $data['purpose'] ?? null,
            'check_in_at' => $data['check_in_at'] ?? now(),
            'items_brought' => $data['items_brought'] ?? null,
            'notes' => $data['notes'] ?? null,
            'status' => 'checked_in',
            'created_by' => $request->user()->id,
        ])->load(['patient', 'admission']);

        return response()->json([
            'message' => 'Visitor checked in',
            'data' => $this->payload($visit),
        ], 201);
    }

    public function update(Request $request, VisitorLog $visitorLog): JsonResponse
    {
        $data = $request->validate([
            'status' => ['nullable', Rule::in(['checked_in', 'checked_out', 'cancelled'])],
            'check_out_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'items_brought' => ['nullable', 'string'],
        ]);

        $status = $data['status'] ?? $visitorLog->status;
        $checkOut = $data['check_out_at'] ?? $visitorLog->check_out_at;

        if ($status === 'checked_out' && ! $checkOut) {
            $checkOut = now();
        }

        $visitorLog->update([
            'status' => $status,
            'check_out_at' => $checkOut,
            'notes' => array_key_exists('notes', $data) ? $data['notes'] : $visitorLog->notes,
            'items_brought' => array_key_exists('items_brought', $data)
                ? $data['items_brought']
                : $visitorLog->items_brought,
        ]);

        $visitorLog->load(['patient', 'admission']);

        return response()->json([
            'message' => 'Visitor log updated',
            'data' => $this->payload($visitorLog),
        ]);
    }

    public function show(VisitorLog $visitorLog): JsonResponse
    {
        $visitorLog->load(['patient', 'admission']);

        return response()->json(['data' => $this->payload($visitorLog)]);
    }

    private function payload(VisitorLog $visit): array
    {
        return [
            'id' => $visit->id,
            'visit_code' => $visit->visit_code,
            'visitor_name' => $visit->visitor_name,
            'relation' => $visit->relation,
            'phone' => $visit->phone,
            'cnic' => $visit->cnic,
            'purpose' => $visit->purpose,
            'check_in_at' => $visit->check_in_at?->toDateTimeString(),
            'check_out_at' => $visit->check_out_at?->toDateTimeString(),
            'items_brought' => $visit->items_brought,
            'notes' => $visit->notes,
            'status' => $visit->status,
            'patient' => [
                'id' => $visit->patient?->id,
                'patient_code' => $visit->patient?->patient_code,
                'full_name' => $visit->patient?->full_name,
            ],
            'admission' => [
                'id' => $visit->admission?->id,
                'admission_code' => $visit->admission?->admission_code,
                'status' => $visit->admission?->status,
            ],
        ];
    }

    private function nextCode(): string
    {
        $year = now()->format('Y');
        $prefix = "VIS-{$year}-";
        $latest = VisitorLog::query()
            ->where('visit_code', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('visit_code');

        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
