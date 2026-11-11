<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ManagementNote;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ManagementNoteController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = ManagementNote::query()
            ->with('creator')
            ->latest();

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        } else {
            $query->where('status', 'active');
        }

        if ($category = $request->get('category')) {
            $query->where('category', $category);
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (ManagementNote $n) => $this->payload($n)),
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
            'title' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string'],
            'category' => ['nullable', Rule::in(['policy', 'announcement', 'operational', 'other'])],
        ]);

        $note = ManagementNote::query()->create([
            'note_code' => $this->nextCode(),
            'title' => $data['title'],
            'body' => $data['body'],
            'category' => $data['category'] ?? 'operational',
            'status' => 'active',
            'created_by' => $request->user()->id,
        ])->load('creator');

        return response()->json([
            'message' => 'Management note saved',
            'data' => $this->payload($note),
        ], 201);
    }

    public function archive(ManagementNote $managementNote): JsonResponse
    {
        if ($managementNote->status === 'archived') {
            return response()->json(['message' => 'Note already archived.'], 422);
        }

        $managementNote->update(['status' => 'archived']);
        $managementNote->load('creator');

        return response()->json([
            'message' => 'Note archived',
            'data' => $this->payload($managementNote),
        ]);
    }

    private function payload(ManagementNote $note): array
    {
        return [
            'id' => $note->id,
            'note_code' => $note->note_code,
            'title' => $note->title,
            'body' => $note->body,
            'category' => $note->category,
            'status' => $note->status,
            'created_by_name' => $note->creator?->name,
            'created_at' => $note->created_at?->toDateTimeString(),
        ];
    }

    private function nextCode(): string
    {
        $year = now()->format('Y');
        $prefix = "MGT-{$year}-";
        $latest = ManagementNote::query()
            ->where('note_code', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('note_code');

        $next = 1;
        if ($latest && preg_match('/(\d+)$/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
