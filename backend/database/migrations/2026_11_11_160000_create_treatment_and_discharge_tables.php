<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('treatment_plans', function (Blueprint $table) {
            $table->id();
            $table->string('plan_code', 30)->unique();
            $table->foreignId('admission_id')->constrained('admissions')->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained('patients')->restrictOnDelete();
            $table->unsignedSmallInteger('program_days')->index();
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->text('goals')->nullable();
            $table->text('daily_activities')->nullable();
            $table->text('progress_notes')->nullable();
            $table->text('aftercare_plan')->nullable();
            $table->enum('status', ['draft', 'active', 'completed', 'cancelled'])
                ->default('active')
                ->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('admission_id');
            $table->index('patient_id');
        });

        Schema::create('discharges', function (Blueprint $table) {
            $table->id();
            $table->string('discharge_code', 30)->unique();
            $table->foreignId('admission_id')->constrained('admissions')->restrictOnDelete();
            $table->foreignId('patient_id')->constrained('patients')->restrictOnDelete();
            $table->dateTime('discharged_at');
            $table->text('final_summary')->nullable();
            $table->text('aftercare_instructions')->nullable();
            $table->date('follow_up_date')->nullable()->index();
            $table->text('belongings_handover')->nullable();
            $table->text('family_handover')->nullable();
            $table->text('fee_clearance_notes')->nullable();
            $table->enum('status', ['completed', 'cancelled'])->default('completed')->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique('admission_id');
            $table->index('patient_id');
            $table->index('discharged_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('discharges');
        Schema::dropIfExists('treatment_plans');
    }
};
