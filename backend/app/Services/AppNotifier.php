<?php

namespace App\Services;

use App\Models\AppNotification;
use App\Models\User;
use Illuminate\Support\Collection;

class AppNotifier
{
    /** @var array<string, string> */
    private const DEPT_LABELS = [
        'admin' => 'Admin',
        'owner' => 'Admin',
        'finance' => 'Finance',
        'reception' => 'Reception',
        'receptionist' => 'Reception',
        'doctor' => 'Doctor',
        'nurse' => 'Nursing',
        'nursing' => 'Nursing',
        'gate' => 'Gate',
        'gatekeeper' => 'Gate',
        'pharmacist' => 'Pharmacy',
        'pharmacy' => 'Pharmacy',
        'inventory' => 'Inventory',
        'inventory-manager' => 'Inventory',
        'accounts' => 'Accounts',
    ];

    public static function departmentLabel(?string $roleSlug): string
    {
        $slug = strtolower(trim((string) $roleSlug));

        return self::DEPT_LABELS[$slug] ?? ($slug !== '' ? ucfirst($slug) : 'System');
    }

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

        $department = 'System';
        if ($createdBy) {
            $creator = User::query()->with('role:id,slug,name')->find($createdBy);
            $department = self::departmentLabel($creator?->role?->slug);
        }

        $meta = array_merge($meta ?? [], ['department' => $department]);

        $now = now();
        $rows = $ids->map(fn (int $id) => [
            'user_id' => $id,
            'type' => $type,
            'title' => $title,
            'body' => $body,
            'link' => $link,
            'meta' => json_encode($meta),
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
