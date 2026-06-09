# WaterTrack Refactor Plan — Customer-Klien Unification

**Tanggal dibuat:** 2026-06-09  
**Status:** Ready to execute  
**Branch target:** `dev`

---

## Keputusan Arsitektur (sudah disepakati)

| # | Keputusan | Detail |
|---|-----------|--------|
| A | Customer wajib punya akun klien | Setiap `customers` record harus punya `users` record (role=klien). Tidak ada customer "offline". |
| B | Ganti `nomor_langganan` → `id_klien` | `customers.id_klien = users.id`. FK ada di tabel `customers`. User ID langsung dipakai sebagai identifer klien. |
| C | Meter reading: single + bulk | Operator bisa catat satu per satu ATAU bulk via CSV upload. |

---

## Perubahan Skema Database

### Before vs After

```
SEBELUMNYA:
  users: id, name, email, password, role, customer_id (FK→customers), password_changed_at, ...
  customers: id, nomor_langganan (UNIQUE), nama, alamat, telepon, status, tarif_per_m3, meteran_terakhir, ...

SESUDAH:
  users: id, name, email, password, role, password_changed_at, ...  [hapus customer_id]
  customers: id, id_klien (FK→users.id, UNIQUE, NOT NULL), nama, alamat, telepon, status, tarif_per_m3, meteran_terakhir, ...  [ganti nomor_langganan]
```

### Relasi baru

```
User (role=klien)
  ↑  [id_klien = users.id]
Customer
  ↓
Bill → Payment
```

- `User::customer()` → `hasOne(Customer::class, 'id_klien')`
- `Customer::user()` → `belongsTo(User::class, 'id_klien')`
- `bills.customer_id` → **tidak berubah**, tetap FK ke `customers.id`

### Lookup key change
| Sebelumnya | Sesudah |
|-----------|---------|
| Kasir input `nomor_langganan` → cari Customer | Kasir input `id_klien` (= users.id) → cari Customer |
| Operator input `nomor_pelanggan` → cari Customer | Operator input `id_klien` → cari Customer |
| Klien akses via `users.customer_id` | Klien akses via `Customer::where('id_klien', $user->id)` |

---

## Execution Waves

```
WAVE 1  ──────────────── [BLOCKING] ───────────────
  Task 1: Database + Models + Seeder
          Semua task lain bergantung pada ini.

WAVE 2  ──── [Parallel] ──────────────────────────
  Task 2A: OperatorController (full rewrite + bulk)
  Task 2B: KasirController (fix lookup + field names)
  Task 2C: UserController Admin + Operator (flip FK)
  Task 2D: CustomerController Admin (hapus create/import)
  Task 2E: KlienController (ganti customer_id → id_klien)
  Task 2F: Routes (tambah bulk endpoints, fix namespace)

WAVE 3  ──── [Parallel] ──────────────────────────
  Task 3A: Frontend — UsersPage
  Task 3B: Frontend — CustomersPage
  Task 3C: Frontend — CheckBillPage (kasir)
  Task 3D: Frontend — Operator (meter reading single+bulk)
  Task 3E: Frontend — MyProfilePage + MyBillsPage (klien)

WAVE 4  ──────────────── [Sequential] ─────────────
  Task 4: Update CLAUDE.md (backend + frontend) + seeder verification
```

---

## WAVE 1 — Task 1: Database + Models + Seeder

**File yang diubah:**
- `backend/database/migrations/` → buat 1 file baru
- `backend/app/Models/User.php`
- `backend/app/Models/Customer.php`
- `backend/database/seeders/UserSeeder.php`

### 1.1 Migration baru

Buat file: `backend/database/migrations/2026_06_09_000001_replace_nomor_langganan_with_id_klien.php`

```php
public function up(): void
{
    // Step 1: Drop customer_id dari users
    Schema::table('users', function (Blueprint $table) {
        $table->dropUnique(['customer_id']);
        $table->dropColumn('customer_id');
    });

    // Step 2: Ubah customers table
    Schema::table('customers', function (Blueprint $table) {
        $table->dropUnique(['nomor_langganan']);
        $table->dropColumn('nomor_langganan');
        // id_klien = users.id, UNIQUE, NOT NULL
        $table->unsignedBigInteger('id_klien')->unique()->after('id');
        $table->foreign('id_klien')->references('id')->on('users')->onDelete('cascade');
    });
}

public function down(): void
{
    Schema::table('customers', function (Blueprint $table) {
        $table->dropForeign(['id_klien']);
        $table->dropUnique(['id_klien']);
        $table->dropColumn('id_klien');
        $table->string('nomor_langganan')->unique()->after('id');
    });
    Schema::table('users', function (Blueprint $table) {
        $table->unsignedBigInteger('customer_id')->nullable()->unique()->after('role');
    });
}
```

