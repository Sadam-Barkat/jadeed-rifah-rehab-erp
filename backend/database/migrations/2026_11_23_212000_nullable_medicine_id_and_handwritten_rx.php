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

        $column = collect(DB::select('SHOW COLUMNS FROM medicine_prescription_items WHERE Field = ?', ['medicine_id']))->first();
        if ($column && strtoupper((string) ($column->Null ?? '')) !== 'YES') {
            Schema::table('medicine_prescription_items', function (Blueprint $table) {
                $table->dropForeign(['medicine_id']);
            });
            Schema::table('medicine_prescription_items', function (Blueprint $table) {
                $table->unsignedBigInteger('medicine_id')->nullable()->change();
                $table->foreign('medicine_id')->references('id')->on('medicines')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        // Keep nullable medicine_id; do not force data loss.
    }
};
