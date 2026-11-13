<?php

namespace App\Services;

use App\Models\AppNotification;
use App\Models\User;
use Illuminate\Support\Collection;

class AppNotifier
{
    /**
     * @param  array<int>|Collection<int, int>|null  $userIds
     */
    public function notifyUsers(
        array|Collection|null $userIds,
        string $type,
        string $title,
        ?string $body = null,
        ?string $link = null,
        ?array $meta = null,
        ?int $createdBy = null,
    ): int {
        $ids = collect($userIds ?? [])
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        if ($ids->isEmpty()) {
            return 0;
        }

        $now = now();
        $rows = $ids->map(fn (int $id) => [
            'user_id' => $id,
            'type' => $type,
            'title' => $title,
            'body' => $body,
            'link' => $link,
            'meta' => $meta ? json_encode($meta) : null,
            'read_at' => null,
            'created_by' => $createdBy,
            'created_at' => $now,
            'updated_at' => $now,
        ])->all();

        AppNotification::query()->insert($rows);

        return count($rows);
    }

    public function notifyRoleSlugs(
        array $roleSlugs,
        string $type,
        string $title,
        ?string $body = null,
        ?string $link = null,
        ?array $meta = null,
        ?int $createdBy = null,
    ): int {
        $ids = User::query()
            ->where('is_active', true)
            ->whereHas('role', fn ($q) => $q->whereIn('slug', $roleSlugs))
            ->pluck('id');

        return $this->notifyUsers($ids, $type, $title, $body, $link, $meta, $createdBy);
    }
}
