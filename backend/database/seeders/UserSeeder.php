<?php
namespace Database\Seeders;

use App\Models\Customer;
use App\Models\Tariff;
use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder {
    public function run(): void {
        User::create([
            'name'                => 'Admin WaterTrack',
            'email'               => 'admin@watertrack.id',
            'password'            => 'password',
            'role'                => 'admin',
            'password_changed_at' => now(),
        ]);

        User::create([
            'name'                => 'Operator WaterTrack',
            'email'               => 'operator@watertrack.id',
            'password'            => 'password',
            'role'                => 'operator',
            'password_changed_at' => now(),
        ]);

        User::create([
            'name'                => 'Kasir WaterTrack',
            'email'               => 'kasir@watertrack.id',
            'password'            => 'password',
            'role'                => 'kasir',
            'password_changed_at' => now(),
        ]);

        $tariffResidental = Tariff::where('golongan', 'Residental')->firstOrFail();
        $tariffKantor     = Tariff::where('golongan', 'Kantor')->firstOrFail();

        $klien1 = User::create([
            'name'     => 'Budi Santoso',
            'email'    => 'budi@example.com',
            'password' => 'password',
            'role'     => 'klien',
            // password_changed_at = null → forced change on first login
        ]);
        Customer::create([
            'id_klien'              => $klien1->id,
            'nama'                  => 'Budi Santoso',
            'alamat'                => 'Jl. Merdeka No. 10, Jakarta',
            'telepon'               => '081234567890',
            'status'                => 'aktif',
            'tariff_id'             => $tariffResidental->id,
            'tarif_per_m3'          => $tariffResidental->harga_per_m3,
            'meteran_terakhir'      => 120,
            'tanggal_baca_terakhir' => now()->subMonth(),
        ]);

        $klien2 = User::create([
            'name'     => 'Siti Rahayu',
            'email'    => 'siti@example.com',
            'password' => 'password',
            'role'     => 'klien',
        ]);
        Customer::create([
            'id_klien'              => $klien2->id,
            'nama'                  => 'Siti Rahayu',
            'alamat'                => 'Jl. Sudirman No. 25, Bandung',
            'telepon'               => '087654321099',
            'status'                => 'aktif',
            'tariff_id'             => $tariffKantor->id,
            'tarif_per_m3'          => $tariffKantor->harga_per_m3,
            'meteran_terakhir'      => 85,
            'tanggal_baca_terakhir' => now()->subMonth(),
        ]);
    }
}
