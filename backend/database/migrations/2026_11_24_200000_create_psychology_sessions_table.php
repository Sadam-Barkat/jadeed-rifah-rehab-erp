<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('psychology_sessions')) {
            return;
        }

        Schema::create('psychology_sessions', function (Blueprint $table) {
            $table->id();
            $table->string('session_code', 30)->unique();
            $table->foreignId('admission_id')->constrained('admissions')->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained('patients')->restrictOnDelete();
            $table->dateTime('session_at')->index();
            $table->enum('session_type', ['individual', 'group', 'family', 'assessment'])
                ->default('individual')
                ->index();
            $table->unsignedSmallInteger('duration_minutes')->nullable();
            $table->string('mood_before')->nullable();
            $table->string('mood_after')->nullable();
            $table->text('topics')->nullable();
            $table->text('observations')->nullable();
            $table->text('homework')->nullable();
            $table->date('next_session_date')->nullable()->index();
            $table->enum('status', ['scheduled', 'completed', 'cancelled'])->default('completed')->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('admission_id');
            $table->index('patient_id');
            $table->index('created_by');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('psychology_sessions');
    }
};
