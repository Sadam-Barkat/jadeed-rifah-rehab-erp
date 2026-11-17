<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('petty_expenses', function (Blueprint $table) {
            $table->id();
            $table->string('expense_code', 30)->unique();
            $table->date('expense_date')->index();
            $table->string('title', 150);
            $table->decimal('amount', 12, 2);
            $table->string('spent_for', 150)->index();
            $table->string('reason', 255);
            $table->enum('payment_method', ['cash', 'bank', 'jazzcash', 'easypaisa', 'other'])->default('cash');
            $table->text('notes')->nullable();
            $table->enum('status', ['posted', 'void'])->default('posted')->index();
            $table->string('void_reason', 255)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['expense_date', 'status']);
            $table->index(['created_by', 'expense_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('petty_expenses');
    }
};
