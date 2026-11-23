<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('medicine_prescriptions') && ! Schema::hasColumn('medicine_prescriptions', 'slip_printed_at')) {
            Schema::table('medicine_prescriptions', function (Blueprint $table) {
                $table->dateTime('slip_printed_at')->nullable()->after('dispensed_at');
            });
        }

        if (! Schema::hasTable('medicine_prescription_items')) {
            return;
        }

        Schema::table('medicine_prescription_items', function (Blueprint $table) {
            if (! Schema::hasColumn('medicine_prescription_items', 'medicine_name')) {
                $table->string('medicine_name')->nullable()->after('medicine_id');
            }
            if (! Schema::hasColumn('medicine_prescription_items', 'instructions')) {
                $table->string('instructions', 255)->nullable()->after('frequency');
            }
            if (! Schema::hasColumn('medicine_prescription_items', 'dispensed_qty')) {
                $table->unsignedInteger('dispensed_qty')->nullable()->after('instructions');
            }
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('medicine_prescriptions') && Schema::hasColumn('medicine_prescriptions', 'slip_printed_at')) {
            Schema::table('medicine_prescriptions', function (Blueprint $table) {
                $table->dropColumn('slip_printed_at');
            });
        }

        if (! Schema::hasTable('medicine_prescription_items')) {
            return;
        }

        Schema::table('medicine_prescription_items', function (Blueprint $table) {
            $drop = [];
            foreach (['medicine_name', 'instructions', 'dispensed_qty'] as $col) {
                if (Schema::hasColumn('medicine_prescription_items', $col)) {
                    $drop[] = $col;
                }
            }
            if ($drop) {
                $table->dropColumn($drop);
            }
        });
    }
};
