<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('compliance_items', function (Blueprint $table) {
            $table->id();
            $table->string('item_code', 32)->unique();
            $table->enum('framework', ['phc', 'msds', 'internal'])->default('phc')->index();
            $table->string('category', 100)->nullable()->index();
            $table->string('title');
            $table->text('description')->nullable();
            $table->enum('frequency', ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'as_needed'])
                ->default('monthly')
                ->index();
            $table->enum('status', ['active', 'archived'])->default('active')->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('compliance_checks', function (Blueprint $table) {
            $table->id();
            $table->string('check_code', 32)->unique();
            $table->foreignId('compliance_item_id')->constrained('compliance_items')->cascadeOnDelete();
            $table->date('checked_on')->index();
            $table->enum('result', ['pass', 'partial', 'fail', 'na'])->default('pass')->index();
            $table->string('evidence_note')->nullable();
            $table->text('action_required')->nullable();
            $table->date('next_due_on')->nullable()->index();
            $table->enum('status', ['open', 'closed'])->default('closed')->index();
            $table->foreignId('checked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['compliance_item_id', 'checked_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('compliance_checks');
        Schema::dropIfExists('compliance_items');
    }
};
