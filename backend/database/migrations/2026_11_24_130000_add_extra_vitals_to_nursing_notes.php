<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('nursing_notes', function (Blueprint $table) {
            $table->unsignedTinyInteger('respiratory_rate')->nullable()->after('spo2');
            $table->unsignedSmallInteger('blood_sugar_mg_dl')->nullable()->after('weight_kg');
            $table->unsignedTinyInteger('pain_score')->nullable()->after('blood_sugar_mg_dl');
        });
    }

    public function down(): void
    {
        Schema::table('nursing_notes', function (Blueprint $table) {
            $table->dropColumn(['respiratory_rate', 'blood_sugar_mg_dl', 'pain_score']);
        });
    }
};
