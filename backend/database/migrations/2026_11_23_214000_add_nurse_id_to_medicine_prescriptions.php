<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('medicine_prescriptions') && ! Schema::hasColumn('medicine_prescriptions', 'nurse_id')) {
            Schema::table('medicine_prescriptions', function (Blueprint $table) {
                $table->foreignId('nurse_id')->nullable()->after('doctor_id')->constrained('users')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('medicine_prescriptions') && Schema::hasColumn('medicine_prescriptions', 'nurse_id')) {
            Schema::table('medicine_prescriptions', function (Blueprint $table) {
                $table->dropConstrainedForeignId('nurse_id');
            });
        }
    }
};
