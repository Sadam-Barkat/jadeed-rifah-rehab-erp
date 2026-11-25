<?php

namespace App\Support;

/**
 * Roster staff who appear in Staff + Gate attendance only (no app login).
 */
class AttendanceOnlyStaff
{
    /** @return list<string> */
    public static function slugs(): array
    {
        return ['security-guard', 'cleaner'];
    }

    public static function is(?string $slug): bool
    {
        return in_array(strtolower(trim((string) $slug)), self::slugs(), true);
    }

    public static function label(?string $slug): string
    {
        return match (strtolower(trim((string) $slug))) {
            'security-guard' => 'Security Guard',
            'cleaner' => 'Cleaner',
            default => 'Staff',
        };
    }
}
