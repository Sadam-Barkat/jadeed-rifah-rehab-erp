<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_items', function (Blueprint $table) {
            $table->id();
            $table->string('item_code', 30)->unique();
            $table->string('name')->index();
            $table->enum('category', ['kitchen', 'general', 'cleaning', 'medical_supply', 'other'])
                ->default('general')
                ->index();
            $table->string('unit', 30)->default('unit');
            $table->decimal('stock_qty', 12, 2)->default(0)->index();
            $table->decimal('reorder_level', 12, 2)->default(10);
            $table->decimal('unit_cost', 12, 2)->default(0);
            $table->enum('status', ['active', 'inactive'])->default('active')->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('inventory_movements', function (Blueprint $table) {
            $table->id();
            $table->string('movement_code', 30)->unique();
            $table->foreignId('inventory_item_id')->constrained('inventory_items')->restrictOnDelete();
            $table->enum('type', ['in', 'out', 'adjust'])->index();
            $table->decimal('quantity', 12, 2);
            $table->string('reference')->nullable();
            $table->text('notes')->nullable();
            $table->dateTime('moved_at')->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('inventory_item_id');
        });

        Schema::create('kitchen_menus', function (Blueprint $table) {
            $table->id();
            $table->string('menu_code', 30)->unique();
            $table->date('menu_date')->index();
            $table->enum('meal_type', ['breakfast', 'lunch', 'dinner', 'snack'])->index();
            $table->text('menu_items');
            $table->unsignedSmallInteger('portions')->nullable();
            $table->text('notes')->nullable();
            $table->enum('status', ['planned', 'served', 'cancelled'])->default('planned')->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['menu_date', 'meal_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('kitchen_menus');
        Schema::dropIfExists('inventory_movements');
        Schema::dropIfExists('inventory_items');
    }
};
