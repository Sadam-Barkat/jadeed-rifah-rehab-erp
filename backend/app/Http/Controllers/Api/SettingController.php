<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BackupLog;
use App\Models\FacilitySetting;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SettingController extends Controller
{
    public function showFacility(): JsonResponse
    {
        $setting = $this->currentFacility();

        return response()->json(['data' => $this->facilityPayload($setting)]);
    }

    public function updateFacility(Request $request): JsonResponse
    {
        $data = $request->validate([
            'facility_name' => ['required', 'string', 'max:150'],
            'short_name' => ['nullable', 'string', 'max:64'],
            'phone' => ['nullable', 'string', 'max:32'],
            'email' => ['nullable', 'email', 'max:150'],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'timezone' => ['nullable', 'string', 'max:64'],
            'currency' => ['nullable', 'string', 'max:8'],
            'session_timeout_minutes' => ['nullable', 'integer', 'min:15', 'max:720'],
            'notes' => ['nullable', 'string'],
        ]);

        $setting = $this->currentFacility();
        $setting->update([
            ...$data,
            'timezone' => $data['timezone'] ?? $setting->timezone,
            'currency' => $data['currency'] ?? $setting->currency,
            'session_timeout_minutes' => $data['session_timeout_minutes'] ?? $setting->session_timeout_minutes,
            'updated_by' => $request->user()->id,
        ]);

        Audit::log('settings.update', 'settings', 'facility_setting', $setting->id, 'Facility settings updated');

        return response()->json([
            'message' => 'Facility settings saved',
            'data' => $this->facilityPayload($setting->fresh(['updater'])),
        ]);
    }

    public function indexBackups(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $paginator = BackupLog::query()
            ->with(['recorder'])
            ->latest('backed_up_at')
            ->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (BackupLog $b) => $this->backupPayload($b)),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function storeBackup(Request $request): JsonResponse
    {
        $data = $request->validate([
            'backed_up_at' => ['nullable', 'date'],
            'method' => ['nullable', Rule::in(['manual', 'scheduled'])],
            'status' => ['nullable', Rule::in(['success', 'failed'])],
            'storage_note' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);

        $backup = BackupLog::query()->create([
            'backup_code' => $this->nextBackupCode(),
            'backed_up_at' => $data['backed_up_at'] ?? now(),
            'method' => $data['method'] ?? 'manual',
            'status' => $data['status'] ?? 'success',
            'storage_note' => $data['storage_note'] ?? null,
            'notes' => $data['notes'] ?? null,
            'recorded_by' => $request->user()->id,
        ])->load(['recorder']);

        return response()->json([
            'message' => 'Backup log recorded',
            'data' => $this->backupPayload($backup),
        ], 201);
    }

    private function currentFacility(): FacilitySetting
    {
        $setting = FacilitySetting::query()->with(['updater'])->latest('id')->first();

        if ($setting) {
            return $setting;
        }

        return FacilitySetting::query()->create([
            'facility_name' => 'Jadeed Rifah Rehab Center',
            'short_name' => 'Jadeed Rifah',
            'phone' => null,
            'email' => null,
            'address' => null,
            'city' => null,
            'timezone' => 'Asia/Karachi',
            'currency' => 'PKR',
            'session_timeout_minutes' => 60,
        ])->load(['updater']);
    }

    private function facilityPayload(FacilitySetting $setting): array
    {
        return [
            'id' => $setting->id,
            'facility_name' => $setting->facility_name,
            'short_name' => $setting->short_name,
            'phone' => $setting->phone,
            'email' => $setting->email,
            'address' => $setting->address,
            'city' => $setting->city,
            'timezone' => $setting->timezone,
            'currency' => $setting->currency,
            'session_timeout_minutes' => $setting->session_timeout_minutes,
            'notes' => $setting->notes,
            'updated_by' => $setting->updater?->name,
            'updated_at' => $setting->updated_at?->toDateTimeString(),
        ];
    }

    private function backupPayload(BackupLog $backup): array
    {
        return [
            'id' => $backup->id,
            'backup_code' => $backup->backup_code,
            'backed_up_at' => $backup->backed_up_at?->toDateTimeString(),
            'method' => $backup->method,
            'status' => $backup->status,
            'storage_note' => $backup->storage_note,
            'notes' => $backup->notes,
            'recorded_by' => $backup->recorder?->name,
        ];
    }

    private function nextBackupCode(): string
    {
        $n = BackupLog::query()->count() + 1;

        return 'BKP-'.str_pad((string) $n, 5, '0', STR_PAD_LEFT);
    }
}
