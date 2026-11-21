<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_items', function (Blueprint $table) {
            $table->boolean('track_reorder')->default(false)->after('reorder_level');
        });

        Schema::table('inventory_movements', function (Blueprint $table) {
            $table->decimal('unit_cost', 12, 2)->nullable()->after('unit');
        });

        DB::table('inventory_items')
            ->whereIn('category', ['kitchen', 'cleaning', 'linen', 'medical_supply'])
            ->update(['track_reorder' => true]);
    }

    public function down(): void
    {
        Schema::table('inventory_movements', function (Blueprint $table) {
            $table->dropColumn('unit_cost');
        });

        Schema::table('inventory_items', function (Blueprint $table) {
            $table->dropColumn('track_reorder');
        });
    }
};
