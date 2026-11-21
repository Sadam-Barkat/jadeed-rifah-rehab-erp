<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StaffAttendance;
use App\Models\User;
use App\Support\Audit;
use App\Support\SecureUpload;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AttendanceController extends Controller
{
    /** Keep attendance photos this many days (storage-friendly). */
    public const PHOTO_RETENTION_DAYS = 14;

    public function day(Request $request): JsonResponse
    {
        $this->purgeOldPhotos();

        $data = $request->validate([
            'date' => ['nullable', 'date'],
        ]);
        $date = isset($data['date'])
            ? Carbon::parse($data['date'])->toDateString()
            : now()->toDateString();

        $rows = StaffAttendance::query()
            ->with(['user.role:id,name,slug', 'checker:id,name'])
            ->whereDate('attendance_date', $date)
            ->latest('check_in_at')
            ->get();

        return response()->json([
            'data' => $rows->map(fn (StaffAttendance $a) => $this->listPayload($a))->values(),
            'meta' => [
                'date' => $date,
                'total' => $rows->count(),
                'photo_retention_days' => self::PHOTO_RETENTION_DAYS,
            ],
        ]);
    }

    /** Gatekeeper: photo + staff 4-digit attendance code. */
    public function gateCheckIn(Request $request): JsonResponse
    {
        $this->purgeOldPhotos();

        $data = $request->validate([
            'attendance_code' => ['required', 'string', 'size:4'],
            'photo' => SecureUpload::imageRules(true),
        ], SecureUpload::maxMessages([
            'photo' => 'Photo',
        ]));

        $code = preg_replace('/\D+/', '', $data['attendance_code']) ?: '';
        if (strlen($code) !== 4) {
            return response()->json(['message' => 'Enter a valid 4-digit code'], 422);
        }

        $staff = User::query()
            ->with('role:id,name,slug')
            ->where('attendance_code', $code)
            ->where('is_active', true)
            ->first();

        if (! $staff) {
            return response()->json(['message' => 'Staff code not found'], 422);
        }

        $date = now()->toDateString();
        $existing = StaffAttendance::query()
            ->where('user_id', $staff->id)
            ->whereDate('attendance_date', $date)
            ->first();

        if ($existing) {
            return response()->json([
                'message' => 'Already marked present today',
                'data' => $this->listPayload($existing->load(['user.role:id,name,slug', 'checker:id,name'])),
            ], 422);
        }

        $photoPath = SecureUpload::storeImage($request->file('photo'), 'attendance-photos', 'att_');

        $row = StaffAttendance::query()->create([
            'user_id' => $staff->id,
            'attendance_date' => $date,
            'check_in_at' => now(),
            'photo_path' => $photoPath,
            'checked_in_by' => $request->user()->id,
            'status' => 'present',
        ]);

        Audit::log(
            'attendance.gate_check_in',
            'staff',
            'staff_attendance',
            $row->id,
            "Gate check-in for {$staff->name}"
        );

        return response()->json([
            'message' => 'Attendance marked',
            'data' => $this->listPayload($row->load(['user.role:id,name,slug', 'checker:id,name'])),
        ], 201);
    }

    private function listPayload(StaffAttendance $row): array
    {
        return [
            'id' => $row->id,
            'date' => $row->attendance_date?->format('Y-m-d'),
            'check_in_at' => $row->check_in_at?->toDateTimeString(),
            'status' => $row->status,
            'photo_url' => SecureUpload::url($row->photo_path),
            'staff' => [
                'id' => $row->user?->id,
                'name' => $row->user?->name,
                'staff_code' => $row->user?->staff_code,
                'role' => $row->user?->role?->name,
            ],
            'checked_in_by' => $row->checker?->name,
        ];
    }

    private function purgeOldPhotos(): void
    {
        $cutoff = now()->subDays(self::PHOTO_RETENTION_DAYS)->startOfDay();
        $old = StaffAttendance::query()
            ->whereNotNull('photo_path')
            ->where('attendance_date', '<', $cutoff->toDateString())
            ->limit(200)
            ->get(['id', 'photo_path']);

        foreach ($old as $row) {
            if ($row->photo_path && Storage::disk('public')->exists($row->photo_path)) {
                Storage::disk('public')->delete($row->photo_path);
            }
            $row->update(['photo_path' => null]);
        }
    }
}
