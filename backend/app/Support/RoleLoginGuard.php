<?php

namespace App\Support;

use App\Models\RoleLoginLock;
use App\Models\User;

class RoleLoginGuard
{
    /** Roles that allow only one concurrent login. */
    public static function lockedSlugs(): array
    {
        return ['nurse', 'dispenser', 'cook'];
    }

    public static function normalizeSlug(?string $slug): ?string
    {
        $slug = strtolower(trim((string) $slug));
        if ($slug === 'pharmacist') {
            return 'dispenser';
        }

        return $slug !== '' ? $slug : null;
    }

    public static function isLockedRole(?string $slug): bool
    {
        $slug = self::normalizeSlug($slug);

        return $slug !== null && in_array($slug, self::lockedSlugs(), true);
    }

    public static function roleLabel(?string $slug): string
    {
        return match (self::normalizeSlug($slug)) {
            'nurse' => 'Nurse',
            'dispenser' => 'Dispenser',
            'cook' => 'Cook',
            default => 'Staff',
        };
    }

    /**
     * @return array{ok: bool, message?: string, holder?: User}
     */
    public static function assertCanLogin(User $user): array
    {
        $slug = self::normalizeSlug($user->role?->slug);
        if (! self::isLockedRole($slug)) {
            return ['ok' => true];
        }

        $lock = RoleLoginLock::query()->with('user')->find($slug);
        if ($lock && (int) $lock->user_id !== (int) $user->id) {
            $holder = $lock->user;
            $name = $holder?->name ?: self::roleLabel($slug);

            return [
                'ok' => false,
                'holder' => $holder,
                'message' => self::roleLabel($slug)." {$name} is currently logged in",
            ];
        }

        return ['ok' => true];
    }

    public static function claim(User $user): void
    {
        $slug = self::normalizeSlug($user->role?->slug);
        if (! self::isLockedRole($slug)) {
            return;
        }

        // Same person re-login: drop previous tokens for this user.
        $user->tokens()->delete();

        RoleLoginLock::query()->updateOrCreate(
            ['role_slug' => $slug],
            ['user_id' => $user->id]
        );
    }

    public static function release(User $user): void
    {
        $slug = self::normalizeSlug($user->role?->slug);
        if (! self::isLockedRole($slug)) {
            return;
        }

        RoleLoginLock::query()
            ->where('role_slug', $slug)
            ->where('user_id', $user->id)
            ->delete();
    }
}
