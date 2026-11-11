<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('facility_settings', function (Blueprint $table) {
            $table->id();
            $table->string('facility_name');
            $table->string('short_name', 64)->nullable();
            $table->string('phone', 32)->nullable();
            $table->string('email')->nullable();
            $table->string('address')->nullable();
            $table->string('city', 100)->nullable();
            $table->string('timezone', 64)->default('Asia/Karachi');
            $table->string('currency', 8)->default('PKR');
            $table->unsignedSmallInteger('session_timeout_minutes')->default(60);
            $table->text('notes')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('backup_logs', function (Blueprint $table) {
            $table->id();
            $table->string('backup_code', 32)->unique();
            $table->dateTime('backed_up_at')->index();
            $table->enum('method', ['manual', 'scheduled'])->default('manual')->index();
            $table->enum('status', ['success', 'failed'])->default('success')->index();
            $table->string('storage_note')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('backup_logs');
        Schema::dropIfExists('facility_settings');
    }
};
