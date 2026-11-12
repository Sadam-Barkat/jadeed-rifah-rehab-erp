<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_items', function (Blueprint $table) {
            $table->string('bill_image_path')->nullable()->after('unit_cost');
            $table->string('supplier', 150)->nullable()->after('bill_image_path');
        });

        // Widen category beyond original enum (medicines stay in Pharmacy, not here).
        DB::statement("ALTER TABLE inventory_items MODIFY COLUMN category VARCHAR(40) NOT NULL DEFAULT 'general'");

        Schema::table('inventory_movements', function (Blueprint $table) {
            $table->string('bill_image_path')->nullable()->after('reference');
        });
    }

    public function down(): void
    {
        Schema::table('inventory_movements', function (Blueprint $table) {
            $table->dropColumn('bill_image_path');
        });

        Schema::table('inventory_items', function (Blueprint $table) {
            $table->dropColumn(['bill_image_path', 'supplier']);
        });

        DB::statement("ALTER TABLE inventory_items MODIFY COLUMN category ENUM('kitchen','general','cleaning','medical_supply','other') NOT NULL DEFAULT 'general'");
    }
};
