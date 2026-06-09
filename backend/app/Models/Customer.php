<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends Model
{
    protected $fillable = [
        'id_klien',
        'tariff_id',
        'nama',
        'alamat',
        'telepon',
        'status',
        'tarif_per_m3',
        'meteran_terakhir',
        'tanggal_baca_terakhir'
    ];

    protected $casts = [
        'tanggal_baca_terakhir' => 'date',
        'tarif_per_m3' => 'decimal:2'
    ];

    public function bills(): HasMany
    {
        return $this->hasMany(Bill::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'id_klien');
    }

    public function tariff(): BelongsTo
    {
        return $this->belongsTo(\App\Models\Tariff::class);
    }

    public function getTagihanTerakhir()
    {
        return $this->bills()
            ->whereIn('status', ['belum_bayar', 'menunggu_konfirmasi'])
            ->orderBy('periode', 'desc')
            ->first();
    }
}
