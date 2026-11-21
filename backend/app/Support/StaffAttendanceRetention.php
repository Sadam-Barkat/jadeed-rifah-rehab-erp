<?php

namespace App\Support;

use App\Models\StaffAttendance;
use Illuminate\Support\Facades\Storage;

class StaffAttendanceRetention
{
    public const PHOTO_RETENTION_HOURS = 24;

    public static function maintain(): void
    {
        $now = now();
        $cutoff = $now->copy()->subHours(self::PHOTO_RETENTION_HOURS);

        StaffAttendance::query()
            ->where('status', 'present')
            ->where('check_in_at', '<=', $cutoff)
            ->update([
                'status' => 'checked_out',
                'check_out_at' => $now,
            ]);

        $expired = StaffAttendance::query()
            ->whereNotNull('photo_path')
            ->where('check_in_at', '<=', $cutoff)
            ->limit(500)
            ->get(['id', 'photo_path']);

        foreach ($expired as $row) {
            if (Storage::disk('public')->exists($row->photo_path)) {
                Storage::disk('public')->delete($row->photo_path);
            }
            $row->update(['photo_path' => null]);
        }
    }
}
