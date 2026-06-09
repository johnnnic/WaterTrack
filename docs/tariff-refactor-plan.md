# Tariff System Refactor Plan — 2026-06-09

## Tujuan
- Tambah relasi Customer ↔ Tariff via `tariff_id` FK
- Cascade update `tarif_per_m3` ke customers saat tariff di-update
- Hapus field `daya_listrik` yang tidak relevan
- Ganti 3 golongan baru: **Residental** (5.000), **Kantor** (8.000), **Pabrik** (12.000)
- Ganti input `tarif_per_m3` manual di form buat klien → dropdown golongan tariff
- Tambah route `GET /tariffs` untuk semua user terautentikasi (baca tariff list)

## Trade-off yang Disepakati
- Data lama di-reset (`migrate:fresh --seed`), tidak perlu backward compat
- `tarif_per_m3` di customers tetap ada sebagai **cache** untuk kalkulasi bill
- Opsi B: semua customer seed di-assign ke Residental sebagai default

---

## Grup A — Backend (paralel dengan Grup B)

### A1 · Migration baru
**File baru:** `database/migrations/2026_06_09_000003_refactor_tariffs_and_customers.php`

up():
- `tariffs`: drop kolom `daya_listrik`
- `customers`: tambah `tariff_id` BIGINT UNSIGNED NULLABLE, FK ke `tariffs.id` ON DELETE SET NULL

down():
- drop FK dan kolom `tariff_id` dari `customers`
- tambah kembali kolom `daya_listrik` nullable ke `tariffs`

### A2 · TariffSeeder — rewrite total
**File:** `database/seeders/TariffSeeder.php`

Hapus semua baris lama. Isi baru:
```php
Tariff::create(['golongan' => 'Residental', 'harga_per_m3' => 5000]);
Tariff::create(['golongan' => 'Kantor',     'harga_per_m3' => 8000]);
Tariff::create(['golongan' => 'Pabrik',     'harga_per_m3' => 12000]);
```
Hapus `WithoutModelEvents` trait dan `daya_listrik` dari semua baris.

### A3 · UserSeeder — update pakai tariff_id
**File:** `database/seeders/UserSeeder.php`

Tambah `use App\Models\Tariff;`. Di bagian Customer::create(), lookup tariff by golongan:
```php
$tariffResidental = Tariff::where('golongan', 'Residental')->first();
$tariffKantor     = Tariff::where('golongan', 'Kantor')->first();
```
Ganti `'tarif_per_m3' => 5000` → `'tariff_id' => $tariffResidental->id, 'tarif_per_m3' => $tariffResidental->harga_per_m3`
Ganti `'tarif_per_m3' => 6000` → `'tariff_id' => $tariffKantor->id, 'tarif_per_m3' => $tariffKantor->harga_per_m3`

### A4 · DatabaseSeeder — panggil TariffSeeder sebelum UserSeeder
**File:** `database/seeders/DatabaseSeeder.php`

```php
$this->call([
    TariffSeeder::class,  // harus duluan
    UserSeeder::class,
]);
```

### A5 · Tariff Model
**File:** `app/Models/Tariff.php`
- Hapus `'daya_listrik'` dari `$fillable`
- Hapus trait `HasFactory` jika tidak digunakan
- Tambah relasi `customers(): HasMany` ke `Customer::class`
- Tambah import `HasMany`

### A6 · Customer Model
**File:** `app/Models/Customer.php`
- Tambah `'tariff_id'` ke `$fillable`
- Tambah relasi `tariff(): BelongsTo` ke `Tariff::class`
- Import `Tariff` model

### A7 · TariffController — hapus daya_listrik, tambah cascade
**File:** `app/Http/Controllers/Api/Admin/TariffController.php`
- `store()`: hapus rule `'daya_listrik' => 'nullable|string|max:255'`
- `update()`: hapus rule daya_listrik; tambah sebelum `$tariff->update($data)`:
```php
if (isset($data['harga_per_m3']) && (float)$data['harga_per_m3'] !== (float)$tariff->harga_per_m3) {
    Customer::where('tariff_id', $tariff->id)
        ->update(['tarif_per_m3' => $data['harga_per_m3']]);
}
```
- Tambah `use App\Models\Customer;` ke imports

### A8 · Admin/UserController — terima tariff_id untuk klien
**File:** `app/Http/Controllers/Api/Admin/UserController.php`
- Di `store()` validasi: ganti `'tarif_per_m3' => 'required_if:role,klien|numeric|min:0'` → `'tariff_id' => 'required_if:role,klien|exists:tariffs,id'`
- Di Customer::create() untuk klien: ganti `'tarif_per_m3' => $request->tarif_per_m3` →
```php
'tariff_id'    => $request->tariff_id,
'tarif_per_m3' => \App\Models\Tariff::find($request->tariff_id)->harga_per_m3,
```

### A9 · Operator/UserController — sama dengan A8
**File:** `app/Http/Controllers/Api/Operator/UserController.php`
- Validasi: ganti `'tarif_per_m3' => 'required|numeric|min:0'` → `'tariff_id' => 'required|exists:tariffs,id'`
- Customer::create(): ganti `'tarif_per_m3' => $request->tarif_per_m3` dengan tariff_id + lookup
- Tambah `use App\Models\Tariff;` ke imports

