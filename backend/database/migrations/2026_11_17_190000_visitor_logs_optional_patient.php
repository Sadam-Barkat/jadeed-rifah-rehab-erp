<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('visitor_logs', function (Blueprint $table) {
            $table->dropForeign(['admission_id']);
            $table->dropForeign(['patient_id']);
        });

        DB::statement('ALTER TABLE visitor_logs MODIFY admission_id BIGINT UNSIGNED NULL');
        DB::statement('ALTER TABLE visitor_logs MODIFY patient_id BIGINT UNSIGNED NULL');

        Schema::table('visitor_logs', function (Blueprint $table) {
            $table->foreign('admission_id')->references('id')->on('admissions')->nullOnDelete();
            $table->foreign('patient_id')->references('id')->on('patients')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('visitor_logs', function (Blueprint $table) {
            $table->dropForeign(['admission_id']);
            $table->dropForeign(['patient_id']);
        });

        DB::statement('ALTER TABLE visitor_logs MODIFY admission_id BIGINT UNSIGNED NOT NULL');
        DB::statement('ALTER TABLE visitor_logs MODIFY patient_id BIGINT UNSIGNED NOT NULL');

        Schema::table('visitor_logs', function (Blueprint $table) {
            $table->foreign('admission_id')->references('id')->on('admissions')->cascadeOnDelete();
            $table->foreign('patient_id')->references('id')->on('patients')->restrictOnDelete();
        });
    }
};
