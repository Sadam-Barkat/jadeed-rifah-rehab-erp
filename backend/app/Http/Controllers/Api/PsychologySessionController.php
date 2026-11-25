<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Admission;
use App\Models\PsychologySession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PsychologySessionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);
        $scope = trim((string) $request->get('scope', 'completed'));
        $upcoming = $scope === 'upcoming';

        $query = PsychologySession::query()
            ->with(['patient', 'admission', 'creator']);

        if ($upcoming) {
            $query->whereNotNull('next_session_date')
                ->whereDate('next_session_date', '>=', now()->toDateString())
                ->orderBy('next_session_date')
                ->orderBy('session_code');
        } else {
            $query->where('status', '!=', 'cancelled')
                ->latest('session_at');
        }

        if ($admissionId = $request->integer('admission_id')) {
            $query->where('admission_id', $admissionId);
        }

        if ($createdBy = $request->integer('created_by')) {
            $query->where('created_by', $createdBy);
        }

        if ($type = $request->get('session_type')) {
            $query->where('session_type', $type);
        }

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        $dateColumn = $upcoming ? 'next_session_date' : 'session_at';

        if ($date = trim((string) $request->get('date', ''))) {
            $query->whereDate($dateColumn, $date);
        } else {
            if ($year = $request->integer('year')) {
                $query->whereYear($dateColumn, $year);
            }
            if ($month = $request->integer('month')) {
                $query->whereMonth($dateColumn, $month);
            }
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('session_code', 'like', "%{$search}%")
                    ->orWhere('topics', 'like', "%{$search}%")
                    ->orWhere('observations', 'like', "%{$search}%")
                    ->orWhere('mood_before', 'like', "%{$search}%")
                    ->orWhere('mood_after', 'like', "%{$search}%")
                    ->orWhereHas('patient', function ($pq) use ($search) {
                        $pq->where('patient_code', 'like', "%{$search}%")
                            ->orWhere('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%");
                    })
                    ->orWhereHas('creator', function ($cq) use ($search) {
                        $cq->where('name', 'like', "%{$search}%");
                    });
            });
        }

        $paginator = $query->paginate($perPage);

        $yearSource = $upcoming ? 'next_session_date' : 'session_at';
        $availableYears = PsychologySession::query()
            ->selectRaw("YEAR({$yearSource}) as y")
            ->whereNotNull($yearSource)
            ->when($upcoming, fn ($q) => $q->whereDate('next_session_date', '>=', now()->toDateString()))
            ->distinct()
            ->orderByDesc('y')
            ->pluck('y')
            ->filter()
            ->map(fn ($y) => (int) $y)
            ->values()
            ->all();

        return response()->json([
            'data' => collect($paginator->items())->map(fn (PsychologySession $s) => $this->payload($s)),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'available_years' => $availableYears,
                'scope' => $upcoming ? 'upcoming' : 'completed',
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'admission_id' => ['nullable', 'exists:admissions,id'],
            'admission_ids' => ['nullable', 'array', 'min:1'],
            'admission_ids.*' => ['integer', 'exists:admissions,id'],
            'session_at' => ['nullable', 'date'],
            'session_type' => ['nullable', Rule::in(['individual', 'group', 'family', 'assessment'])],
            'duration_minutes' => ['nullable', 'integer', 'min:5', 'max:480'],
            'mood_before' => ['nullable', 'string', 'max:100'],
            'mood_after' => ['nullable', 'string', 'max:100'],
            'topics' => ['nullable', 'string'],
            'observations' => ['nullable', 'string'],
            'homework' => ['nullable', 'string'],
            'next_session_date' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in(['scheduled', 'completed', 'cancelled'])],
        ]);

        $type = $data['session_type'] ?? 'individual';
        $ids = collect($data['admission_ids'] ?? [])
            ->when(! empty($data['admission_id']), fn ($c) => $c->push((int) $data['admission_id']))
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        if ($ids->isEmpty()) {
            throw ValidationException::withMessages([
                'admission_ids' => ['Select at least one patient.'],
            ]);
        }

        $multi = in_array($type, ['group', 'family'], true);
        if ($multi && $ids->count() < 2) {
            throw ValidationException::withMessages([
                'admission_ids' => ['Group or family sessions need at least 2 patients.'],
            ]);
        }
        if (! $multi && $ids->count() !== 1) {
            throw ValidationException::withMessages([
                'admission_ids' => ['Select one patient for this session type.'],
            ]);
        }

        if (! empty($data['next_session_date']) && $data['next_session_date'] < now()->toDateString()) {
            throw ValidationException::withMessages([
                'next_session_date' => ['Next session cannot be in the past.'],
            ]);
        }

        $admissions = Admission::query()
            ->with('patient')
            ->whereIn('id', $ids)
            ->where('status', 'active')
            ->get();

        if ($admissions->count() !== $ids->count()) {
            return response()->json(['message' => 'All selected patients must have an active admission.'], 422);
        }

        $code = $this->nextCode();
        $sessionAt = $data['session_at'] ?? now();
        $createdBy = $request->user()->id;

        $sessions = DB::transaction(function () use ($admissions, $code, $sessionAt, $type, $data, $createdBy) {
            $rows = [];
            foreach ($admissions as $admission) {
                $rows[] = PsychologySession::query()->create([
                    'session_code' => $code,
                    'admission_id' => $admission->id,
                    'patient_id' => $admission->patient_id,
                    'session_at' => $sessionAt,
                    'session_type' => $type,
                    'duration_minutes' => $data['duration_minutes'] ?? null,
                    'mood_before' => $data['mood_before'] ?? null,
                    'mood_after' => $data['mood_after'] ?? null,
                    'topics' => $data['topics'] ?? null,
                    'observations' => $data['observations'] ?? null,
                    'homework' => $data['homework'] ?? null,
                    'next_session_date' => $data['next_session_date'] ?? null,
                    'status' => $data['status'] ?? 'completed',
                    'created_by' => $createdBy,
                ])->load(['patient', 'admission', 'creator']);
            }

            return collect($rows);
        });

        $first = $sessions->first();
        $count = $sessions->count();

        return response()->json([
            'message' => $count === 1 ? 'Session saved' : "Session saved for {$count} patients",
            'data' => $this->payload($first),
        ], 201);
    }

    public function markDone(Request $request): JsonResponse
    {
        $data = $request->validate([
            'session_code' => ['required', 'string', 'max:30'],
            'next_session_date' => ['nullable', 'date'],
            'mood_before' => ['nullable', 'string', 'max:100'],
            'mood_after' => ['nullable', 'string', 'max:100'],
            'topics' => ['nullable', 'string'],
            'observations' => ['nullable', 'string'],
            'homework' => ['nullable', 'string'],
            'duration_minutes' => ['nullable', 'integer', 'min:5', 'max:480'],
        ]);

        if (! empty($data['next_session_date']) && $data['next_session_date'] < now()->toDateString()) {
            throw ValidationException::withMessages([
                'next_session_date' => ['Next session cannot be in the past.'],
            ]);
        }

        $sources = PsychologySession::query()
            ->with(['patient', 'admission'])
            ->where('session_code', $data['session_code'])
            ->whereNotNull('next_session_date')
            ->whereDate('next_session_date', '>=', now()->toDateString())
            ->orderBy('id')
            ->get();

        if ($sources->isEmpty()) {
            return response()->json(['message' => 'No upcoming session found for this code.'], 422);
        }

        $createdBy = $request->user()->id;
        $newCode = $this->nextCode();

        $created = DB::transaction(function () use ($sources, $data, $createdBy, $newCode) {
            $rows = [];
            foreach ($sources as $source) {
                $admission = $source->admission;
                if (! $admission || $admission->status !== 'active') {
                    continue;
                }

                $rows[] = PsychologySession::query()->create([
                    'session_code' => $newCode,
                    'admission_id' => $source->admission_id,
                    'patient_id' => $source->patient_id,
                    'session_at' => now(),
                    'session_type' => $source->session_type,
                    'duration_minutes' => $data['duration_minutes'] ?? $source->duration_minutes,
                    'mood_before' => $data['mood_before'] ?? null,
                    'mood_after' => $data['mood_after'] ?? null,
                    'topics' => $data['topics'] ?? $source->topics,
                    'observations' => $data['observations'] ?? null,
                    'homework' => $data['homework'] ?? null,
                    'next_session_date' => $data['next_session_date'] ?? null,
                    'status' => 'completed',
                    'created_by' => $createdBy,
                ])->load(['patient', 'admission', 'creator']);

                $source->update(['next_session_date' => null]);
            }

            return collect($rows);
        });

        if ($created->isEmpty()) {
            return response()->json(['message' => 'No active admissions for this upcoming session.'], 422);
        }

        return response()->json([
            'message' => $created->count() === 1
                ? 'Session marked done'
                : 'Session marked done for '.$created->count().' patients',
            'data' => $this->payload($created->first()),
        ]);
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
            'next_session_date' => $session->next_session_date?->toDateString(),
            'patient' => $session->patient ? [
                'id' => $session->patient->id,
                'patient_code' => $session->patient->patient_code,
                'full_name' => trim(($session->patient->first_name ?? '').' '.($session->patient->last_name ?? '')),
            ] : null,
            'admission' => $session->admission ? [
                'id' => $session->admission->id,
                'admission_code' => $session->admission->admission_code,
                'status' => $session->admission->status,
            ] : null,
            'created_by' => $session->creator?->name,
            'created_by_id' => $session->created_by,
        ];
    }

    private function nextCode(): string
    {
        $latest = PsychologySession::query()->orderByDesc('id')->value('session_code');
        $n = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $n = ((int) $m[1]) + 1;
        }

        return 'PSY-'.str_pad((string) $n, 5, '0', STR_PAD_LEFT);
    }
}
