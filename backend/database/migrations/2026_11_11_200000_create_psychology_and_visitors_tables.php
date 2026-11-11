<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
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
        });

        Schema::create('visitor_logs', function (Blueprint $table) {
            $table->id();
            $table->string('visit_code', 30)->unique();
            $table->foreignId('admission_id')->constrained('admissions')->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained('patients')->restrictOnDelete();
            $table->string('visitor_name');
            $table->string('relation')->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('cnic', 20)->nullable();
            $table->string('purpose')->nullable();
            $table->dateTime('check_in_at')->index();
            $table->dateTime('check_out_at')->nullable()->index();
            $table->text('items_brought')->nullable();
            $table->text('notes')->nullable();
            $table->enum('status', ['checked_in', 'checked_out', 'cancelled'])->default('checked_in')->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('admission_id');
            $table->index('patient_id');
            $table->index('visitor_name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('visitor_logs');
        Schema::dropIfExists('psychology_sessions');
    }
};