### A10 · Admin/CustomerController — terima tariff_id di update
**File:** `app/Http/Controllers/Api/Admin/CustomerController.php`
- Di `update()` rules: tambah `'tariff_id' => 'nullable|exists:tariffs,id'`
- Ganti blok update menjadi:
```php
$data = $validator->validated();
if (!empty($data['tariff_id'])) {
    $tariff = \App\Models\Tariff::find($data['tariff_id']);
    if ($tariff) $data['tarif_per_m3'] = $tariff->harga_per_m3;
}
$customer->update($data);
```

### A11 · routes/api.php — tambah GET /tariffs publik (auth)
**File:** `routes/api.php`
Tambahkan setelah baris `Route::get('/user', ...)`:
```php
Route::get('/tariffs', [\App\Http\Controllers\Api\Admin\TariffController::class, 'index']);
```

---

## Grup B — Frontend (paralel dengan Grup A)

### B1 · SettingsPage.tsx — hapus daya_listrik
**File:** `frontend/src/pages/admin/SettingsPage.tsx`
- Interface `Tariff`: hapus `daya_listrik: string`
- Interface `TariffForm`: hapus `daya_listrik: string`
- State `tariffForm`: hapus `daya_listrik: ''`
- Form JSX: hapus Label + Input untuk `daya_listrik`
- Tabel: hapus `<TableHead>Daya Listrik</TableHead>` dan cell-nya
- Payload submit: hapus `daya_listrik` dari object

### B2 · UsersPage.tsx — ganti tarif_per_m3 dengan tariff_id dropdown
**File:** `frontend/src/pages/UsersPage.tsx`
- Tambah state: `const [tariffs, setTariffs] = useState<{id:number; golongan:string; harga_per_m3:number}[]>([])`
- Fetch di useEffect: `api.get('/tariffs').then(r => setTariffs(r.data))`
- `EMPTY_FORM`: ganti `tarif_per_m3: ''` → `tariff_id: ''`
- Form JSX klien: ganti `<Input type="number" ... tarif_per_m3>` dengan `<Select>` dropdown tariff:
  - value: `form.tariff_id`
  - onValueChange: set `tariff_id`
  - Isi item: `{t.golongan} — Rp {t.harga_per_m3.toLocaleString('id-ID')}/m³`
- handleSubmit: ganti `payload.tarif_per_m3` → `payload.tariff_id = parseInt(form.tariff_id)`
- Tambah `formatRupiah` helper jika belum ada

### B3 · CustomersPage.tsx — tambah tariff_id dropdown di edit
**File:** `frontend/src/pages/admin/CustomersPage.tsx`
- Interface `Customer`: tambah `tariff_id: number | null; tariff?: {id:number; golongan:string} | null`
- Interface `EditCustomerForm`: ganti `tarif_per_m3: number` → `tariff_id: number | null`
- State: `const [tariffs, setTariffs] = useState<{id:number; golongan:string; harga_per_m3:number}[]>([])`
- Fetch tariffs di useEffect bersama fetchCustomers
- `openEditModal`: set `tariff_id: customer.tariff_id ?? null`
- Form JSX edit: ganti input `tarif_per_m3` dengan Select dropdown tariff
- Tabel customers: tampilkan `customer.tariff?.golongan ?? '-'` sebagai pengganti nilai angka tarif
- Payload handleUpdate: kirim `tariff_id` bukan `tarif_per_m3` (backend set otomatis)

---

## Urutan Eksekusi

```
[Paralel] Grup A (backend: A1–A11) ──┐
[Paralel] Grup B (frontend: B1–B3) ──┴── selesai ──► Code Review
```

## Reset Data Setelah Implementasi

```bash
podman compose exec backend php artisan migrate:fresh --seed --force
# atau lokal:
php artisan migrate:fresh --seed --force
```

## Files yang Dimodifikasi/Dibuat

| File | Aksi |
|------|------|
| `database/migrations/2026_06_09_000003_refactor_tariffs_and_customers.php` | BARU |
| `database/seeders/TariffSeeder.php` | UBAH total |
| `database/seeders/UserSeeder.php` | UBAH |
| `database/seeders/DatabaseSeeder.php` | UBAH |
| `app/Models/Tariff.php` | UBAH |
| `app/Models/Customer.php` | UBAH |
| `app/Http/Controllers/Api/Admin/TariffController.php` | UBAH |
| `app/Http/Controllers/Api/Admin/UserController.php` | UBAH |
| `app/Http/Controllers/Api/Operator/UserController.php` | UBAH |
| `app/Http/Controllers/Api/Admin/CustomerController.php` | UBAH |
| `routes/api.php` | UBAH |
| `frontend/src/pages/admin/SettingsPage.tsx` | UBAH |
| `frontend/src/pages/UsersPage.tsx` | UBAH |
| `frontend/src/pages/admin/CustomersPage.tsx` | UBAH |
