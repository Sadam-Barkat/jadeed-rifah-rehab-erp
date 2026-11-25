<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('psychology_sessions')) {
            Schema::table('psychology_sessions', function (Blueprint $table) {
                $table->dropUnique(['session_code']);
            });
            Schema::table('psychology_sessions', function (Blueprint $table) {
                $table->index('session_code');
            });
        }

        if (Schema::hasTable('maulana_sessions')) {
            Schema::table('maulana_sessions', function (Blueprint $table) {
                $table->dropUnique(['session_code']);
            });
            Schema::table('maulana_sessions', function (Blueprint $table) {
                $table->index('session_code');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('psychology_sessions')) {
            Schema::table('psychology_sessions', function (Blueprint $table) {
                $table->dropIndex(['session_code']);
            });
            Schema::table('psychology_sessions', function (Blueprint $table) {
                $table->unique('session_code');
            });
        }

        if (Schema::hasTable('maulana_sessions')) {
            Schema::table('maulana_sessions', function (Blueprint $table) {
                $table->dropIndex(['session_code']);
            });
            Schema::table('maulana_sessions', function (Blueprint $table) {
                $table->unique('session_code');
            });
        }
    }
};
