<?php
namespace Database\Seeders;
use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder {
    public function run(): void {
        User::create([
            'name' => 'Admin WaterTrack',
            'email' => 'admin@watertrack.id',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'password_changed_at' => now(),
        ]);
    }
}
