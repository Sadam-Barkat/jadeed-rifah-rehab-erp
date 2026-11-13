<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $paginator = $this->filteredQuery($request)->paginate($perPage);

        $years = AuditLog::query()
            ->whereNotNull('created_at')
            ->selectRaw('DISTINCT YEAR(created_at) as y')
            ->orderByDesc('y')
            ->pluck('y')
            ->filter()
            ->values()
            ->all();

        return response()->json([
            'data' => collect($paginator->items())->map(fn (AuditLog $log) => $this->mapLog($log)),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'years' => $years,
            ],
        ]);
    }

    public function export(Request $request): StreamedResponse
    {
        $query = $this->filteredQuery($request)
            ->reorder()
            ->orderBy('id')
            ->limit(10000);

        $filename = 'audit-logs-'.now()->format('Ymd-His').'.csv';

        return response()->streamDownload(function () use ($query) {
            $out = fopen('php://output', 'w');
            fputcsv($out, [
                'id',
                'created_at',
                'user',
                'action',
                'module',
                'entity_type',
                'entity_id',
                'summary',
                'ip_address',
            ]);

            foreach ($query->cursor() as $log) {
                fputcsv($out, [
                    $log->id,
                    $log->created_at?->toDateTimeString(),
                    $log->user?->name,
                    $log->action,
                    $log->module,
                    $log->entity_type,
                    $log->entity_id,
                    $log->summary,
                    $log->ip_address,
                ]);
            }

            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    private function filteredQuery(Request $request): Builder
    {
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

        $year = (int) $request->get('year', 0);
        $month = (int) $request->get('month', 0);
        $date = trim((string) $request->get('date', ''));

        if ($date !== '') {
            try {
                $day = Carbon::parse($date);
                $query->whereBetween('created_at', [
                    $day->copy()->startOfDay(),
                    $day->copy()->endOfDay(),
                ]);
            } catch (\Throwable) {
                // ignore invalid date
            }
        } else {
            if ($year >= 2000 && $year <= 2100) {
                $query->whereYear('created_at', $year);
            }

            if ($month >= 1 && $month <= 12) {
                $query->whereMonth('created_at', $month);
            }
        }

        return $query;
    }

    private function mapLog(AuditLog $log): array
    {
        return [
            'id' => $log->id,
            'action' => $log->action,
            'module' => $log->module,
            'entity_type' => $log->entity_type,
            'entity_id' => $log->entity_id,
            'summary' => $log->summary,
            'ip_address' => $log->ip_address,
            'user' => $log->user?->name,
            'created_at' => $log->created_at?->toDateTimeString(),
        ];
    }
}
