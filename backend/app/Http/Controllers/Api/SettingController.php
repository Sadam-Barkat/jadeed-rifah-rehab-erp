<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FacilitySetting;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
}
