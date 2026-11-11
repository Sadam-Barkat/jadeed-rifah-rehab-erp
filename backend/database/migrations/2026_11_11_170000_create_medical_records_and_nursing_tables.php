<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('medical_records', function (Blueprint $table) {
            $table->id();
            $table->string('record_code', 30)->unique();
            $table->foreignId('admission_id')->constrained('admissions')->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained('patients')->restrictOnDelete();
            $table->dateTime('recorded_at')->index();
            $table->enum('record_type', [
                'consultation',
                'diagnosis',
                'progress',
                'prescription_note',
                'other',
            ])->default('consultation')->index();
            $table->string('chief_complaint')->nullable();
            $table->text('diagnosis')->nullable();
            $table->text('clinical_findings')->nullable();
            $table->text('treatment_advice')->nullable();
            $table->text('medications_prescribed')->nullable();
            $table->enum('status', ['active', 'amended'])->default('active')->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('admission_id');
            $table->index('patient_id');
        });

        Schema::create('nursing_notes', function (Blueprint $table) {
            $table->id();
            $table->string('note_code', 30)->unique();
            $table->foreignId('admission_id')->constrained('admissions')->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained('patients')->restrictOnDelete();
            $table->dateTime('recorded_at')->index();
            $table->enum('shift', ['morning', 'evening', 'night'])->default('morning')->index();
            $table->decimal('temperature', 4, 1)->nullable();
            $table->unsignedSmallInteger('pulse')->nullable();
            $table->unsignedSmallInteger('bp_systolic')->nullable();
            $table->unsignedSmallInteger('bp_diastolic')->nullable();
            $table->unsignedTinyInteger('spo2')->nullable();
            $table->decimal('weight_kg', 5, 2)->nullable();
            $table->string('mood')->nullable();
            $table->string('sleep_quality')->nullable();
            $table->string('appetite')->nullable();
            $table->text('observations')->nullable();
            $table->text('interventions')->nullable();
            $table->enum('status', ['recorded', 'flagged'])->default('recorded')->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('admission_id');
            $table->index('patient_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('nursing_notes');
        Schema::dropIfExists('medical_records');
    }
};
