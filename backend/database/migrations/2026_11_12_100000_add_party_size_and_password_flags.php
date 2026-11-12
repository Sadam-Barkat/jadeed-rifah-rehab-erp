<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('visitor_logs', function (Blueprint $table) {
            if (! Schema::hasColumn('visitor_logs', 'party_size')) {
                $table->unsignedTinyInteger('party_size')->default(1)->after('visitor_name');
            }
        });

        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'must_change_password')) {
                $table->boolean('must_change_password')->default(false)->after('is_active');
            }
            if (! Schema::hasColumn('users', 'staff_code')) {
                $table->string('staff_code', 32)->nullable()->unique()->after('id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('visitor_logs', function (Blueprint $table) {
            if (Schema::hasColumn('visitor_logs', 'party_size')) {
                $table->dropColumn('party_size');
            }
        });

        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'must_change_password')) {
                $table->dropColumn('must_change_password');
            }
            if (Schema::hasColumn('users', 'staff_code')) {
                $table->dropColumn('staff_code');
            }
        });
    }
};
