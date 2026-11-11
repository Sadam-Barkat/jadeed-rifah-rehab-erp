<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payroll_runs', function (Blueprint $table) {
            $table->id();
            $table->string('run_code', 30)->unique();
            $table->unsignedSmallInteger('year')->index();
            $table->unsignedTinyInteger('month')->index();
            $table->enum('status', ['draft', 'finalized'])->default('draft')->index();
            $table->dateTime('generated_at');
            $table->dateTime('finalized_at')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['year', 'month']);
        });

        Schema::create('payroll_items', function (Blueprint $table) {
            $table->id();
            $table->string('slip_code', 30)->unique();
            $table->foreignId('payroll_run_id')->constrained('payroll_runs')->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('employees')->restrictOnDelete();
            $table->decimal('basic_salary', 12, 2);
            $table->unsignedTinyInteger('working_days')->default(30);
            $table->decimal('days_present', 5, 1)->default(0);
            $table->decimal('days_absent', 5, 1)->default(0);
            $table->decimal('days_leave', 5, 1)->default(0);
            $table->decimal('days_late', 5, 1)->default(0);
            $table->decimal('days_half', 5, 1)->default(0);
            $table->decimal('payable_days', 5, 1)->default(0);
            $table->decimal('allowances', 12, 2)->default(0);
            $table->decimal('deductions', 12, 2)->default(0);
            $table->decimal('gross_salary', 12, 2)->default(0);
            $table->decimal('net_salary', 12, 2)->default(0);
            $table->enum('status', ['generated', 'paid', 'void'])->default('generated')->index();
            $table->dateTime('paid_at')->nullable();
            $table->string('payment_method', 30)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['payroll_run_id', 'employee_id']);
            $table->index('employee_id');
            $table->index('payroll_run_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_items');
        Schema::dropIfExists('payroll_runs');
    }
};
