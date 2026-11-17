<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'attendance_code')) {
                $table->string('attendance_code', 4)->nullable()->unique()->after('staff_code');
            }
        });

        Schema::table('staff_attendances', function (Blueprint $table) {
            if (! Schema::hasColumn('staff_attendances', 'photo_path')) {
                $table->string('photo_path')->nullable()->after('check_in_at');
            }
            if (! Schema::hasColumn('staff_attendances', 'checked_in_by')) {
                $table->foreignId('checked_in_by')->nullable()->after('photo_path')->constrained('users')->nullOnDelete();
            }
        });

        $used = [];
        $users = DB::table('users')->whereNull('attendance_code')->orderBy('id')->get(['id']);
        foreach ($users as $u) {
            do {
                $code = str_pad((string) random_int(1000, 9999), 4, '0', STR_PAD_LEFT);
            } while (isset($used[$code]) || DB::table('users')->where('attendance_code', $code)->exists());
            $used[$code] = true;
            DB::table('users')->where('id', $u->id)->update(['attendance_code' => $code]);
        }
    }

    public function down(): void
    {
        Schema::table('staff_attendances', function (Blueprint $table) {
            if (Schema::hasColumn('staff_attendances', 'checked_in_by')) {
                $table->dropConstrainedForeignId('checked_in_by');
            }
            if (Schema::hasColumn('staff_attendances', 'photo_path')) {
                $table->dropColumn('photo_path');
            }
        });

        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'attendance_code')) {
                $table->dropColumn('attendance_code');
            }
        });
    }
};
