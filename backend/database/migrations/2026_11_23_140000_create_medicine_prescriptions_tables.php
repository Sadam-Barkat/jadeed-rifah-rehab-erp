<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('medicine_prescriptions')) {
            Schema::create('medicine_prescriptions', function (Blueprint $table) {
                $table->id();
                $table->string('prescription_code', 30)->unique();
                $table->foreignId('admission_id')->constrained('admissions')->cascadeOnDelete();
                $table->foreignId('patient_id')->constrained('patients')->restrictOnDelete();
                $table->enum('status', ['pending', 'dispensed', 'cancelled'])->default('pending')->index();
                $table->text('notes')->nullable();
                $table->foreignId('prescribed_by')->constrained('users')->restrictOnDelete();
                $table->foreignId('dispensed_by')->nullable()->constrained('users')->nullOnDelete();
                $table->dateTime('prescribed_at')->index();
                $table->dateTime('dispensed_at')->nullable()->index();
                $table->dateTime('slip_printed_at')->nullable();
                $table->timestamps();

                $table->index('admission_id');
                $table->index('patient_id');
            });
        }

        if (! Schema::hasTable('medicine_prescription_items')) {
            Schema::create('medicine_prescription_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('medicine_prescription_id')->constrained('medicine_prescriptions')->cascadeOnDelete();
                $table->foreignId('medicine_id')->constrained('medicines')->restrictOnDelete();
                $table->string('medicine_name');
                $table->unsignedInteger('quantity');
                $table->string('dosage', 100)->nullable();
                $table->string('frequency', 100)->nullable();
                $table->string('instructions', 255)->nullable();
                $table->unsignedInteger('dispensed_qty')->nullable();
                $table->timestamps();

                $table->index('medicine_prescription_id');
                $table->index('medicine_id');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('medicine_prescription_items');
        Schema::dropIfExists('medicine_prescriptions');
    }
};
