<?php
namespace Tests\Feature\Admin;

use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserControllerTest extends TestCase {
    use RefreshDatabase;

    private function adminToken(): string {
        $a = User::create(['name' => 'Admin', 'email' => 'a@a.com',
            'password' => bcrypt('p'), 'role' => 'admin', 'password_changed_at' => now()]);
        return $a->createToken('t')->plainTextToken;
    }

    public function test_store_klien_creates_user_and_customer(): void {
        $r = $this->withToken($this->adminToken())->postJson('/api/admin/users', [
            'name' => 'Budi', 'email' => 'budi@mail.com', 'password' => 'secret123',
            'role' => 'klien', 'alamat' => 'Jl. A', 'tarif_per_m3' => 5000, 'meteran_awal' => 100,
        ]);
        $r->assertStatus(201);
        $this->assertDatabaseHas('users', ['email' => 'budi@mail.com', 'role' => 'klien']);
        $this->assertDatabaseCount('customers', 1);
        $this->assertNull(User::where('email', 'budi@mail.com')->first()->password_changed_at);
    }

    public function test_store_klien_missing_fields_returns_422(): void {
        $r = $this->withToken($this->adminToken())->postJson('/api/admin/users', [
            'name' => 'X', 'email' => 'x@mail.com', 'password' => 'secret123', 'role' => 'klien',
        ]);
        $r->assertStatus(422);
        $this->assertDatabaseMissing('users', ['email' => 'x@mail.com']);
        $this->assertDatabaseCount('customers', 0);
    }

    public function test_destroy_cannot_delete_self(): void {
        $admin = User::create(['name' => 'A', 'email' => 'self@a.com',
            'password' => bcrypt('p'), 'role' => 'admin', 'password_changed_at' => now()]);
        $this->withToken($admin->createToken('t')->plainTextToken)
             ->deleteJson('/api/admin/users/' . $admin->id)->assertStatus(422);
    }
}
