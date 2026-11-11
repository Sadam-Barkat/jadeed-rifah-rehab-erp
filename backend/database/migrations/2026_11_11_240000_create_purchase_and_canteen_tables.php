<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();
            $table->string('supplier_code', 30)->unique();
            $table->string('name')->index();
            $table->string('contact_person')->nullable();
            $table->string('phone', 30)->nullable()->index();
            $table->string('email')->nullable();
            $table->string('address')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active')->index();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('purchase_orders', function (Blueprint $table) {
            $table->id();
            $table->string('po_code', 30)->unique();
            $table->foreignId('supplier_id')->constrained('suppliers')->restrictOnDelete();
            $table->dateTime('ordered_at')->index();
            $table->dateTime('received_at')->nullable();
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->enum('status', ['ordered', 'received', 'cancelled'])->default('ordered')->index();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('supplier_id');
        });

        Schema::create('purchase_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_order_id')->constrained('purchase_orders')->cascadeOnDelete();
            $table->foreignId('inventory_item_id')->nullable()->constrained('inventory_items')->nullOnDelete();
            $table->string('item_name');
            $table->string('unit', 30)->default('unit');
            $table->decimal('quantity', 12, 2);
            $table->decimal('unit_price', 12, 2)->default(0);
            $table->decimal('line_total', 12, 2)->default(0);
            $table->timestamps();

            $table->index('purchase_order_id');
            $table->index('inventory_item_id');
        });

        Schema::create('canteen_products', function (Blueprint $table) {
            $table->id();
            $table->string('product_code', 30)->unique();
            $table->string('name')->index();
            $table->decimal('unit_price', 12, 2)->default(0);
            $table->unsignedInteger('stock_qty')->default(0)->index();
            $table->enum('status', ['active', 'inactive'])->default('active')->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('canteen_sales', function (Blueprint $table) {
            $table->id();
            $table->string('sale_code', 30)->unique();
            $table->dateTime('sold_at')->index();
            $table->string('customer_name')->nullable();
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->enum('payment_method', ['cash', 'account', 'other'])->default('cash')->index();
            $table->enum('status', ['completed', 'cancelled'])->default('completed')->index();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('canteen_sale_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('canteen_sale_id')->constrained('canteen_sales')->cascadeOnDelete();
            $table->foreignId('canteen_product_id')->constrained('canteen_products')->restrictOnDelete();
            $table->unsignedInteger('quantity');
            $table->decimal('unit_price', 12, 2);
            $table->decimal('line_total', 12, 2);
            $table->timestamps();

            $table->index('canteen_sale_id');
            $table->index('canteen_product_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('canteen_sale_items');
        Schema::dropIfExists('canteen_sales');
        Schema::dropIfExists('canteen_products');
        Schema::dropIfExists('purchase_order_items');
        Schema::dropIfExists('purchase_orders');
        Schema::dropIfExists('suppliers');
    }
};
