<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            if (! Schema::hasColumn('invoices', 'installment_count')) {
                $table->unsignedTinyInteger('installment_count')->default(1)->after('total_amount');
            }
        });

        // Keep enum value for DB compatibility, but stop using it in app logic.
        DB::table('invoices')->where('status', 'partial')->update(['status' => 'unpaid']);
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            if (Schema::hasColumn('invoices', 'installment_count')) {
                $table->dropColumn('installment_count');
            }
        });
    }
};
