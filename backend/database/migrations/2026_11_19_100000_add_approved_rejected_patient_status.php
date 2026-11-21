<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE patients MODIFY COLUMN status ENUM('registered','approved','rejected','admitted','discharge_requested','discharged','archived') NOT NULL DEFAULT 'registered'");
    }

    public function down(): void
    {
        DB::table('patients')->whereIn('status', ['approved', 'rejected'])->update(['status' => 'registered']);
        DB::statement("ALTER TABLE patients MODIFY COLUMN status ENUM('registered','admitted','discharge_requested','discharged','archived') NOT NULL DEFAULT 'registered'");
    }
};
