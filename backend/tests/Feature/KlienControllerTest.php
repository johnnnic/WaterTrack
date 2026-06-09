<?php
namespace Tests\Feature;

use App\Models\Bill;
use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class KlienControllerTest extends TestCase {
    use RefreshDatabase;

    private function makeKlien(): array {
        $c = Customer::create([
            'nomor_langganan' => 'ABC123', 'nama' => 'Klien Test',
            'alamat' => 'Jl. Test', 'status' => 'aktif',
            'tarif_per_m3' => 5000, 'meteran_terakhir' => 100,
            'tanggal_baca_terakhir' => now(),
        ]);
        $u = User::create([
            'name' => 'Klien', 'email' => 'k@k.com', 'password' => 'password',
            'role' => 'klien', 'customer_id' => $c->id, 'password_changed_at' => now(),
        ]);
        return ['customer' => $c, 'user' => $u, 'token' => $u->createToken('t')->plainTextToken];
    }

    private function makeBill(int $customerId, string $status = 'belum_bayar'): Bill {
        return Bill::create([
            'customer_id' => $customerId, 'periode' => '2026-06',
            'meteran_awal' => 100, 'meteran_akhir' => 120, 'pemakaian' => 20,
            'tarif_per_m3' => 5000, 'jumlah_tagihan' => 100000,
            'status' => $status, 'tanggal_jatuh_tempo' => '2026-06-30',
        ]);
    }

    public function test_request_payment_success(): void {
        ['customer' => $c, 'token' => $t] = $this->makeKlien();
        $bill = $this->makeBill($c->id);
        $this->withToken($t)->putJson("/api/klien/bills/{$bill->id}/request-payment", ['metode_pembayaran' => 'transfer'])
             ->assertStatus(200);
        $this->assertDatabaseHas('bills', ['id' => $bill->id, 'status' => 'menunggu_konfirmasi']);
    }

    public function test_already_pending_returns_422(): void {
        ['customer' => $c, 'token' => $t] = $this->makeKlien();
        $bill = $this->makeBill($c->id, 'menunggu_konfirmasi');
        $this->withToken($t)->putJson("/api/klien/bills/{$bill->id}/request-payment", ['metode_pembayaran' => 'tunai'])
             ->assertStatus(422)->assertJson(['message' => 'Permintaan pembayaran sudah diajukan.']);
    }

    public function test_cannot_access_other_customer_bill(): void {
        ['token' => $t] = $this->makeKlien();
        $other = Customer::create([
            'nomor_langganan' => 'ZZZ999', 'nama' => 'Other', 'alamat' => 'Jl. X',
            'status' => 'aktif', 'tarif_per_m3' => 5000, 'meteran_terakhir' => 50,
            'tanggal_baca_terakhir' => now(),
        ]);
        $bill = $this->makeBill($other->id);
        $this->withToken($t)->putJson("/api/klien/bills/{$bill->id}/request-payment", ['metode_pembayaran' => 'tunai'])
             ->assertStatus(404);
    }
}
