<?php
namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Tariff;

class TariffSeeder extends Seeder
{
    public function run(): void
    {
        Tariff::create(['golongan' => 'Residental', 'harga_per_m3' => 5000]);
        Tariff::create(['golongan' => 'Kantor',     'harga_per_m3' => 8000]);
        Tariff::create(['golongan' => 'Pabrik',     'harga_per_m3' => 12000]);
    }
}
