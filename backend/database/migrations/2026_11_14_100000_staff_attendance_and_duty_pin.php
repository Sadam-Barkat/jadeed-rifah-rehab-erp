<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('staff_attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->date('attendance_date')->index();
            $table->dateTime('check_in_at');
            $table->dateTime('check_out_at')->nullable();
            $table->enum('status', ['present', 'checked_out'])->default('present')->index();
            $table->string('notes', 255)->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'attendance_date']);
            $table->index(['attendance_date', 'status']);
        });

        Schema::table('facility_settings', function (Blueprint $table) {
            if (! Schema::hasColumn('facility_settings', 'duty_pin')) {
                $table->string('duty_pin', 12)->default('2468')->after('session_timeout_minutes');
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('staff_attendances');

        Schema::table('facility_settings', function (Blueprint $table) {
            if (Schema::hasColumn('facility_settings', 'duty_pin')) {
                $table->dropColumn('duty_pin');
            }
        });
    }
};
