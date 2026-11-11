<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Admission;
use App\Models\PsychologySession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PsychologySessionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = PsychologySession::query()
            ->with(['patient', 'admission', 'creator'])
            ->latest('session_at');

        if ($type = $request->get('session_type')) {
            $query->where('session_type', $type);
        }

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('session_code', 'like', "%{$search}%")
                    ->orWhere('topics', 'like', "%{$search}%")
                    ->orWhereHas('patient', function ($pq) use ($search) {
                        $pq->where('patient_code', 'like', "%{$search}%")
                            ->orWhere('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%");
                    });
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (PsychologySession $s) => $this->payload($s)),
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
            'session_at' => ['nullable', 'date'],
            'session_type' => ['nullable', Rule::in(['individual', 'group', 'family', 'assessment'])],
            'duration_minutes' => ['nullable', 'integer', 'min:5', 'max:300'],
            'mood_before' => ['nullable', 'string', 'max:100'],
            'mood_after' => ['nullable', 'string', 'max:100'],
            'topics' => ['nullable', 'string'],
            'observations' => ['nullable', 'string'],
            'homework' => ['nullable', 'string'],
            'next_session_date' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in(['scheduled', 'completed', 'cancelled'])],
        ]);

        $admission = Admission::query()->findOrFail($data['admission_id']);
        if ($admission->status !== 'active') {
            return response()->json(['message' => 'Psychology session requires an active admission.'], 422);
        }

        $session = PsychologySession::query()->create([
            'session_code' => $this->nextCode(),
            'admission_id' => $admission->id,
            'patient_id' => $admission->patient_id,
            'session_at' => $data['session_at'] ?? now(),
            'session_type' => $data['session_type'] ?? 'individual',
            'duration_minutes' => $data['duration_minutes'] ?? null,
            'mood_before' => $data['mood_before'] ?? null,
            'mood_after' => $data['mood_after'] ?? null,
            'topics' => $data['topics'] ?? null,
            'observations' => $data['observations'] ?? null,
            'homework' => $data['homework'] ?? null,
            'next_session_date' => $data['next_session_date'] ?? null,
            'status' => $data['status'] ?? 'completed',
            'created_by' => $request->user()->id,
        ])->load(['patient', 'admission', 'creator']);

        return response()->json([
            'message' => 'Psychology session saved',
            'data' => $this->payload($session),
        ], 201);
    }

    public function show(PsychologySession $psychologySession): JsonResponse
    {
        $psychologySession->load(['patient', 'admission', 'creator']);

        return response()->json(['data' => $this->payload($psychologySession)]);
    }

    private function payload(PsychologySession $session): array
    {
        return [
            'id' => $session->id,
            'session_code' => $session->session_code,
            'session_type' => $session->session_type,
            'status' => $session->status,
            'session_at' => $session->session_at?->toDateTimeString(),
            'duration_minutes' => $session->duration_minutes,
            'mood_before' => $session->mood_before,
            'mood_after' => $session->mood_after,
            'topics' => $session->topics,
            'observations' => $session->observations,
            'homework' => $session->homework,
            'next_session_date' => $session->next_session_date?->format('Y-m-d'),
            'created_by_name' => $session->creator?->name,
            'patient' => [
                'id' => $session->patient?->id,
                'patient_code' => $session->patient?->patient_code,
                'full_name' => $session->patient?->full_name,
            ],
            'admission' => [
                'id' => $session->admission?->id,
                'admission_code' => $session->admission?->admission_code,
                'status' => $session->admission?->status,
            ],
        ];
    }

    private function nextCode(): string
    {
        $year = now()->format('Y');
        $prefix = "PSY-{$year}-";
        $latest = PsychologySession::query()
            ->where('session_code', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('session_code');

        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
