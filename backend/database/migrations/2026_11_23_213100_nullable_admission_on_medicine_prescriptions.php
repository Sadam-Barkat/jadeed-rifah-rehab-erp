<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('medicine_prescriptions')) {
            return;
        }

        $admission = collect(DB::select('SHOW COLUMNS FROM medicine_prescriptions WHERE Field = ?', ['admission_id']))->first();
        if ($admission && strtoupper((string) ($admission->Null ?? '')) !== 'YES') {
            Schema::table('medicine_prescriptions', function (Blueprint $table) {
                $table->dropForeign(['admission_id']);
            });
            Schema::table('medicine_prescriptions', function (Blueprint $table) {
                $table->unsignedBigInteger('admission_id')->nullable()->change();
                $table->foreign('admission_id')->references('id')->on('admissions')->nullOnDelete();
            });
        }

        $patient = collect(DB::select('SHOW COLUMNS FROM medicine_prescriptions WHERE Field = ?', ['patient_id']))->first();
        if ($patient && strtoupper((string) ($patient->Null ?? '')) !== 'YES') {
            Schema::table('medicine_prescriptions', function (Blueprint $table) {
                $table->dropForeign(['patient_id']);
            });
            Schema::table('medicine_prescriptions', function (Blueprint $table) {
                $table->unsignedBigInteger('patient_id')->nullable()->change();
                $table->foreign('patient_id')->references('id')->on('patients')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        // Keep nullable for handwritten prescriptions.
    }
};
