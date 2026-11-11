<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FacilitySetting;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
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

        $user?->currentAccessToken()?->delete();

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
            'email' => $user->email,
            'role' => $user->role?->name,
            'role_slug' => $user->role?->slug,
            'modules' => $user->role?->modules ?? [],
        ];
    }
}
