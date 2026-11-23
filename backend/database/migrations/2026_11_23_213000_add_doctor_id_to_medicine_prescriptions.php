<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('medicine_prescriptions') && ! Schema::hasColumn('medicine_prescriptions', 'doctor_id')) {
            Schema::table('medicine_prescriptions', function (Blueprint $table) {
                $table->foreignId('doctor_id')->nullable()->after('patient_id')->constrained('doctors')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('medicine_prescriptions') && Schema::hasColumn('medicine_prescriptions', 'doctor_id')) {
            Schema::table('medicine_prescriptions', function (Blueprint $table) {
                $table->dropConstrainedForeignId('doctor_id');
            });
        }
    }
};
