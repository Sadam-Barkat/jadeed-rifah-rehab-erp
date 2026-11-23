<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Admission;
use App\Models\Patient;
use App\Models\VisitorLog;
use App\Services\GatekeeperVisitorAutoCheckout;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class VisitorLogController extends Controller
{
    public function patients(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 100), 1), 100);
        $paginator = Patient::query()
            ->orderBy('first_name')
            ->orderBy('last_name')
            ->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (Patient $patient) => [
                'id' => $patient->id,
                'patient_code' => $patient->patient_code,
                'full_name' => $patient->full_name,
            ]),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);
        $isGatekeeper = $request->user()?->role?->slug === 'gatekeeper';
        $visitorWindowStart = now()->subHours(24);

        app(GatekeeperVisitorAutoCheckout::class)->run();

        $query = VisitorLog::query()
            ->with(['patient', 'admission', 'creator'])
            ->latest('check_in_at');

        if ($isGatekeeper) {
            $query->where('check_in_at', '>', $visitorWindowStart);
        }

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('visit_code', 'like', "%{$search}%")
                    ->orWhere('visitor_name', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('cnic', 'like', "%{$search}%")
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

    public function directory(Request $request): JsonResponse
    {
        $search = trim((string) $request->get('q', ''));
        $logs = VisitorLog::query()
            ->whereNotNull('cnic')
            ->where('cnic', '!=', '')
            ->latest('check_in_at')
            ->limit(800)
            ->get(['visitor_name', 'cnic', 'phone', 'check_in_at']);

        $byCnic = [];
        foreach ($logs as $log) {
            $key = $this->normalizeCnic($log->cnic);
            if ($key === '' || isset($byCnic[$key])) {
                continue;
            }
            $byCnic[$key] = [
                'cnic_key' => $key,
                'visitor_name' => $log->visitor_name,
                'cnic' => $log->cnic,
                'phone' => $log->phone,
            ];
        }

        $list = collect($byCnic)->values();
        if ($search !== '') {
            $q = mb_strtolower($search);
            $digits = $this->normalizeCnic($search);
            $list = $list->filter(function (array $row) use ($q, $digits) {
                $name = mb_strtolower((string) $row['visitor_name']);
                $cnic = $this->normalizeCnic($row['cnic']);

                return str_contains($name, $q)
                    || ($digits !== '' && str_contains($cnic, $digits))
                    || str_contains(mb_strtolower((string) $row['cnic']), $q);
            })->values();
        }

        return response()->json([
            'data' => $list->sortBy('visitor_name', SORT_NATURAL | SORT_FLAG_CASE)->values()->take(200)->all(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        app(GatekeeperVisitorAutoCheckout::class)->run();

        $data = $request->validate([
            'admission_id' => ['nullable', 'exists:admissions,id'],
            'patient_id' => ['nullable', 'exists:patients,id'],
            'visitor_name' => ['required', 'string', 'max:150'],
            'party_size' => ['required', 'integer', 'min:1', 'max:20'],
            'relation' => ['nullable', Rule::in(['relative', 'friend', 'other'])],
            'phone' => ['nullable', 'string', 'max:30'],
            'cnic' => ['required', 'string', 'max:20'],
            'purpose' => ['nullable', 'string', 'max:255'],
            'check_in_at' => ['nullable', 'date'],
            'items_brought' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
        ]);

        $cnic = trim($data['cnic']);
        $cnicKey = $this->normalizeCnic($cnic);
        if ($cnicKey === '') {
            return response()->json(['message' => 'CNIC is required.'], 422);
        }

        $admission = null;
        $patientId = null;
        if (! empty($data['admission_id'])) {
            $admission = Admission::query()->findOrFail($data['admission_id']);
            if ($admission->status !== 'active') {
                return response()->json(['message' => 'Select an active admission, or leave patient empty.'], 422);
            }
            $patientId = $admission->patient_id;
        }
        if (! empty($data['patient_id'])) {
            $patient = Patient::query()->findOrFail($data['patient_id']);
            if ($admission && $admission->patient_id !== $patient->id) {
                return response()->json(['message' => 'Selected admission does not belong to this patient.'], 422);
            }
            $patientId = $patient->id;
            $admission ??= Admission::query()
                ->where('patient_id', $patient->id)
                ->where('status', 'active')
                ->latest('admitted_at')
                ->first();
        }

        $visit = VisitorLog::query()->create([
            'visit_code' => $this->nextCode(),
            'admission_id' => $admission?->id,
            'patient_id' => $patientId,
            'visitor_name' => trim($data['visitor_name']),
            'party_size' => max(1, (int) ($data['party_size'] ?? 1)),
            'relation' => $data['relation'] ?? null,
            'phone' => $data['phone'] ?? null,
            'cnic' => $cnic,
            'purpose' => $data['purpose'] ?? null,
            'check_in_at' => $data['check_in_at'] ?? now(),
            'items_brought' => $data['items_brought'] ?? null,
            'notes' => $data['notes'] ?? null,
            'status' => 'checked_in',
            'created_by' => $request->user()->id,
        ])->load(['patient', 'admission', 'creator']);

        return response()->json([
            'message' => 'Visitor logged',
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
            'party_size' => (int) ($visit->party_size ?? 1),
            'relation' => $visit->relation,
            'phone' => $visit->phone,
            'cnic' => $visit->cnic,
            'purpose' => $visit->purpose,
            'check_in_at' => $visit->check_in_at?->toDateTimeString(),
            'check_out_at' => $visit->check_out_at?->toDateTimeString(),
            'items_brought' => $visit->items_brought,
            'notes' => $visit->notes,
            'status' => $visit->status,
            'logged_by' => $visit->creator?->name,
            'patient' => $visit->patient_id ? [
                'id' => $visit->patient?->id,
                'patient_code' => $visit->patient?->patient_code,
                'full_name' => $visit->patient?->full_name,
            ] : null,
            'admission' => $visit->admission_id ? [
                'id' => $visit->admission?->id,
                'admission_code' => $visit->admission?->admission_code,
                'status' => $visit->admission?->status,
            ] : null,
        ];
    }

    private function normalizeCnic(?string $cnic): string
    {
        return preg_replace('/\D+/', '', (string) $cnic) ?: '';
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
