<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('staff_tasks', function (Blueprint $table) {
            $table->id();
            $table->string('task_code', 30)->unique();
            $table->string('title')->index();
            $table->text('description')->nullable();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('priority', ['low', 'medium', 'high'])->default('medium')->index();
            $table->enum('status', ['pending', 'in_progress', 'completed', 'cancelled'])->default('pending')->index();
            $table->date('due_date')->nullable()->index();
            $table->dateTime('completed_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('assigned_to');
        });

        Schema::create('management_notes', function (Blueprint $table) {
            $table->id();
            $table->string('note_code', 30)->unique();
            $table->string('title')->index();
            $table->text('body');
            $table->enum('category', ['policy', 'announcement', 'operational', 'other'])
                ->default('operational')
                ->index();
            $table->enum('status', ['active', 'archived'])->default('active')->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('management_notes');
        Schema::dropIfExists('staff_tasks');
    }
};
