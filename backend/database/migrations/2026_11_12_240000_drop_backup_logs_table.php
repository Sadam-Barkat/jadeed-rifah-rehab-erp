<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Backup logging UI removed from Settings; table unused in lean app.
        Schema::dropIfExists('backup_logs');
    }

    public function down(): void
    {
        // Intentionally empty — recreate from original settings migration if needed.
    }
};
