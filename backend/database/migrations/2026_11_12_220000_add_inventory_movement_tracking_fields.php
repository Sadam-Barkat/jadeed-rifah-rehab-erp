<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_movements', function (Blueprint $table) {
            $table->string('purpose', 40)->nullable()->after('type')->index();
            $table->string('department', 40)->nullable()->after('purpose')->index();
            $table->string('issued_to', 120)->nullable()->after('department')->index();
            $table->string('used_for', 255)->nullable()->after('issued_to');
            $table->string('unit', 30)->nullable()->after('quantity');
        });
    }

    public function down(): void
    {
        Schema::table('inventory_movements', function (Blueprint $table) {
            $table->dropColumn(['purpose', 'department', 'issued_to', 'used_for', 'unit']);
        });
    }
};
