<?php

namespace App\Support;

/**
 * Pakistan mobile: 03XXXXXXXXX (11) or +92XXXXXXXXXX (drop leading 0).
 * Stored as local 03XXXXXXXXX.
 */
class PkPhone
{
    /** @return string|null|false null empty, false invalid, string normalized 03… */
    public static function normalize(?string $value): string|false|null
    {
        $raw = trim((string) $value);
        if ($raw === '') {
            return null;
        }

        $digits = preg_replace('/\D+/', '', $raw) ?: '';

        if (preg_match('/^03\d{9}$/', $digits)) {
            return $digits;
        }

        // +92 / 92 + 10-digit mobile (without leading 0)
        if (preg_match('/^92\d{10}$/', $digits)) {
            return '0'.substr($digits, 2);
        }

        return false;
    }

    public static function isValid(?string $value): bool
    {
        return is_string(self::normalize($value));
    }
}
