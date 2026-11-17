<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medicines', function (Blueprint $table) {
            if (! Schema::hasColumn('medicines', 'category')) {
                $table->string('category', 60)->default('other')->after('generic_name')->index();
            }
        });

        // Best-effort seed for known sample medicines.
        $map = [
            'Paracetamol' => 'analgesics',
            'Diazepam' => 'anxiolytics',
            'ORS' => 'gastrointestinal',
            'Multivitamin' => 'vitamins',
            'Omeprazole' => 'gastrointestinal',
        ];
        foreach ($map as $name => $category) {
            DB::table('medicines')->where('name', $name)->update(['category' => $category]);
        }
    }

    public function down(): void
    {
        Schema::table('medicines', function (Blueprint $table) {
            if (Schema::hasColumn('medicines', 'category')) {
                $table->dropColumn('category');
            }
        });
    }
};
