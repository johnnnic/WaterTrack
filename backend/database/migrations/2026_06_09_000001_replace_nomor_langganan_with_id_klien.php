<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Step 1: Drop customer_id dari users
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['customer_id']);
            $table->dropColumn('customer_id');
        });

        // Step 2: Ubah customers - hapus nomor_langganan, tambah id_klien
        Schema::table('customers', function (Blueprint $table) {
            $table->dropUnique(['nomor_langganan']);
            $table->dropColumn('nomor_langganan');
            $table->unsignedBigInteger('id_klien')->unique()->after('id');
            $table->foreign('id_klien')->references('id')->on('users')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropForeign(['id_klien']);
            $table->dropColumn('id_klien');
            $table->string('nomor_langganan')->unique()->after('id');
        });
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedBigInteger('customer_id')->nullable()->unique()->after('role');
        });
    }
};
