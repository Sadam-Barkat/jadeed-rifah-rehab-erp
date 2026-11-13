<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    /** Roles Admin can assign when creating staff (not Admin itself). */
    private const STAFF_ROLE_SLUGS = [
        'receptionist',
        'gatekeeper',
        'doctor',
        'nurse',
        'finance',
        'pharmacist',
        'inventory-manager',
    ];

    public function roles(): JsonResponse
    {
        $roles = Role::query()
            ->whereIn('slug', self::STAFF_ROLE_SLUGS)
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'modules']);
        return response()->json([
            'data' => $roles->map(fn (Role $r) => [
                'id' => $r->id,
                'name' => $r->name,
                'slug' => $r->slug,
                'modules' => $r->modules ?? [],
            ]),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 50);

        $query = User::query()
            ->with('role')
            ->whereHas('role', fn ($q) => $q->whereIn('slug', self::STAFF_ROLE_SLUGS))
            ->latest();

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        if ($roleSlug = trim((string) $request->get('role', ''))) {
            if (in_array($roleSlug, self::STAFF_ROLE_SLUGS, true)) {
                $query->whereHas('role', fn ($q) => $q->where('slug', $roleSlug));
            }
        }

        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('staff_code', 'like', "%{$search}%");
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (User $u) => $this->payload($u)),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'email' => ['required', 'email', 'max:150', 'unique:users,email'],
            'phone' => ['required', 'string', 'max:30'],
            'password' => ['nullable', 'string', 'min:8'],
            'role_id' => ['required', 'exists:roles,id'],
            'is_active' => ['nullable', 'boolean'],
            'generate_password' => ['nullable', 'boolean'],
        ]);

        $role = Role::query()->findOrFail($data['role_id']);
        if (! in_array($role->slug, self::STAFF_ROLE_SLUGS, true)) {
            return response()->json(['message' => 'Invalid staff role.'], 422);
        }

        $tempPassword = $data['password'] ?? null;
        $auto = $request->boolean('generate_password', true) || empty($tempPassword);
        if ($auto) {
            $tempPassword = $this->generateTempPassword();
        }

        $email = $data['email'];

        $user = User::query()->create([
            'staff_code' => $this->nextStaffCode($role->slug),
            'name' => $data['name'],
            'email' => $email,
            'phone' => trim($data['phone']),
            'password' => $tempPassword, // cast: hashed at rest; plaintext returned once only
            'role_id' => $role->id,
            'is_active' => $data['is_active'] ?? true,
            'must_change_password' => true,
        ])->load('role');

        Audit::log('user.create', 'users', 'user', $user->id, "Created staff {$user->email}");

        return response()->json([
            'message' => 'Staff created',
            'data' => $this->payload($user),
            'credentials' => $this->credentialsPayload($user, $tempPassword),
        ], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:150'],
            'email' => ['sometimes', 'required', 'email', 'max:150', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => ['sometimes', 'required', 'string', 'max:30'],
            'password' => ['nullable', 'string', 'min:8'],
            'role_id' => ['sometimes', 'required', 'exists:roles,id'],
            'is_active' => ['nullable', 'boolean'],
            'must_change_password' => ['nullable', 'boolean'],
            'reset_password' => ['nullable', 'boolean'],
        ]);

        if ($request->user()->id === $user->id && array_key_exists('is_active', $data) && ! $data['is_active']) {
            return response()->json(['message' => 'You cannot deactivate your own account.'], 422);
        }

        if (array_key_exists('role_id', $data)) {
            $role = Role::query()->findOrFail($data['role_id']);
            if (! in_array($role->slug, self::STAFF_ROLE_SLUGS, true)) {
                return response()->json(['message' => 'Invalid staff role.'], 422);
            }
        }

        $tempPassword = null;
        if ($request->boolean('reset_password')) {
            $tempPassword = $this->generateTempPassword();
            $data['password'] = $tempPassword;
            $data['must_change_password'] = true;
        }

        $payload = collect($data)->except(['password', 'reset_password'])->all();
        if (! empty($data['password'])) {
            $payload['password'] = $data['password'];
            $payload['must_change_password'] = $data['must_change_password'] ?? true;
        }

        $user->update($payload);
        $user->load('role');

        $response = [
            'message' => 'User updated',
            'data' => $this->payload($user),
        ];

        if ($tempPassword) {
            $response['credentials'] = $this->credentialsPayload($user, $tempPassword);
        }

        return response()->json($response);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($request->user()->id === $user->id) {
            return response()->json(['message' => 'You cannot delete your own account.'], 422);
        }

        $email = $user->email;
        $id = $user->id;
        $user->tokens()->delete();
        $user->delete();

        Audit::log('user.delete', 'users', 'user', $id, "Deleted staff {$email}");

        return response()->json(['message' => 'Staff deleted']);
    }

    private function payload(User $user): array
    {
        return [
            'id' => $user->id,
            'staff_code' => $user->staff_code,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'is_active' => (bool) $user->is_active,
            'must_change_password' => (bool) $user->must_change_password,
            'role' => [
                'id' => $user->role?->id,
                'name' => $user->role?->name,
                'slug' => $user->role?->slug,
            ],
        ];
    }

    /** Plaintext password is returned only at create/regenerate time — never stored readable. */
    private function credentialsPayload(User $user, string $plainPassword): array
    {
        return [
            'name' => $user->name,
            'staff_code' => $user->staff_code,
            'email' => $user->email,
            'phone' => $user->phone,
            'temporary_password' => $plainPassword,
            'one_time' => true,
        ];
    }

    private function generateTempPassword(): string
    {
        return 'Jr@'.Str::upper(Str::random(4)).rand(10, 99);
    }

    private function nextStaffCode(string $roleSlug): string
    {
        $prefix = match ($roleSlug) {
            'doctor' => 'DOC',
            'nurse' => 'NUR',
            'receptionist' => 'REC',
            'gatekeeper' => 'GAT',
            'finance' => 'FIN',
            'pharmacist' => 'PHR',
            'inventory-manager' => 'INV',
            default => 'STF',
        };

        $n = User::query()->where('staff_code', 'like', $prefix.'-%')->count() + 1;

        return $prefix.'-'.str_pad((string) $n, 4, '0', STR_PAD_LEFT);
    }

    private function suggestEmail(string $name, string $roleSlug): string
    {
        $base = Str::slug($name, '.');
        if ($base === '') {
            $base = $roleSlug;
        }
        $email = $base.'@jadeed.local';
        $i = 1;
        while (User::query()->where('email', $email)->exists()) {
            $email = $base.$i.'@jadeed.local';
            $i++;
        }

        return $email;
    }
}
