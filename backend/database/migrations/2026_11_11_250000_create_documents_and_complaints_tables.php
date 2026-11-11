<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->string('document_code', 30)->unique();
            $table->string('title')->index();
            $table->enum('category', [
                'patient',
                'staff',
                'legal',
                'clinical',
                'admin',
                'other',
            ])->default('admin')->index();
            $table->foreignId('patient_id')->nullable()->constrained('patients')->nullOnDelete();
            $table->string('file_path');
            $table->string('original_name');
            $table->string('mime_type', 100)->nullable();
            $table->unsignedInteger('file_size')->default(0);
            $table->text('description')->nullable();
            $table->enum('status', ['active', 'archived'])->default('active')->index();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('patient_id');
        });

        Schema::create('complaints', function (Blueprint $table) {
            $table->id();
            $table->string('complaint_code', 30)->unique();
            $table->enum('type', ['complaint', 'incident'])->default('complaint')->index();
            $table->string('title')->index();
            $table->text('description');
            $table->string('reported_by_name')->nullable();
            $table->string('reporter_phone', 30)->nullable();
            $table->foreignId('patient_id')->nullable()->constrained('patients')->nullOnDelete();
            $table->enum('severity', ['low', 'medium', 'high', 'critical'])->default('medium')->index();
            $table->enum('status', ['open', 'in_progress', 'resolved', 'closed'])->default('open')->index();
            $table->text('action_taken')->nullable();
            $table->dateTime('reported_at')->index();
            $table->dateTime('resolved_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('patient_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('complaints');
        Schema::dropIfExists('documents');
    }
};
