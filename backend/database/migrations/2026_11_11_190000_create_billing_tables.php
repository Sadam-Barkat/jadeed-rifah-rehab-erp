<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fee_packages', function (Blueprint $table) {
            $table->id();
            $table->string('name')->index();
            $table->unsignedSmallInteger('program_days')->index();
            $table->decimal('amount', 12, 2);
            $table->string('description')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active')->index();
            $table->timestamps();
        });

        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->string('invoice_code', 30)->unique();
            $table->foreignId('admission_id')->constrained('admissions')->restrictOnDelete();
            $table->foreignId('patient_id')->constrained('patients')->restrictOnDelete();
            $table->foreignId('fee_package_id')->nullable()->constrained('fee_packages')->nullOnDelete();
            $table->string('package_name');
            $table->unsignedSmallInteger('program_days');
            $table->decimal('amount', 12, 2);
            $table->decimal('discount', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2);
            $table->decimal('paid_amount', 12, 2)->default(0);
            $table->decimal('balance', 12, 2);
            $table->enum('status', ['unpaid', 'partial', 'paid', 'void'])->default('unpaid')->index();
            $table->dateTime('issued_at')->index();
            $table->date('due_date')->nullable()->index();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('admission_id');
            $table->index('patient_id');
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->string('payment_code', 30)->unique();
            $table->foreignId('invoice_id')->constrained('invoices')->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained('patients')->restrictOnDelete();
            $table->decimal('amount', 12, 2);
            $table->enum('method', ['cash', 'bank', 'jazzcash', 'easypaisa', 'other'])->default('cash')->index();
            $table->dateTime('paid_at')->index();
            $table->string('reference')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('invoice_id');
            $table->index('patient_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('fee_packages');
    }
};
