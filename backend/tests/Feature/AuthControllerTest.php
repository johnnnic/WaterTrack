<?php
namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthControllerTest extends TestCase {
    use RefreshDatabase;

    private function makeUser(string $role = 'admin'): User {
        return User::create([
            'name'                => 'Test User',
            'email'               => 'test@test.com',
            'password'            => bcrypt('secret123'),
            'role'                => $role,
            'password_changed_at' => now(),
        ]);
    }

    public function test_login_success_returns_token_and_user(): void {
        $this->makeUser();

        $response = $this->postJson('/api/login', [
            'email'    => 'test@test.com',
            'password' => 'secret123',
        ]);

        $response->assertStatus(200)
                 ->assertJsonStructure(['access_token', 'token_type', 'user'])
                 ->assertJsonPath('user.email', 'test@test.com');
    }

    public function test_login_wrong_password_returns_401(): void {
        $this->makeUser();

        $response = $this->postJson('/api/login', [
            'email'    => 'test@test.com',
            'password' => 'wrongpassword',
        ]);

        $response->assertStatus(401)
                 ->assertJson(['message' => 'Email atau password salah.']);
    }

    public function test_login_unknown_email_returns_401(): void {
        $response = $this->postJson('/api/login', [
            'email'    => 'nobody@test.com',
            'password' => 'anything',
        ]);

        $response->assertStatus(401);
    }

    public function test_change_password_success(): void {
        $user  = $this->makeUser();
        $token = $user->createToken('test')->plainTextToken;

        $response = $this->withToken($token)->putJson('/api/user/password', [
            'current_password'          => 'secret123',
            'new_password'              => 'newpassword99',
            'new_password_confirmation' => 'newpassword99',
        ]);

        $response->assertStatus(200)
                 ->assertJson(['message' => 'Password berhasil diubah.']);
    }

    public function test_change_password_wrong_current_returns_422(): void {
        $user  = $this->makeUser();
        $token = $user->createToken('test')->plainTextToken;

        $response = $this->withToken($token)->putJson('/api/user/password', [
            'current_password'          => 'wrongcurrent',
            'new_password'              => 'newpassword99',
            'new_password_confirmation' => 'newpassword99',
        ]);

        $response->assertStatus(422)
                 ->assertJson(['message' => 'Password saat ini salah.']);
    }

    public function test_change_password_same_as_old_returns_422(): void {
        $user  = $this->makeUser();
        $token = $user->createToken('test')->plainTextToken;

        $response = $this->withToken($token)->putJson('/api/user/password', [
            'current_password'          => 'secret123',
            'new_password'              => 'secret123',
            'new_password_confirmation' => 'secret123',
        ]);

        $response->assertStatus(422)
                 ->assertJson(['message' => 'Password baru tidak boleh sama dengan yang lama.']);
    }
}
