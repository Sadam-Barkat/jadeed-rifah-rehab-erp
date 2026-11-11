<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = AppNotification::query()
            ->where('user_id', $request->user()->id)
            ->latest();

        if ($request->get('unread') === '1') {
            $query->whereNull('read_at');
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (AppNotification $n) => $this->payload($n)),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        $count = AppNotification::query()
            ->where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->count();

        return response()->json(['data' => ['count' => $count]]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_id' => ['nullable', 'exists:users,id'],
            'broadcast' => ['nullable', 'boolean'],
            'title' => ['required', 'string', 'max:255'],
            'message' => ['required', 'string'],
            'type' => ['nullable', Rule::in(['info', 'success', 'warning', 'danger'])],
            'link' => ['nullable', 'string', 'max:255'],
        ]);

        $broadcast = $request->boolean('broadcast');
        if (! $broadcast && empty($data['user_id'])) {
            return response()->json(['message' => 'Select a user or enable broadcast.'], 422);
        }

        $created = DB::transaction(function () use ($request, $data, $broadcast) {
            $userIds = $broadcast
                ? User::query()->where('is_active', true)->pluck('id')->all()
                : [(int) $data['user_id']];

            $rows = [];
            foreach ($userIds as $userId) {
                $rows[] = AppNotification::query()->create([
                    'user_id' => $userId,
                    'title' => $data['title'],
                    'message' => $data['message'],
                    'type' => $data['type'] ?? 'info',
                    'link' => $data['link'] ?? null,
                    'created_by' => $request->user()->id,
                ]);
            }

            return $rows;
        });

        return response()->json([
            'message' => 'Notification sent',
            'data' => [
                'count' => count($created),
            ],
        ], 201);
    }

    public function markRead(Request $request, AppNotification $appNotification): JsonResponse
    {
        if ($appNotification->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Not allowed.'], 403);
        }

        if (! $appNotification->read_at) {
            $appNotification->update(['read_at' => now()]);
        }

        return response()->json([
            'message' => 'Marked as read',
            'data' => $this->payload($appNotification->fresh()),
        ]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        AppNotification::query()
            ->where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['message' => 'All notifications marked as read']);
    }

    private function payload(AppNotification $n): array
    {
        return [
            'id' => $n->id,
            'title' => $n->title,
            'message' => $n->message,
            'type' => $n->type,
            'link' => $n->link,
            'read_at' => $n->read_at?->toDateTimeString(),
            'is_read' => (bool) $n->read_at,
            'created_at' => $n->created_at?->toDateTimeString(),
        ];
    }
}
