<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medicine_prescriptions', function (Blueprint $table) {
            if (! Schema::hasColumn('medicine_prescriptions', 'administered_by')) {
                $table->foreignId('administered_by')->nullable()->after('dispensed_by')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('medicine_prescriptions', 'administered_at')) {
                $table->timestamp('administered_at')->nullable()->after('dispensed_at')->index();
            }
        });

        // Expand status enum to include administered (MySQL).
        try {
            DB::statement("ALTER TABLE medicine_prescriptions MODIFY COLUMN status ENUM('pending','dispensed','administered','cancelled') NOT NULL DEFAULT 'pending'");
        } catch (\Throwable) {
            // SQLite / already updated
        }
    }

    public function down(): void
    {
        try {
            DB::statement("ALTER TABLE medicine_prescriptions MODIFY COLUMN status ENUM('pending','dispensed','cancelled') NOT NULL DEFAULT 'pending'");
        } catch (\Throwable) {
            // ignore
        }

        Schema::table('medicine_prescriptions', function (Blueprint $table) {
            if (Schema::hasColumn('medicine_prescriptions', 'administered_by')) {
                $table->dropConstrainedForeignId('administered_by');
            }
            if (Schema::hasColumn('medicine_prescriptions', 'administered_at')) {
                $table->dropColumn('administered_at');
            }
        });
    }
};
