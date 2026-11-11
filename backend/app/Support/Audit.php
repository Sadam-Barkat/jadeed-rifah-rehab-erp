<?php

namespace App\Support;

use App\Models\AuditLog;
use Illuminate\Support\Facades\Auth;

class Audit
{
    public static function log(
        string $action,
        ?string $module = null,
        ?string $entityType = null,
        ?int $entityId = null,
        ?string $summary = null,
        array $meta = [],
        ?int $userId = null,
    ): void {
        try {
            AuditLog::query()->create([
                'user_id' => $userId ?? Auth::id(),
                'action' => $action,
                'module' => $module,
                'entity_type' => $entityType,
                'entity_id' => $entityId,
                'summary' => $summary,
                'ip_address' => request()?->ip(),
                'meta' => $meta ?: null,
                'created_at' => now(),
            ]);
        } catch (\Throwable) {
            // Never break the main request.
        }
    }
}
