<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('facility_bills', function (Blueprint $table) {
            $table->id();
            $table->string('bill_code', 30)->unique();
            $table->date('bill_date')->index();
            $table->string('bill_type', 40)->index();
            $table->decimal('amount', 12, 2)->default(0);
            $table->enum('payment_method', ['cash', 'bank', 'jazzcash', 'easypaisa', 'other'])->default('bank');
            $table->string('reference', 150)->nullable();
            $table->text('notes')->nullable();
            $table->enum('status', ['posted', 'void'])->default('posted')->index();
            $table->string('void_reason', 255)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['bill_date', 'status']);
            $table->index(['bill_type', 'bill_date']);
            $table->index(['created_by', 'bill_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('facility_bills');
    }
};
