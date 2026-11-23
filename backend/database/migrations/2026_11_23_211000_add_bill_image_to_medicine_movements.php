<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('medicine_movements') && ! Schema::hasColumn('medicine_movements', 'bill_image_path')) {
            Schema::table('medicine_movements', function (Blueprint $table) {
                $table->string('bill_image_path')->nullable()->after('reference');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('medicine_movements') && Schema::hasColumn('medicine_movements', 'bill_image_path')) {
            Schema::table('medicine_movements', function (Blueprint $table) {
                $table->dropColumn('bill_image_path');
            });
        }
    }
};
