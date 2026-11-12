<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('lab_orders');
    }

    public function down(): void
    {
        // Lab module removed from lean 8-role scope.
    }
};
