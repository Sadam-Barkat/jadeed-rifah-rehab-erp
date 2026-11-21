<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patient_guardians', function (Blueprint $table) {
            if (! Schema::hasColumn('patient_guardians', 'cnic_front_path')) {
                $table->string('cnic_front_path')->nullable()->after('cnic');
            }
            if (! Schema::hasColumn('patient_guardians', 'cnic_back_path')) {
                $table->string('cnic_back_path')->nullable()->after('cnic_front_path');
            }
        });
    }

    public function down(): void
    {
        Schema::table('patient_guardians', function (Blueprint $table) {
            foreach (['cnic_back_path', 'cnic_front_path'] as $col) {
                if (Schema::hasColumn('patient_guardians', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
