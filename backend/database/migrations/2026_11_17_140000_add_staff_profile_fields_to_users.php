<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'father_name')) {
                $table->string('father_name', 150)->nullable()->after('name');
            }
            if (! Schema::hasColumn('users', 'cnic')) {
                $table->string('cnic', 25)->nullable()->after('phone');
            }
            if (! Schema::hasColumn('users', 'gender')) {
                $table->string('gender', 20)->nullable()->after('cnic');
            }
            if (! Schema::hasColumn('users', 'date_of_birth')) {
                $table->date('date_of_birth')->nullable()->after('gender');
            }
            if (! Schema::hasColumn('users', 'address')) {
                $table->string('address', 255)->nullable()->after('date_of_birth');
            }
            if (! Schema::hasColumn('users', 'city')) {
                $table->string('city', 100)->nullable()->after('address');
            }
            if (! Schema::hasColumn('users', 'qualification')) {
                $table->string('qualification', 150)->nullable()->after('city');
            }
            if (! Schema::hasColumn('users', 'joined_on')) {
                $table->date('joined_on')->nullable()->after('qualification');
            }
            if (! Schema::hasColumn('users', 'photo_path')) {
                $table->string('photo_path')->nullable()->after('joined_on');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            foreach (['father_name', 'cnic', 'gender', 'date_of_birth', 'address', 'city', 'qualification', 'joined_on', 'photo_path'] as $col) {
                if (Schema::hasColumn('users', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
