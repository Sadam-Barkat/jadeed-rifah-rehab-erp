<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('inventory_items')->update([
            'track_reorder' => true,
            'reorder_level' => 10,
        ]);
    }

    public function down(): void
    {
        DB::table('inventory_items')->update(['track_reorder' => false]);

        DB::table('inventory_items')
            ->whereIn('category', ['kitchen', 'cleaning', 'linen', 'medical_supply'])
            ->update(['track_reorder' => true]);
    }
};
