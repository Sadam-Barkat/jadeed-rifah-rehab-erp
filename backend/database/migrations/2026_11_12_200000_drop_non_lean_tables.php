<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('doctors', function (Blueprint $table) {
            if (Schema::hasColumn('doctors', 'employee_id')) {
                $table->dropConstrainedForeignId('employee_id');
            }
        });

        Schema::dropIfExists('canteen_sale_items');
        Schema::dropIfExists('canteen_sales');
        Schema::dropIfExists('canteen_products');
        Schema::dropIfExists('purchase_order_items');
        Schema::dropIfExists('purchase_orders');
        Schema::dropIfExists('suppliers');

        Schema::dropIfExists('asset_maintenances');
        Schema::dropIfExists('assets');

        Schema::dropIfExists('payroll_items');
        Schema::dropIfExists('payroll_runs');
        Schema::dropIfExists('attendances');
        Schema::dropIfExists('employees');

        Schema::dropIfExists('documents');
        Schema::dropIfExists('complaints');
        Schema::dropIfExists('app_notifications');
        Schema::dropIfExists('staff_tasks');
        Schema::dropIfExists('management_notes');
        Schema::dropIfExists('psychology_sessions');

        Schema::dropIfExists('compliance_checks');
        Schema::dropIfExists('compliance_items');

        Schema::dropIfExists('security_shifts');
        Schema::dropIfExists('security_incidents');
        Schema::dropIfExists('security_cameras');
    }

    public function down(): void
    {
        // Non-lean modules removed permanently; recreate via original migrations if needed.
    }
};