> Dev: jalankan `php artisan migrate:fresh --seed` setelah semua Wave 1 selesai.

### 1.2 Model: `app/Models/Customer.php`

```php
protected $fillable = [
    'id_klien',  // ganti dari nomor_langganan
    'nama', 'alamat', 'telepon', 'status',
    'tarif_per_m3', 'meteran_terakhir', 'tanggal_baca_terakhir'
];

// Ganti hasOne(User) yang lama
public function user(): BelongsTo
{
    return $this->belongsTo(User::class, 'id_klien');
}
```

### 1.3 Model: `app/Models/User.php`

```php
protected $fillable = [
    'name', 'email', 'password', 'role', 'password_changed_at',
    // HAPUS: 'customer_id'
];

// Ganti belongsTo(Customer) yang lama
public function customer(): HasOne
{
    return $this->hasOne(Customer::class, 'id_klien');
}
```

### 1.4 Seeder: `database/seeders/UserSeeder.php`

Tambahkan sample data untuk testing:
- 1 operator (tanpa customer), 1 kasir (tanpa customer)
- 2 klien dengan customer data masing-masing

Urutan penting: buat `User` dulu → baru buat `Customer` dengan `id_klien = $user->id`.

```php
// Klien 1
$klien1 = User::create([
    'name' => 'Budi Santoso',
    'email' => 'budi@example.com',
    'password' => 'password',
    'role' => 'klien',
    // password_changed_at = null → forced change on first login
]);
Customer::create([
    'id_klien'         => $klien1->id,
    'nama'             => 'Budi Santoso',
    'alamat'           => 'Jl. Contoh No. 1',
    'telepon'          => '081234567890',
    'status'           => 'aktif',
    'tarif_per_m3'     => 5000,
    'meteran_terakhir' => 100,
]);
```

---

## WAVE 2A — Task 2A: OperatorController (Full Rewrite)

**File yang dibuat:** `backend/app/Http/Controllers/Api/Operator/MeteranController.php`  
**File lama:** `backend/app/Http/Controllers/OperatorController.php` — hapus isinya setelah rute dipindah

### Bug yang ada di file lama:
1. `Customer::where('nomor_pelanggan', ...)` → field tidak ada, harusnya `where('id_klien', ...)`
2. `Tariff::where('is_active', true)` → kolom `is_active` tidak ada di tabel tariffs; gunakan `$customer->tarif_per_m3` langsung
3. `Bill::create(['bulan', 'meteran_lama', 'meteran_baru', 'tanggal_tagihan', 'jatuh_tempo'])` → field DB sebenarnya adalah `periode`, `meteran_awal`, `meteran_akhir`, `tanggal_jatuh_tempo`
4. Namespace salah: `App\Http\Controllers` bukan `App\Http\Controllers\Api\Operator`

### Method `catatMeteran` (single):

Request: `{ id_klien: integer, meteran_baru: integer, periode?: "YYYY-MM", tanggal_jatuh_tempo?: date }`

Logic:
1. Cari `Customer::where('id_klien', $request->id_klien)->where('status', 'aktif')`
2. Validasi `meteran_baru >= customer->meteran_terakhir`
3. Hitung: `pemakaian = meteran_baru - meteran_terakhir`, `jumlah = pemakaian * customer->tarif_per_m3`
4. Cek apakah bill periode ini sudah ada (dari generateBills):
   - Jika ada → update (`meteran_awal`, `meteran_akhir`, `pemakaian`, `jumlah_tagihan`)
   - Jika tidak ada → create baru
5. Update `customer->meteran_terakhir` dan `tanggal_baca_terakhir`
6. Bungkus dalam `DB::transaction()`

### Method `catatMeteranBulk` (baru):

Request:
```json
{
  "periode": "2025-06",
  "tanggal_jatuh_tempo": "2025-07-15",
  "readings": [
    { "id_klien": 5, "meteran_baru": 150 },
    { "id_klien": 6, "meteran_baru": 230 }
  ]
}
```

Logic: Loop tiap item, jalankan logic sama dengan single dalam satu transaksi. Return:
```json
{ "berhasil": 2, "gagal": 0, "errors": [], "details": [...] }
```

