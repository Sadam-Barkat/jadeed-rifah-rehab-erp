<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = AuditLog::query()
            ->with(['user:id,name,email'])
            ->latest('created_at')
            ->latest('id');

        if ($action = $request->get('action')) {
            $query->where('action', $action);
        }

        if ($module = $request->get('module')) {
            $query->where('module', $module);
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('summary', 'like', "%{$search}%")
                    ->orWhere('action', 'like', "%{$search}%")
                    ->orWhere('module', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($uq) use ($search) {
                        $uq->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (AuditLog $log) => [
                'id' => $log->id,
                'action' => $log->action,
                'module' => $log->module,
                'entity_type' => $log->entity_type,
                'entity_id' => $log->entity_id,
                'summary' => $log->summary,
                'ip_address' => $log->ip_address,
                'user' => $log->user?->name,
                'created_at' => $log->created_at?->toDateTimeString(),
            ]),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }
}
