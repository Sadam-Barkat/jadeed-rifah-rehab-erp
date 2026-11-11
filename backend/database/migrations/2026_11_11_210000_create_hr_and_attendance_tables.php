<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employees', function (Blueprint $table) {
            $table->id();
            $table->string('employee_code', 30)->unique();
            $table->string('full_name')->index();
            $table->string('father_name')->nullable();
            $table->string('cnic', 20)->nullable()->index();
            $table->string('phone', 30)->nullable()->index();
            $table->string('email')->nullable();
            $table->string('department')->nullable()->index();
            $table->string('designation')->nullable()->index();
            $table->date('join_date')->nullable()->index();
            $table->enum('employment_type', ['full_time', 'part_time', 'contract'])->default('full_time');
            $table->decimal('basic_salary', 12, 2)->default(0);
            $table->enum('status', ['active', 'resigned', 'terminated'])->default('active')->index();
            $table->string('address')->nullable();
            $table->string('emergency_contact')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->date('attendance_date')->index();
            $table->enum('status', ['present', 'absent', 'leave', 'late', 'half_day'])->default('present')->index();
            $table->time('check_in')->nullable();
            $table->time('check_out')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('marked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['employee_id', 'attendance_date']);
            $table->index('employee_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendances');
        Schema::dropIfExists('employees');
    }
};
