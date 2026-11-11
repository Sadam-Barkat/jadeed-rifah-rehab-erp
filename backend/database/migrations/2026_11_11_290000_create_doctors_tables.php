<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('doctors', function (Blueprint $table) {
            $table->id();
            $table->string('doctor_code', 32)->unique();
            $table->string('full_name');
            $table->string('specialization')->nullable();
            $table->string('license_no', 64)->nullable()->index();
            $table->string('phone', 32)->nullable();
            $table->string('email')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active')->index();
            $table->foreignId('employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('doctor_rounds', function (Blueprint $table) {
            $table->id();
            $table->string('round_code', 32)->unique();
            $table->foreignId('doctor_id')->constrained('doctors')->cascadeOnDelete();
            $table->foreignId('admission_id')->constrained('admissions')->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained('patients')->cascadeOnDelete();
            $table->dateTime('round_at')->index();
            $table->enum('round_type', ['morning', 'evening', 'emergency', 'follow_up'])
                ->default('morning')
                ->index();
            $table->string('vitals_summary')->nullable();
            $table->text('findings')->nullable();
            $table->text('orders')->nullable();
            $table->dateTime('next_review_at')->nullable()->index();
            $table->enum('status', ['scheduled', 'completed', 'cancelled'])->default('completed')->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['doctor_id', 'round_at']);
            $table->index(['admission_id', 'round_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('doctor_rounds');
        Schema::dropIfExists('doctors');
    }
};
