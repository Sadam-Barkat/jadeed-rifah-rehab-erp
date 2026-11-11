<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assets', function (Blueprint $table) {
            $table->id();
            $table->string('asset_code', 30)->unique();
            $table->string('name')->index();
            $table->enum('category', [
                'furniture',
                'equipment',
                'vehicle',
                'electronics',
                'other',
            ])->default('equipment')->index();
            $table->string('location')->nullable()->index();
            $table->date('purchase_date')->nullable()->index();
            $table->decimal('purchase_cost', 12, 2)->default(0);
            $table->decimal('current_value', 12, 2)->nullable();
            $table->enum('condition', ['good', 'fair', 'poor'])->default('good')->index();
            $table->enum('status', ['active', 'under_maintenance', 'retired'])->default('active')->index();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('asset_maintenances', function (Blueprint $table) {
            $table->id();
            $table->string('maintenance_code', 30)->unique();
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnDelete();
            $table->dateTime('maintained_at')->index();
            $table->string('issue');
            $table->text('work_done')->nullable();
            $table->decimal('cost', 12, 2)->default(0);
            $table->enum('status', ['open', 'completed'])->default('open')->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('asset_id');
        });

        Schema::create('account_entries', function (Blueprint $table) {
            $table->id();
            $table->string('entry_code', 30)->unique();
            $table->date('entry_date')->index();
            $table->enum('type', ['income', 'expense'])->index();
            $table->string('category')->index();
            $table->decimal('amount', 12, 2);
            $table->enum('payment_method', ['cash', 'bank', 'jazzcash', 'easypaisa', 'other'])->default('cash');
            $table->string('reference')->nullable();
            $table->text('description')->nullable();
            $table->enum('status', ['posted', 'void'])->default('posted')->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('account_entries');
        Schema::dropIfExists('asset_maintenances');
        Schema::dropIfExists('assets');
    }
};
