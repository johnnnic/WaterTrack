<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Bill extends Model
{
    protected $fillable = [
        'customer_id',
        'periode',
        'meteran_awal',
        'meteran_akhir',
        'pemakaian',
        'tarif_per_m3',
        'jumlah_tagihan',
        'status',
        'tanggal_jatuh_tempo',
        'requested_metode_pembayaran'
    ];

    protected $casts = [
        'tanggal_jatuh_tempo' => 'date',
        'tarif_per_m3' => 'decimal:2',
        'jumlah_tagihan' => 'decimal:2'
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function isPaid(): bool
    {
        return $this->status === 'sudah_bayar';
    }

    public function isPending(): bool {
        return $this->status === 'menunggu_konfirmasi';
    }
}
