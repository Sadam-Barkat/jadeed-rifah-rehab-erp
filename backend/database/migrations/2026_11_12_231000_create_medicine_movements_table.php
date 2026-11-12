<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medicines', function (Blueprint $table) {
            $table->string('manufacturer', 150)->nullable()->after('unit');
        });

        Schema::create('medicine_movements', function (Blueprint $table) {
            $table->id();
            $table->string('movement_code', 30)->unique();
            $table->foreignId('medicine_id')->constrained('medicines')->restrictOnDelete();
            $table->enum('type', ['in', 'out', 'adjust'])->index();
            $table->unsignedInteger('quantity');
            $table->string('batch_no', 80)->nullable();
            $table->date('expiry_date')->nullable()->index();
            $table->string('supplier', 150)->nullable();
            $table->decimal('unit_cost', 12, 2)->nullable();
            $table->string('reference', 150)->nullable();
            $table->text('notes')->nullable();
            $table->dateTime('moved_at')->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('medicine_id');
            $table->index('created_by');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('medicine_movements');

        Schema::table('medicines', function (Blueprint $table) {
            $table->dropColumn('manufacturer');
        });
    }
};