### Method `templateMeteran` (baru):

`GET /operator/meter-template/{periode}` — return JSON semua klien aktif:
```json
{
  "periode": "2025-06",
  "template": [
    { "id_klien": 5, "nama": "Budi", "meteran_terakhir": 100, "meteran_baru": null, "sudah_dicatat": false }
  ]
}
```

`sudah_dicatat = true` jika bill periode ini sudah ada dengan `pemakaian > 0`.

### Method `getCustomerInfo`:

Ganti `Customer::where('nomor_pelanggan', ...)` → `Customer::where('id_klien', $request->id_klien)`.

---

## WAVE 2B — Task 2B: KasirController

**File:** `backend/app/Http/Controllers/Api/KasirController.php`

### Perubahan per method:

**`cekTagihan()`**:
- Request field: `nomor_pelanggan` → `id_klien` (integer)
- Query: `Customer::where('nomor_langganan', ...)` → `Customer::where('id_klien', $request->id_klien)`
- Response bill: ganti `bulan`→`periode`, `meteran_lama`→`meteran_awal`, `meteran_baru`→`meteran_akhir`, `jatuh_tempo`→`tanggal_jatuh_tempo`, hapus `tanggal_tagihan`
- Response customer: ganti `nomor_pelanggan`→`id_klien`

**`bayar()`**:
- Request field: `nomor_pelanggan` → `id_klien`
- Query ganti ke `where('id_klien', ...)`

**`unpaidBills()`, `pendingRequests()`, `payments()`, `showPayment()`**:
- Semua `with(['customer:id,nomor_langganan,nama'])` → `with(['customer:id,id_klien,nama'])`

---

## WAVE 2C — Task 2C: UserController Admin + Operator

**Files:**
- `backend/app/Http/Controllers/Api/Admin/UserController.php`
- `backend/app/Http/Controllers/Api/Operator/UserController.php`

### Perubahan method `store()` untuk klien (di kedua file):

```php
// SEBELUM: buat Customer dulu → User dengan customer_id
// SESUDAH: buat User dulu → Customer dengan id_klien = user->id

return DB::transaction(function () use ($request) {
    $user = User::create([
        'name'     => $request->name,
        'email'    => $request->email,
        'password' => $request->password,
        'role'     => 'klien',
        // password_changed_at = null → forced change
    ]);

    Customer::create([
        'id_klien'              => $user->id,
        'nama'                  => $request->name,
        'alamat'                => $request->alamat,
        'telepon'               => $request->telepon,
        'status'                => 'aktif',
        'tarif_per_m3'          => $request->tarif_per_m3,
        'meteran_terakhir'      => $request->meteran_awal,
        'tanggal_baca_terakhir' => now(),
    ]);

    return $user->load('customer');
});
```

### Perubahan method `destroy()` untuk klien:
- Hapus User saja → Customer otomatis cascade karena `id_klien` FK punya `onDelete('cascade')`

### Hapus dari `store()`:
- Semua kode `Str::random(6)` untuk generate `nomor_langganan`
- `use Illuminate\Support\Str;` import (jika tidak dipakai lagi)

---

## WAVE 2D — Task 2D: CustomerController Admin

**File:** `backend/app/Http/Controllers/Api/Admin/CustomerController.php`

### Perubahan:

1. **Hapus method `store()`** — ganti dengan return `405 Method Not Allowed` atau hapus sama sekali
2. **Hapus method `importCsv()`** dan **`importJson()`**
3. **`update()`**: Hapus `nomor_langganan` dari validation rules
4. **`index()`, `show()`, `destroy()`**: Tidak berubah

---

## WAVE 2E — Task 2E: KlienController

**File:** `backend/app/Http/Controllers/Api/KlienController.php`

### Perubahan:

**`bills()`**:
```php
// Ganti:
$customerId = $request->user()->customer_id;
// Dengan:
$customer = $request->user()->customer; // via hasOne(Customer, 'id_klien')
if (!$customer) return response()->json(['message' => 'Data pelanggan tidak ditemukan.'], 404);
$customerId = $customer->id;
```

**`requestPayment()` dan `billPdf()`**:
```php
// Ganti:
if ($bill->customer_id !== $request->user()->customer_id)
// Dengan:
$customer = $request->user()->customer;
if (!$customer || $bill->customer_id !== $customer->id)
```

---

## WAVE 2F — Task 2F: Routes

**File:** `backend/routes/api.php`

### Perubahan:

