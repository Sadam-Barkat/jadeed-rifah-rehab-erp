<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fee_plans', function (Blueprint $table) {
            $table->id();
            $table->string('plan_code', 30)->unique();
            $table->foreignId('admission_id')->constrained('admissions')->restrictOnDelete();
            $table->foreignId('patient_id')->constrained('patients')->restrictOnDelete();
            $table->foreignId('fee_package_id')->nullable()->constrained('fee_packages')->nullOnDelete();
            $table->string('package_name');
            $table->unsignedSmallInteger('program_days');
            $table->decimal('amount', 12, 2);
            $table->decimal('discount', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2);
            $table->unsignedTinyInteger('installment_count');
            $table->json('installment_amounts')->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending')->index();
            $table->text('notes')->nullable();
            $table->string('rejection_reason')->nullable();
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('reviewed_at')->nullable();
            $table->timestamps();

            $table->index('admission_id');
            $table->index('patient_id');
            $table->index(['status', 'created_at']);
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->foreignId('fee_plan_id')->nullable()->after('fee_package_id')->constrained('fee_plans')->nullOnDelete();
            $table->unsignedTinyInteger('installment_no')->default(1)->after('installment_count');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropConstrainedForeignId('fee_plan_id');
            $table->dropColumn('installment_no');
        });
        Schema::dropIfExists('fee_plans');
    }
};
