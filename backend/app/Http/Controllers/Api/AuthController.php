<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FacilitySetting;
use App\Models\User;
use App\Support\AttendanceOnlyStaff;
use App\Support\Audit;
use App\Support\RoleLoginGuard;
use App\Support\SecureUpload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        /** @var User|null $user */
        $user = User::query()->with('role')->where('email', $credentials['email'])->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Invalid email or password.'],
            ]);
        }

        if (! $user->is_active) {
            throw ValidationException::withMessages([
                'email' => ['This account is deactivated.'],
            ]);
        }

        if (AttendanceOnlyStaff::is($user->role?->slug)) {
            throw ValidationException::withMessages([
                'email' => ['This staff record is for attendance only. No app login.'],
            ]);
        }

        $guard = RoleLoginGuard::assertCanLogin($user);
        if (! ($guard['ok'] ?? false)) {
            return response()->json([
                'message' => $guard['message'] ?? 'Another staff member is currently logged in for this role.',
                'locked_by' => $guard['holder']?->name,
                'role' => RoleLoginGuard::roleLabel($user->role?->slug),
            ], 409);
        }

        RoleLoginGuard::claim($user);
        $token = $user->createToken('web')->plainTextToken;

        Audit::log(
            'login',
            'auth',
            'user',
            $user->id,
            "User {$user->email} signed in",
            userId: $user->id,
        );

        return response()->json([
            'message' => 'Login successful',
            'token' => $token,
            'user' => $this->userPayload($user),
            'session_timeout_minutes' => $this->sessionTimeoutMinutes(),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user()->load('role');

        return response()->json([
            'user' => $this->userPayload($user),
            'session_timeout_minutes' => $this->sessionTimeoutMinutes(),
        ]);
    }

    public function updateAccount(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $data = $request->validate([
            'email' => ['required', 'email', 'max:150', 'unique:users,email,'.$user->id],
            'current_password' => ['required', 'string'],
            'password' => ['nullable', 'string', 'min:8', 'confirmed'],
        ]);

        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Current password is incorrect.'],
            ]);
        }

        $user->email = $data['email'];
        if (! empty($data['password'])) {
            $user->password = $data['password'];
            $user->must_change_password = false;
        }
        $user->save();

        Audit::log(
            'account_update',
            'settings',
            'user',
            $user->id,
            "Account updated for {$user->email}",
            userId: $user->id,
        );

        return response()->json([
            'message' => 'Account updated',
            'user' => $this->userPayload($user->load('role')),
        ]);
    }

    /** Staff self-service: basic profile only (not email / CNIC / role). */
    public function updateProfile(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'father_name' => ['nullable', 'string', 'max:150'],
            'date_of_birth' => ['nullable', 'date'],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'photo' => SecureUpload::imageRules(false),
            'remove_photo' => ['nullable', 'boolean'],
        ], array_merge(SecureUpload::maxMessages([
            'photo' => 'Photo',
        ]), [
            'photo.mimes' => 'Photo must be a JPG, PNG, or WEBP image.',
        ]));

        $user->name = trim($data['name']);
        $user->father_name = isset($data['father_name']) ? trim((string) $data['father_name']) ?: null : $user->father_name;
        $user->date_of_birth = $data['date_of_birth'] ?? null;
        $user->address = isset($data['address']) ? trim((string) $data['address']) ?: null : null;
        $user->city = isset($data['city']) ? trim((string) $data['city']) ?: null : null;

        $removePhoto = $request->boolean('remove_photo');

        if ($request->hasFile('photo')) {
            if ($user->photo_path && Storage::disk('public')->exists($user->photo_path)) {
                Storage::disk('public')->delete($user->photo_path);
            }
            $user->photo_path = SecureUpload::storeImage($request->file('photo'), 'staff-photos', 'staff_');
        } elseif ($removePhoto) {
            if ($user->photo_path && Storage::disk('public')->exists($user->photo_path)) {
                Storage::disk('public')->delete($user->photo_path);
            }
            $user->photo_path = null;
        }

        $user->save();

        Audit::log(
            'profile_update',
            'auth',
            'user',
            $user->id,
            "Profile updated for {$user->email}",
            userId: $user->id,
        );

        return response()->json([
            'message' => 'Profile updated',
            'user' => $this->userPayload($user->load('role')),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        Audit::log(
            'logout',
            'auth',
            'user',
            $user?->id,
            'User signed out',
            userId: $user?->id,
        );

        if ($user) {
            $user->loadMissing('role');
            RoleLoginGuard::release($user);
            $user->currentAccessToken()?->delete();
        }

        return response()->json([
            'message' => 'Signed out',
        ]);
    }

    private function sessionTimeoutMinutes(): int
    {
        return (int) (FacilitySetting::query()->value('session_timeout_minutes') ?: 60);
    }

    private function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'father_name' => $user->father_name,
            'email' => $user->email,
            'phone' => $user->phone,
            'cnic' => $user->cnic,
            'gender' => $user->gender,
            'date_of_birth' => $user->date_of_birth?->format('Y-m-d'),
            'address' => $user->address,
            'city' => $user->city,
            'photo_url' => SecureUpload::url($user->photo_path),
            'role' => $user->role?->name,
            'role_slug' => $user->role?->slug,
            'modules' => $user->role?->modules ?? [],
            'must_change_password' => (bool) $user->must_change_password,
            'staff_code' => $user->staff_code,
        ];
    }
}
