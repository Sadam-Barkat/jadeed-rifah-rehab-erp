<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use App\Support\AttendanceOnlyStaff;
use App\Support\Audit;
use App\Support\PkPhone;
use App\Support\SecureUpload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    /** Roles Admin can assign when creating staff (not Admin itself). */
    private const STAFF_ROLE_SLUGS = [
        'receptionist',
        'gatekeeper',
        'consultant-psychiatrist',
        'medical-officer',
        'nurse',
        'finance',
        'dispenser',
        'inventory-manager',
        'cook',
        'clinical-psychologist',
        'maulana',
        'security-guard',
        'cleaner',
    ];

    public function roles(): JsonResponse
    {
        $order = array_flip(self::STAFF_ROLE_SLUGS);
        $roles = Role::query()
            ->whereIn('slug', self::STAFF_ROLE_SLUGS)
            ->get(['id', 'name', 'slug', 'modules'])
            ->sortBy(fn (Role $r) => $order[$r->slug] ?? 999)
            ->values();

        return response()->json([
            'data' => $roles->map(fn (Role $r) => [
                'id' => $r->id,
                'name' => $r->name,
                'slug' => $r->slug,
                'modules' => $r->modules ?? [],
                'attendance_only' => AttendanceOnlyStaff::is($r->slug),
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
            'father_name' => ['nullable', 'string', 'max:150'],
            'email' => ['required', 'email', 'max:150', 'unique:users,email'],
            'phone' => ['required', 'string', 'max:20'],
            'cnic' => ['nullable', 'string', 'max:15'],
            'gender' => ['nullable', 'string', 'max:20'],
            'date_of_birth' => ['nullable', 'date'],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'qualification' => ['nullable', 'string', 'max:150'],
            'joined_on' => ['nullable', 'date'],
            'photo' => SecureUpload::imageRules(false),
            'password' => ['nullable', 'string', 'min:8'],
            'role_id' => ['required', 'exists:roles,id'],
            'is_active' => ['nullable', 'boolean'],
            'generate_password' => ['nullable', 'boolean'],
        ], array_merge(SecureUpload::maxMessages([
            'photo' => 'Photo',
        ]), [
            'photo.mimes' => 'Photo must be a JPG, PNG, or WEBP image.',
        ]));

        $role = Role::query()->findOrFail($data['role_id']);
        if (! in_array($role->slug, self::STAFF_ROLE_SLUGS, true)) {
            return response()->json(['message' => 'Invalid staff role.'], 422);
        }

        $phone = PkPhone::normalize($data['phone'] ?? null);
        if ($phone === false || $phone === null) {
            return response()->json(['message' => 'Phone must start with 03 or +92.'], 422);
        }
        $cnic = $this->normalizeCnic($data['cnic'] ?? null);
        if ($cnic === false) {
            return response()->json(['message' => 'CNIC must be 13 digits.'], 422);
        }

        $attendanceOnly = AttendanceOnlyStaff::is($role->slug);
        $tempPassword = $data['password'] ?? null;
        $auto = $request->boolean('generate_password', true) || empty($tempPassword);
        if ($auto) {
            $tempPassword = $this->generateTempPassword();
        }

        $photoPath = null;
        if ($request->hasFile('photo')) {
            $photoPath = SecureUpload::storeImage($request->file('photo'), 'staff-photos', 'staff_');
        }

        $user = User::query()->create([
            'staff_code' => $this->nextStaffCode($role->slug),
            'attendance_code' => $this->nextAttendanceCode(),
            'name' => $data['name'],
            'father_name' => $data['father_name'] ?? null,
            'email' => $data['email'],
            'phone' => $phone,
            'cnic' => $cnic,
            'gender' => $data['gender'] ?? null,
            'date_of_birth' => $data['date_of_birth'] ?? null,
            'address' => $data['address'] ?? null,
            'city' => $data['city'] ?? null,
            'qualification' => $data['qualification'] ?? null,
            'joined_on' => $data['joined_on'] ?? now()->toDateString(),
            'photo_path' => $photoPath,
            'password' => $tempPassword, // cast: hashed at rest; plaintext returned once only
            'role_id' => $role->id,
            'is_active' => array_key_exists('is_active', $data) ? (bool) $data['is_active'] : true,
            'must_change_password' => ! $attendanceOnly,
        ])->load('role');

        Audit::log('user.create', 'users', 'user', $user->id, "Created staff {$user->email}");

        return response()->json([
            'message' => $attendanceOnly ? 'Attendance staff created' : 'Staff created',
            'data' => $this->payload($user),
            'credentials' => $this->credentialsPayload($user, $attendanceOnly ? null : $tempPassword),
        ], 201);
    }

    public function show(User $user): JsonResponse
    {
        $user->loadMissing('role');
        if (! in_array($user->role?->slug, self::STAFF_ROLE_SLUGS, true)) {
            return response()->json(['message' => 'Staff not found.'], 404);
        }

        return response()->json(['data' => $this->payload($user)]);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:150'],
            'father_name' => ['nullable', 'string', 'max:150'],
            'email' => ['sometimes', 'required', 'email', 'max:150', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => ['sometimes', 'required', 'string', 'max:20'],
            'cnic' => ['nullable', 'string', 'max:15'],
            'gender' => ['nullable', 'string', 'max:20'],
            'date_of_birth' => ['nullable', 'date'],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'qualification' => ['nullable', 'string', 'max:150'],
            'joined_on' => ['nullable', 'date'],
            'photo' => SecureUpload::imageRules(false),
            'password' => ['nullable', 'string', 'min:8'],
            'role_id' => ['sometimes', 'required', 'exists:roles,id'],
            'is_active' => ['nullable', 'boolean'],
            'must_change_password' => ['nullable', 'boolean'],
            'reset_password' => ['nullable', 'boolean'],
        ], array_merge(SecureUpload::maxMessages([
            'photo' => 'Photo',
        ]), [
            'photo.mimes' => 'Photo must be a JPG, PNG, or WEBP image.',
        ]));

        if ($request->user()->id === $user->id && $request->has('is_active') && ! $request->boolean('is_active')) {
            return response()->json(['message' => 'You cannot deactivate your own account.'], 422);
        }

        if (array_key_exists('role_id', $data)) {
            $role = Role::query()->findOrFail($data['role_id']);
            if (! in_array($role->slug, self::STAFF_ROLE_SLUGS, true)) {
                return response()->json(['message' => 'Invalid staff role.'], 422);
            }
        }

        $tempPassword = null;
        if ($request->boolean('reset_password') && AttendanceOnlyStaff::is($user->role?->slug)) {
            return response()->json(['message' => 'This staff record is for attendance only. No app login.'], 422);
        }

        if ($request->boolean('reset_password')) {
            $tempPassword = $this->generateTempPassword();
            $data['password'] = $tempPassword;
            $data['must_change_password'] = true;
            if (! $user->attendance_code) {
                $data['attendance_code'] = $this->nextAttendanceCode();
            }
        }

        $payload = collect($data)->except(['password', 'reset_password', 'photo'])->all();
        if ($request->has('is_active')) {
            $payload['is_active'] = $request->boolean('is_active');
        }
        if (array_key_exists('phone', $payload)) {
            $phone = PkPhone::normalize($payload['phone'] ?? null);
            if ($phone === false || $phone === null) {
                return response()->json(['message' => 'Phone must start with 03 or +92.'], 422);
            }
            $payload['phone'] = $phone;
        }
        if (array_key_exists('cnic', $payload)) {
            $cnic = $this->normalizeCnic($payload['cnic'] ?? null);
            if ($cnic === false) {
                return response()->json(['message' => 'CNIC must be 13 digits.'], 422);
            }
            $payload['cnic'] = $cnic;
        }
        if (! empty($data['password'])) {
            $payload['password'] = $data['password'];
            $payload['must_change_password'] = $data['must_change_password'] ?? true;
        }

        if ($request->hasFile('photo')) {
            if ($user->photo_path && Storage::disk('public')->exists($user->photo_path)) {
                Storage::disk('public')->delete($user->photo_path);
            }
            $payload['photo_path'] = SecureUpload::storeImage($request->file('photo'), 'staff-photos', 'staff_');
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
        $joined = $user->joined_on ?: $user->created_at?->toDateString();

        return [
            'id' => $user->id,
            'staff_code' => $user->staff_code,
            'attendance_code' => $user->attendance_code,
            'name' => $user->name,
            'father_name' => $user->father_name,
            'email' => $user->email,
            'phone' => $user->phone,
            'cnic' => $user->cnic,
            'gender' => $user->gender,
            'date_of_birth' => $user->date_of_birth?->toDateString(),
            'address' => $user->address,
            'city' => $user->city,
            'qualification' => $user->qualification,
            'is_active' => (bool) $user->is_active,
            'must_change_password' => (bool) $user->must_change_password,
            'joined_at' => $joined,
            'joined_at_label' => $joined ? \Carbon\Carbon::parse($joined)->format('d M Y') : null,
            'photo_url' => SecureUpload::url($user->photo_path),
            'role' => [
                'id' => $user->role?->id,
                'name' => $user->role?->name,
                'slug' => $user->role?->slug,
            ],
            'attendance_only' => AttendanceOnlyStaff::is($user->role?->slug),
        ];
    }

    /** Plaintext password is returned only at create/regenerate time — never stored readable. */
    private function credentialsPayload(User $user, ?string $plainPassword): array
    {
        $attendanceOnly = AttendanceOnlyStaff::is($user->role?->slug);

        return [
            'name' => $user->name,
            'staff_code' => $user->staff_code,
            'attendance_code' => $user->attendance_code,
            'email' => $user->email,
            'phone' => $user->phone,
            'temporary_password' => $attendanceOnly ? null : $plainPassword,
            'attendance_only' => $attendanceOnly,
            'one_time' => true,
        ];
    }

    private function generateTempPassword(): string
    {
        return 'Jr@'.Str::upper(Str::random(4)).rand(10, 99);
    }

    /** @return string|null|false null = empty, false = invalid, string = #####-#######-# */
    private function normalizeCnic(mixed $value): string|false|null
    {
        $raw = trim((string) $value);
        if ($raw === '') {
            return null;
        }
        $digits = preg_replace('/\D+/', '', $raw);
        if (strlen($digits) !== 13) {
            return false;
        }

        return substr($digits, 0, 5).'-'.substr($digits, 5, 7).'-'.substr($digits, 12, 1);
    }

    private function nextAttendanceCode(): string
    {
        for ($i = 0; $i < 40; $i++) {
            $code = str_pad((string) random_int(1000, 9999), 4, '0', STR_PAD_LEFT);
            if (! User::query()->where('attendance_code', $code)->exists()) {
                return $code;
            }
        }

        throw new \RuntimeException('Could not allocate attendance code');
    }

    private function nextStaffCode(string $roleSlug): string
    {
        $prefix = match ($roleSlug) {
            'consultant-psychiatrist' => 'CPS',
            'medical-officer' => 'MO',
            'doctor' => 'DOC',
            'nurse' => 'NUR',
            'receptionist' => 'REC',
            'gatekeeper' => 'GAT',
            'finance' => 'FIN',
            'dispenser' => 'DSP',
            'inventory-manager' => 'INV',
            'cook' => 'COK',
            'clinical-psychologist' => 'CPM',
            'maulana' => 'MAU',
            'security-guard' => 'SEC',
            'cleaner' => 'CLN',
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
