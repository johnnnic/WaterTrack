<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('bills', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained()->onDelete('cascade');
            $table->string('periode'); // Format: YYYY-MM (2024-01)
            $table->unsignedInteger('meteran_awal');
            $table->unsignedInteger('meteran_akhir');
            $table->unsignedInteger('pemakaian'); // meteran_akhir - meteran_awal
            $table->decimal('tarif_per_m3', 10, 2);
            $table->decimal('jumlah_tagihan', 10, 2);
            $table->enum('status', ['belum_bayar', 'menunggu_konfirmasi', 'sudah_bayar'])->default('belum_bayar');
            $table->string('requested_metode_pembayaran')->nullable();
            $table->date('tanggal_jatuh_tempo');
            $table->timestamps();
            
            $table->unique(['customer_id', 'periode']); // Satu customer satu periode
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('bills');
    }
};
