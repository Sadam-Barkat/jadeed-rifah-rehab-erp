<?php

namespace App\Support;

class ClinicalDoctor
{
    /** @return list<string> */
    public static function roleSlugs(): array
    {
        return [
            'consultant-psychiatrist',
            'medical-officer',
            'doctor', // legacy
        ];
    }

    public static function isClinical(?string $slug): bool
    {
        return in_array((string) $slug, self::roleSlugs(), true);
    }
}
