<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE beds MODIFY COLUMN status ENUM('available','occupied','cleaning','maintenance','discarded') NOT NULL DEFAULT 'available'");
    }

    public function down(): void
    {
        DB::table('beds')->where('status', 'discarded')->update(['status' => 'maintenance']);
        DB::statement("ALTER TABLE beds MODIFY COLUMN status ENUM('available','occupied','cleaning','maintenance') NOT NULL DEFAULT 'available'");
    }
};
