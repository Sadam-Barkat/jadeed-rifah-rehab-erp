<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            if (! Schema::hasColumn('payments', 'approval_status')) {
                $table->string('approval_status', 20)->default('pending')->after('proof_image_path')->index();
            }
            if (! Schema::hasColumn('payments', 'approved_by')) {
                $table->foreignId('approved_by')->nullable()->after('approval_status')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('payments', 'approved_at')) {
                $table->timestamp('approved_at')->nullable()->after('approved_by');
            }
            if (! Schema::hasColumn('payments', 'rejection_reason')) {
                $table->string('rejection_reason', 255)->nullable()->after('approved_at');
            }
            if (! Schema::hasColumn('payments', 'installment_no')) {
                $table->unsignedSmallInteger('installment_no')->nullable()->after('amount');
            }
        });

        // Existing payments (if any) treated as already approved.
        if (Schema::hasColumn('payments', 'approval_status')) {
            DB::table('payments')->whereNull('approved_at')->update([
                'approval_status' => 'approved',
                'approved_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            foreach (['rejection_reason', 'approved_at', 'approved_by', 'approval_status', 'installment_no'] as $col) {
                if (Schema::hasColumn('payments', $col)) {
                    if ($col === 'approved_by') {
                        $table->dropConstrainedForeignId('approved_by');
                    } else {
                        $table->dropColumn($col);
                    }
                }
            }
        });
    }
};
