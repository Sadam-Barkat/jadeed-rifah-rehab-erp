<?php

namespace App\Support;

/**
 * Snapshot of adult vital ranges used when a nurse saves a note.
 * Worst single reading sets the condition.
 */
class VitalCondition
{
    public static function assess(array $vitals): array
    {
        $rank = ['normal' => 0, 'watch' => 1, 'serious' => 2, 'emergency' => 3];
        $labels = [
            'normal' => 'Normal',
            'watch' => 'Watch',
            'serious' => 'Critical',
            'emergency' => 'Emergency',
            'unrecorded' => 'Unrecorded',
        ];

        $worst = null;
        $reasons = [];

        foreach (self::checks($vitals) as $check) {
            if ($check === null) {
                continue;
            }
            if ($check['level'] !== 'normal') {
                $reasons[] = $check['reason'];
            }
            if ($worst === null || $rank[$check['level']] > $rank[$worst]) {
                $worst = $check['level'];
            }
        }

        if ($worst === null) {
            $worst = 'unrecorded';
        }

        return [
            'level' => $worst,
            'label' => $labels[$worst],
            'reasons' => $reasons,
        ];
    }

    /**
     * @return array<int, array{level: string, reason: string}|null>
     */
    private static function checks(array $v): array
    {
        return [
            self::band(self::celsius(self::num($v['temperature'] ?? null)), [
                ['emergency', fn ($n) => $n >= 39.1 || $n < 35],
                ['serious', fn ($n) => $n >= 38.1 || $n < 35.5],
                ['watch', fn ($n) => $n >= 37.3 || $n < 36.1],
            ], fn ($n) => 'Temp '.round($n, 1).'°C'),
            self::band(self::num($v['pulse'] ?? null), [
                ['emergency', fn ($n) => $n > 130 || $n < 40],
                ['serious', fn ($n) => $n >= 111 || $n < 50],
                ['watch', fn ($n) => $n >= 101 || $n < 60],
            ], fn ($n) => 'Pulse '.$n),
            self::band(self::num($v['respiratory_rate'] ?? null), [
                ['emergency', fn ($n) => $n >= 30 || $n <= 5],
                ['serious', fn ($n) => $n >= 25 || $n <= 8],
                ['watch', fn ($n) => $n >= 21 || $n <= 11],
            ], fn ($n) => 'RR '.$n),
            self::band(self::num($v['spo2'] ?? null), [
                ['emergency', fn ($n) => $n < 88],
                ['serious', fn ($n) => $n < 92],
                ['watch', fn ($n) => $n < 95],
            ], fn ($n) => 'SpO2 '.$n.'%'),
            self::band(self::num($v['bp_systolic'] ?? null), [
                ['emergency', fn ($n) => $n >= 180 || $n < 80],
                ['serious', fn ($n) => $n >= 160 || $n < 90],
                ['watch', fn ($n) => $n >= 140 || $n < 100],
            ], fn ($n) => 'BP sys '.$n),
            self::band(self::num($v['bp_diastolic'] ?? null), [
                ['emergency', fn ($n) => $n >= 110 || $n < 40],
                ['serious', fn ($n) => $n >= 100 || $n < 50],
                ['watch', fn ($n) => $n >= 90 || $n < 60],
            ], fn ($n) => 'BP dia '.$n),
            self::band(self::num($v['blood_sugar_mg_dl'] ?? null), [
                ['emergency', fn ($n) => $n > 400 || $n < 40],
                ['serious', fn ($n) => $n >= 251 || $n < 54],
                ['watch', fn ($n) => $n >= 181 || $n < 70],
            ], fn ($n) => 'Sugar '.$n),
            self::band(self::num($v['pain_score'] ?? null), [
                ['emergency', fn ($n) => $n >= 9],
                ['serious', fn ($n) => $n >= 7],
                ['watch', fn ($n) => $n >= 4],
            ], fn ($n) => 'Pain '.$n),
        ];
    }

    private static function num(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        return is_numeric($value) ? (float) $value : null;
    }

    /** Convert likely Fahrenheit entries (e.g. 98.6) to Celsius. */
    private static function celsius(?float $value): ?float
    {
        if ($value === null) {
            return null;
        }
        if ($value > 45) {
            return ($value - 32) * 5 / 9;
        }

        return $value;
    }

    /**
     * @param  array<int, array{0: string, 1: callable}>  $bands
     */
    private static function band(?float $value, array $bands, callable $reason): ?array
    {
        if ($value === null) {
            return null;
        }

        foreach ($bands as [$level, $test]) {
            if ($test($value)) {
                return ['level' => $level, 'reason' => $reason($value)];
            }
        }

        return ['level' => 'normal', 'reason' => $reason($value)];
    }
}
