<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rooms', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code', 30)->unique();
            $table->string('floor', 30)->nullable();
            $table->string('room_type', 50)->nullable();
            $table->enum('status', ['active', 'maintenance', 'inactive'])->default('active')->index();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('beds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->constrained('rooms')->cascadeOnDelete();
            $table->string('bed_code', 30)->unique();
            $table->enum('status', ['available', 'occupied', 'cleaning', 'maintenance'])
                ->default('available')
                ->index();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('room_id');
        });

        Schema::create('admissions', function (Blueprint $table) {
            $table->id();
            $table->string('admission_code', 30)->unique();
            $table->foreignId('patient_id')->constrained('patients')->restrictOnDelete();
            $table->foreignId('bed_id')->nullable()->constrained('beds')->nullOnDelete();
            $table->dateTime('admitted_at');
            $table->unsignedSmallInteger('program_days')->nullable()->index();
            $table->string('package_name')->nullable();
            $table->enum('status', ['pending', 'active', 'cancelled', 'discharged'])
                ->default('pending')
                ->index();
            $table->text('clinical_notes')->nullable();
            $table->text('belongings_notes')->nullable();
            $table->text('consent_notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('patient_id');
            $table->index('bed_id');
            $table->index('admitted_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admissions');
        Schema::dropIfExists('beds');
        Schema::dropIfExists('rooms');
    }
};
