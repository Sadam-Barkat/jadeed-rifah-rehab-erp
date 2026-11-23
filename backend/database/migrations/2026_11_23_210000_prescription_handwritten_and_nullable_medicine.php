<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('medicine_prescriptions') && ! Schema::hasColumn('medicine_prescriptions', 'handwritten_image_path')) {
            Schema::table('medicine_prescriptions', function (Blueprint $table) {
                $table->string('handwritten_image_path')->nullable()->after('notes');
            });
        }

        if (! Schema::hasTable('medicine_prescription_items')) {
            return;
        }

        // Allow free-text doctor lines without a catalog medicine yet.
        Schema::table('medicine_prescription_items', function (Blueprint $table) {
            if (! Schema::hasColumn('medicine_prescription_items', 'medicine_name')) {
                $table->string('medicine_name')->nullable()->after('medicine_id');
            }
        });

        // Drop FK then make nullable (MySQL).
        try {
            Schema::table('medicine_prescription_items', function (Blueprint $table) {
                $table->dropForeign(['medicine_id']);
            });
        } catch (\Throwable) {
            // Already dropped or named differently.
        }

        Schema::table('medicine_prescription_items', function (Blueprint $table) {
            $table->unsignedBigInteger('medicine_id')->nullable()->change();
        });

        Schema::table('medicine_prescription_items', function (Blueprint $table) {
            $table->foreign('medicine_id')->references('id')->on('medicines')->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('medicine_prescriptions') && Schema::hasColumn('medicine_prescriptions', 'handwritten_image_path')) {
            Schema::table('medicine_prescriptions', function (Blueprint $table) {
                $table->dropColumn('handwritten_image_path');
            });
        }
    }
};
