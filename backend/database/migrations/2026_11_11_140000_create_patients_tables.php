<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('patients', function (Blueprint $table) {
            $table->id();
            $table->string('patient_code', 30)->unique();
            $table->string('first_name');
            $table->string('last_name')->nullable();
            $table->string('father_name')->nullable();
            $table->string('cnic', 20)->nullable()->index();
            $table->enum('gender', ['male', 'female', 'other'])->nullable()->index();
            $table->date('date_of_birth')->nullable();
            $table->unsignedSmallInteger('age')->nullable();
            $table->string('phone', 30)->nullable()->index();
            $table->string('email')->nullable();
            $table->string('address')->nullable();
            $table->string('city')->nullable();
            $table->string('blood_group', 10)->nullable();
            $table->string('marital_status', 30)->nullable();
            $table->string('referral_source')->nullable();
            $table->string('photo_path')->nullable();
            $table->enum('status', ['registered', 'admitted', 'discharged', 'archived'])
                ->default('registered')
                ->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['first_name', 'last_name']);
            $table->index('created_at');
        });

        Schema::create('patient_guardians', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained('patients')->cascadeOnDelete();
            $table->string('name');
            $table->string('relation')->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('cnic', 20)->nullable();
            $table->string('address')->nullable();
            $table->boolean('is_primary')->default(true);
            $table->boolean('is_emergency')->default(true);
            $table->timestamps();

            $table->index('patient_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('patient_guardians');
        Schema::dropIfExists('patients');
    }
};
