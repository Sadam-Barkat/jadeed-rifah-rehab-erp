<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('medicines', function (Blueprint $table) {
            $table->id();
            $table->string('medicine_code', 30)->unique();
            $table->string('name')->index();
            $table->string('generic_name')->nullable();
            $table->string('form', 50)->nullable();
            $table->string('strength', 50)->nullable();
            $table->string('unit', 30)->default('unit');
            $table->unsignedInteger('stock_qty')->default(0)->index();
            $table->unsignedInteger('reorder_level')->default(10);
            $table->decimal('unit_price', 12, 2)->default(0);
            $table->enum('status', ['active', 'inactive'])->default('active')->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('medicine_dispenses', function (Blueprint $table) {
            $table->id();
            $table->string('dispense_code', 30)->unique();
            $table->foreignId('admission_id')->constrained('admissions')->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained('patients')->restrictOnDelete();
            $table->foreignId('medicine_id')->constrained('medicines')->restrictOnDelete();
            $table->unsignedInteger('quantity');
            $table->string('dosage')->nullable();
            $table->string('frequency')->nullable();
            $table->text('notes')->nullable();
            $table->dateTime('dispensed_at')->index();
            $table->enum('status', ['dispensed', 'cancelled'])->default('dispensed')->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('admission_id');
            $table->index('patient_id');
            $table->index('medicine_id');
        });

        Schema::create('lab_orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_code', 30)->unique();
            $table->foreignId('admission_id')->constrained('admissions')->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained('patients')->restrictOnDelete();
            $table->string('test_name')->index();
            $table->dateTime('ordered_at')->index();
            $table->enum('status', ['pending', 'sample_collected', 'completed', 'cancelled'])
                ->default('pending')
                ->index();
            $table->text('result_summary')->nullable();
            $table->dateTime('result_at')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('admission_id');
            $table->index('patient_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lab_orders');
        Schema::dropIfExists('medicine_dispenses');
        Schema::dropIfExists('medicines');
    }
};
