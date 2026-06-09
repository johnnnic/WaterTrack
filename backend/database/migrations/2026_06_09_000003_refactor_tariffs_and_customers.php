<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tariffs', function (Blueprint $table) {
            $table->dropColumn('daya_listrik');
        });

        Schema::table('customers', function (Blueprint $table) {
            $table->unsignedBigInteger('tariff_id')->nullable()->after('id');
            $table->foreign('tariff_id')->references('id')->on('tariffs')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropForeign(['tariff_id']);
            $table->dropColumn('tariff_id');
        });

        Schema::table('tariffs', function (Blueprint $table) {
            $table->string('daya_listrik')->nullable()->after('golongan');
        });
    }
};