```php
// HAPUS:
use App\Http\Controllers\OperatorController;
Route::post('/catat-meteran', [OperatorController::class, 'catatMeteran']);
Route::post('/customer-info', [OperatorController::class, 'getCustomerInfo']);

// GANTI DENGAN:
use App\Http\Controllers\Api\Operator\MeteranController;
Route::post('/catat-meteran', [MeteranController::class, 'catatMeteran']);
Route::post('/catat-meteran/bulk', [MeteranController::class, 'catatMeteranBulk']);
Route::get('/meter-template/{periode}', [MeteranController::class, 'templateMeteran']);
Route::post('/customer-info', [MeteranController::class, 'getCustomerInfo']);

// HAPUS dari admin routes:
Route::post('/customers/import-csv', [...]);
Route::post('/customers/import', [...]);
```

---

## WAVE 3A — Task 3A: Frontend — UsersPage

**File:** `frontend/src/pages/UsersPage.tsx`

### Perubahan:

1. Form create klien: hapus field "Nomor Langganan"
2. Tabel: kolom "Nomor Langganan" → "ID Klien", display `KLN-${user.customer?.id_klien ?? user.id}`
3. API POST body: hapus `nomor_langganan`
4. Setelah create: tampilkan `user.customer.id_klien` sebagai konfirmasi identitas klien

---

## WAVE 3B — Task 3B: Frontend — CustomersPage

**File:** `frontend/src/pages/admin/CustomersPage.tsx`

### Perubahan:

1. Hapus tombol "Tambah Customer" dan modal create
2. Hapus tombol "Import CSV/Excel" dan semua kode ExcelJS/import
3. Kolom tabel: hapus `nomor_langganan`, tambah `ID Klien` = `KLN-${customer.id_klien}`
4. Form edit: hapus field `nomor_langganan`
5. API: tidak ada lagi `POST /admin/customers` atau import endpoints

---

## WAVE 3C — Task 3C: Frontend — CheckBillPage (Kasir)

**File:** `frontend/src/pages/kasir/CheckBillPage.tsx`

### Perubahan:

1. Input field: label "ID Klien", type=`number`, placeholder "Contoh: 5"
2. API request: `{ id_klien: parseInt(inputValue) }`
3. Response mapping:
   - `bill.bulan` → `bill.periode`
   - `bill.meteran_lama` → `bill.meteran_awal`
   - `bill.meteran_baru` → `bill.meteran_akhir`
   - `bill.jatuh_tempo` → `bill.tanggal_jatuh_tempo`
   - `customer.nomor_pelanggan` → `customer.id_klien`
4. Bayar request: `{ id_klien: parseInt(inputValue), metode_pembayaran? }`

---

## WAVE 3D — Task 3D: Frontend — Operator Meter Reading Page

**File baru:** `frontend/src/pages/operator/MeterReadingPage.tsx`  
**Update:** `frontend/src/App.tsx` (tambah route), `frontend/src/components/layout/AppLayout.tsx` (tambah nav item)

### Struktur halaman (dua Tab):

**Tab 1 — Input Single:**
- Input: ID Klien (number), Meteran Baru (number), Periode (default: bulan ini), Tanggal Jatuh Tempo
- Tombol "Cari" → `POST /operator/customer-info` → tampil nama + meteran terakhir
- Tombol "Catat" → `POST /operator/catat-meteran`
- Hasil: pemakaian, jumlah tagihan

**Tab 2 — Input Bulk:**
- Input: Periode (YYYY-MM) → tombol "Load Template" → `GET /operator/meter-template/{periode}`
- Tabel editable: ID Klien | Nama | Meteran Terakhir | **Meteran Baru** (input) | Status
- Baris `sudah_dicatat=true` ditampilkan abu-abu (readonly)
- Tombol "Submit" → filter baris yang `meteran_baru` terisi → `POST /operator/catat-meteran/bulk`
- Summary popup: X berhasil, Y gagal

**Route di App.tsx:**
```tsx
<Route path="meter-reading" element={
  <ProtectedRoute allowedRoles={['admin', 'operator']}>
    <MeterReadingPage />
  </ProtectedRoute>
} />
```

**Nav sidebar**: Tambah "Catat Meteran" untuk operator (icon: `Gauge` dari lucide-react).

---

## WAVE 3E — Task 3E: Frontend — Klien Pages

**Files:**
- `frontend/src/pages/klien/MyProfilePage.tsx`
- `frontend/src/pages/klien/MyBillsPage.tsx`

