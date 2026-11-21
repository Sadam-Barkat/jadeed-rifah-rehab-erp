<?php

use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $role = Role::query()->where('slug', 'inventory-manager')->first();
        if (! $role) {
            return;
        }

        $role->modules = array_values(array_filter(
            $role->modules ?? [],
            fn (string $module) => $module !== 'kitchen'
        ));
        $role->save();
    }

    public function down(): void
    {
        $role = Role::query()->where('slug', 'inventory-manager')->first();
        if (! $role) {
            return;
        }

        $role->modules = array_values(array_unique([
            ...($role->modules ?? []),
            'kitchen',
        ]));
        $role->save();
    }
};
