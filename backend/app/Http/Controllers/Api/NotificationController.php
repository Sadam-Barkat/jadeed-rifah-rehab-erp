<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use App\Services\AppNotifier;
use App\Support\SecureUpload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = AppNotification::query()
            ->with(['creator:id,name,photo_path,role_id', 'creator.role:id,slug,name'])
            ->where('user_id', $request->user()->id)
            ->latest('id');

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
                'unread_count' => AppNotification::query()
                    ->where('user_id', $request->user()->id)
                    ->whereNull('read_at')
                    ->count(),
            ],
        ]);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        $count = AppNotification::query()
            ->where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->count();

        return response()->json(['unread_count' => $count]);
    }

    public function markRead(Request $request, AppNotification $notification): JsonResponse
    {
        if ($notification->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        if (! $notification->read_at) {
            $notification->update(['read_at' => now()]);
        }

        return response()->json([
            'message' => 'Marked as read',
            'data' => $this->payload(
                $notification->fresh()->loadMissing(['creator:id,name,photo_path,role_id', 'creator.role:id,slug,name'])
            ),
        ]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        AppNotification::query()
            ->where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['message' => 'All marked as read', 'unread_count' => 0]);
    }

    private function payload(AppNotification $n): array
    {
        $creator = $n->creator;
        $name = $creator?->name ?: 'System';
        $initial = mb_strtoupper(mb_substr(trim($name), 0, 1)) ?: 'S';
        $meta = is_array($n->meta) ? $n->meta : [];
        $department = $meta['department']
            ?? AppNotifier::departmentLabel($creator?->role?->slug);

        return [
            'id' => $n->id,
            'type' => $n->type,
            'title' => $n->title,
            'body' => $n->body,
            'link' => $this->resolveLink($n->link, $meta),
            'department' => $department,
            'meta' => $meta,
            'is_read' => (bool) $n->read_at,
            'read_at' => $n->read_at?->toDateTimeString(),
            'created_at' => $n->created_at?->toDateTimeString(),
            'sender' => [
                'id' => $creator?->id,
                'name' => $name,
                'initial' => $initial,
                'department' => $department,
                'photo_url' => SecureUpload::url($creator?->photo_path),
            ],
        ];
    }

    /**
     * Keep old notifications openable after UI route changes
     * (e.g. Plans tab removed → fee plan detail page).
     *
     * @param  array<string, mixed>  $meta
     */
    private function resolveLink(?string $link, array $meta): ?string
    {
        $feePlanId = (int) ($meta['fee_plan_id'] ?? 0);
        if ($feePlanId > 0) {
            return '/app/fee-plans/'.$feePlanId;
        }

        $paymentId = (int) ($meta['payment_id'] ?? 0);
        if ($paymentId > 0) {
            return '/app/payments/'.$paymentId;
        }

        $patientId = (int) ($meta['patient_id'] ?? 0);
        $link = trim((string) $link);

        // Admit requests → admission page with patient preselected.
        if ($patientId > 0 && (str_contains($link, 'management') || str_contains($link, 'admission') || $link === '')) {
            if (str_contains($link, 'billing') || str_contains($link, 'fees=create')) {
                return '/app/billing?tab=fees&fees=create';
            }

            return '/app/admission?patient_id='.$patientId;
        }

        if ($link === '') {
            return null;
        }

        // Legacy admin Plans tab → cannot open a specific plan without id.
        if (str_contains($link, 'tab=plans')) {
            return '/app/admin/finance';
        }

        if ($link === '/app/billing' || str_ends_with($link, '/billing')) {
            return '/app/billing?tab=fees&fees=create';
        }

        return $link;
    }
}
