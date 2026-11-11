<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('security_cameras', function (Blueprint $table) {
            $table->id();
            $table->string('camera_code', 32)->unique();
            $table->string('location');
            $table->string('zone', 100)->nullable()->index();
            $table->enum('status', ['online', 'offline', 'maintenance'])->default('online')->index();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('security_incidents', function (Blueprint $table) {
            $table->id();
            $table->string('incident_code', 32)->unique();
            $table->dateTime('occurred_at')->index();
            $table->string('location')->nullable();
            $table->enum('severity', ['low', 'medium', 'high', 'critical'])->default('medium')->index();
            $table->string('title');
            $table->text('description')->nullable();
            $table->text('action_taken')->nullable();
            $table->enum('status', ['open', 'investigating', 'resolved', 'closed'])->default('open')->index();
            $table->foreignId('reported_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('security_shifts', function (Blueprint $table) {
            $table->id();
            $table->string('shift_code', 32)->unique();
            $table->date('shift_date')->index();
            $table->enum('shift', ['morning', 'evening', 'night'])->default('morning')->index();
            $table->string('guard_name');
            $table->time('check_in_at')->nullable();
            $table->time('check_out_at')->nullable();
            $table->text('notes')->nullable();
            $table->enum('status', ['on_duty', 'completed'])->default('on_duty')->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['shift_date', 'shift']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('security_shifts');
        Schema::dropIfExists('security_incidents');
        Schema::dropIfExists('security_cameras');
    }
};
