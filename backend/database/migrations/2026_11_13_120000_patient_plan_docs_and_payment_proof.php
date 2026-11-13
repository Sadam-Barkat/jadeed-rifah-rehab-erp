<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            if (! Schema::hasColumn('patients', 'plan_days')) {
                $table->unsignedSmallInteger('plan_days')->nullable()->after('referral_source');
            }
            if (! Schema::hasColumn('patients', 'cnic_front_path')) {
                $table->string('cnic_front_path')->nullable()->after('photo_path');
            }
            if (! Schema::hasColumn('patients', 'cnic_back_path')) {
                $table->string('cnic_back_path')->nullable()->after('cnic_front_path');
            }
        });

        DB::statement("ALTER TABLE patients MODIFY COLUMN status ENUM('registered','admitted','discharge_requested','discharged','archived') NOT NULL DEFAULT 'registered'");

        Schema::table('payments', function (Blueprint $table) {
            if (! Schema::hasColumn('payments', 'proof_image_path')) {
                $table->string('proof_image_path')->nullable()->after('notes');
            }
        });
    }

    public function down(): void
    {
        DB::table('patients')->where('status', 'discharge_requested')->update(['status' => 'admitted']);
        DB::statement("ALTER TABLE patients MODIFY COLUMN status ENUM('registered','admitted','discharged','archived') NOT NULL DEFAULT 'registered'");

        Schema::table('patients', function (Blueprint $table) {
            foreach (['plan_days', 'cnic_front_path', 'cnic_back_path'] as $col) {
                if (Schema::hasColumn('patients', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        Schema::table('payments', function (Blueprint $table) {
            if (Schema::hasColumn('payments', 'proof_image_path')) {
                $table->dropColumn('proof_image_path');
            }
        });
    }
};
