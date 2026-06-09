<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Tariff extends Model
{
    protected $fillable = [
        'golongan',
        'harga_per_m3',
    ];

    public function customers(): HasMany
    {
        return $this->hasMany(\App\Models\Customer::class);
    }
}