### MyProfilePage:
- "Nomor Langganan" → "ID Klien"
- Display: `KLN-${user.customer?.id_klien ?? user.id}`

### MyBillsPage:
- Fix ownership check: gunakan `user.customer?.id` (dari response `GET /klien/profile`)
- Hapus semua reference ke `nomor_langganan`

---

## WAVE 4 — Task 4: Finalisasi

### 4.1 Seeder verification
Jalankan `php artisan migrate:fresh --seed`. Pastikan menghasilkan:
- User IDs: 1=admin, 2=operator, 3=kasir, 4=klien1, 5=klien2
- Customer rows: 2 baris dengan `id_klien=4` dan `id_klien=5`
- Login `klien1@example.com` / `password` → redirect ke `/change-password`

### 4.2 Update `backend/CLAUDE.md`
- Relasi: `User hasOne(Customer, 'id_klien')`, `Customer belongsTo(User, 'id_klien')`
- Hapus `nomor_langganan`, tambah `id_klien` sebagai identifier klien
- Tambah controller baru: `Api/Operator/MeteranController`

### 4.3 Update `frontend/CLAUDE.md`
- Hapus `customer_id` dari User shape di Auth State
- Tambah `operator/MeterReadingPage.tsx` di Page Structure

---

## Checklist Eksekusi

### Wave 1
- [x] 1.1 Migration file created
- [x] 1.2 Customer model updated
- [x] 1.3 User model updated
- [x] 1.4 Seeder updated (operator, kasir, 2x klien)

### Wave 2 (parallel)
- [x] 2A MeteranController created (single, bulk, template, customerInfo)
- [x] 2B KasirController fixed
- [x] 2C Admin + Operator UserController fixed
- [x] 2D CustomerController: store/import dihapus
- [x] 2E KlienController fixed
- [x] 2F Routes updated

### Wave 3 (parallel)
- [x] 3A UsersPage
- [x] 3B CustomersPage
- [x] 3C CheckBillPage
- [x] 3D MeterReadingPage (baru)
- [x] 3E Klien pages

### Wave 4
- [ ] 4.1 migrate:fresh --seed sukses  ← jalankan manual di lokal
- [x] 4.2 Backend CLAUDE.md
- [x] 4.3 Frontend CLAUDE.md

---

## API Contract Summary (Post-Refactor)

| Endpoint | Method | Request Key Baru | Response Key Baru |
|----------|--------|-----------------|-------------------|
| `/kasir/cek-tagihan` | POST | `id_klien: int` | `customer.id_klien`, `bill.periode`, `bill.meteran_awal`, `bill.meteran_akhir`, `bill.tanggal_jatuh_tempo` |
| `/kasir/bayar` | POST | `id_klien: int` | tidak berubah |
| `/operator/catat-meteran` | POST | `id_klien: int, meteran_baru: int, periode?, tanggal_jatuh_tempo?` | `id_klien, nama, periode, meteran_awal, meteran_akhir, pemakaian, jumlah_tagihan, bill_id` |
| `/operator/catat-meteran/bulk` | POST | `periode, readings[{id_klien, meteran_baru}]` | `berhasil, gagal, errors[], details[]` |
| `/operator/meter-template/{periode}` | GET | — | `periode, template[{id_klien, nama, meteran_terakhir, meteran_baru:null, sudah_dicatat}]` |
| `/operator/customer-info` | POST | `id_klien: int` | `customer, latest_bill` |
| `/admin/users POST (klien)` | POST | hapus `nomor_langganan` | `user.customer.id_klien` (= user.id) |
| `/admin/customers` | GET/PUT/DELETE | — | `id_klien` menggantikan `nomor_langganan` |

---

## Catatan Penting untuk Subagent Eksekutor

1. **Urutan buat data klien**: Buat `User` DULU → baru `Customer` dengan `id_klien = $user->id`. Kebalikan dari kode lama.
2. **`bills.customer_id`**: TIDAK BERUBAH — tetap FK ke `customers.id` (bukan ke `users.id`).
3. **Dev workflow**: Gunakan `php artisan migrate:fresh --seed`, tidak perlu migration inkremental.
4. **Import CSV/JSON customers**: Fitur ini DIHAPUS dari scope refactor ini. CustomersPage tidak punya create/import.
5. **Display format**: UI tampilkan `KLN-{id}`, tapi kirim ke API sebagai integer biasa.
6. **`OperatorController.php` lama**: Setelah `MeteranController` baru selesai, hapus semua method dari file lama.
