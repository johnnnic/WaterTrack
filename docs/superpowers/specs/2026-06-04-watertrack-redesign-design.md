# WaterTrack System Redesign — Design Spec

**Date:** 2026-06-04
**Status:** Approved
**Approach:** Schema Extend (Pendekatan 1)

---

## Ringkasan

Mengubah aplikasi Water Billing Management menjadi **WaterTrack** — sistem manajemen penyaluran air bersih perusahaan ke klien. Perubahan utama: penambahan role `klien` dengan portal terbatas, user management oleh admin & operator, audit log aktivitas, forced password change untuk klien baru, alur payment request klien → konfirmasi kasir, auto-generate ID pelanggan, bulk import via CSV, dan rebranding nama + logo.

---

## Seksi 1 — Schema & Data Layer

### Perubahan Tabel Existing

**`users`** — tambah 2 kolom:
- `customer_id` (unsignedBigInteger, nullable, unique, FK → customers.id) — menghubungkan user klien ke data customer mereka
- `password_changed_at` (timestamp, nullable) — `NULL` berarti belum pernah ganti password; digunakan untuk enforce forced password change pada klien baru

Role enum diperluas menjadi: `admin | operator | kasir | klien`

**`customers`** — perubahan pada `nomor_langganan`:
- Tidak lagi diinput manual (format lama: PLG001)
- **Auto-generated** saat record dibuat: 6 karakter alphanumeric uppercase acak (contoh: `A3F7K2`)
- Dijamin unik via constraint DB + loop re-generate jika collision
- Tidak bisa diubah setelah dibuat

**`bills`** — perubahan:
- Status enum diperluas: `belum_bayar | menunggu_konfirmasi | sudah_bayar`
- Tambah kolom `requested_metode_pembayaran` (string, nullable) — diisi klien saat mengajukan permintaan bayar, digunakan kasir saat konfirmasi

### Tabel Baru: `audit_logs`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | bigIncrements | PK |
| `user_id` | FK → users.id | Siapa yang melakukan aksi |
| `action` | string | `create`, `update`, `delete`, `login`, `logout` |
| `subject_type` | string, nullable | `User`, `Customer`, `Bill`, `Payment`, `Tariff` |
| `subject_id` | integer, nullable | ID record yang dikenai aksi |
| `old_values` | JSON, nullable | State sebelum perubahan |
| `new_values` | JSON, nullable | State sesudah perubahan |
| `ip_address` | string | IP user saat aksi terjadi |
| `created_at` | timestamp | Waktu aksi — tidak ada `updated_at` |

Log bersifat **permanen** — tidak ada endpoint update atau delete.

### Relasi Baru
- `User` → `belongsTo(Customer)` via `customer_id`
- `Customer` → `hasOne(User)` (inverse)

### Seeder
Karena belum pernah deploy, `migrate:fresh --seed` aman dijalankan. Seeder baru:
- **Hanya 1 akun admin**: `admin@watertrack.id` / `password`
- Semua seeder lama (20 customers, bills, payments) **dihapus**
- Admin tidak kena aturan forced password change

---

## Seksi 2 — Backend API

### Middleware Baru: `ForcePasswordChange`

Dipasang di semua route `/api/klien/*`. Cek apakah `Auth::user()->password_changed_at === null`:
- Jika ya → return HTTP 403 dengan body `{"require_password_change": true}`
- Frontend menangkap flag ini dan redirect ke `/change-password`

### Perbaikan AuthController

`AuthController::login` **sekarang memverifikasi password** menggunakan `Hash::check()` — menghapus kerentanan yang ada sebelumnya. Respons login menyertakan field `password_changed_at` agar frontend tahu perlu redirect atau tidak.

### Role-Based Access Matrix

| Fitur | Admin | Operator | Kasir | Klien |
|---|---|---|---|---|
| Kelola akun user (CRUD semua role) | ✓ | ✓ (klien saja) | — | — |
| Kelola pelanggan/customer | ✓ | ✓ | — | — |
| Catat meteran | ✓ | ✓ | — | — |
| Kelola tagihan (CRUD + generate) | ✓ | ✓ | — | — |
| Kelola transaksi/pembayaran | ✓ | — | ✓ | — |
| Cek tagihan manual | ✓ | — | ✓ | — |
| Konfirmasi payment request | ✓ | — | ✓ | — |
| Tariff management | ✓ | — | — | — |
| Audit log | ✓ | — | — | — |
| Lihat profil & tagihan sendiri | — | — | — | ✓ |
| Ajukan permintaan bayar | — | — | — | ✓ |
| Unduh struk PDF | — | — | — | ✓ |
| Ganti password sendiri | ✓ | ✓ | ✓ | ✓ |

### Routes Lengkap

**Admin — User Management** (`/api/admin/users`)
```
GET    /api/admin/users           → semua user semua role (paginated)
POST   /api/admin/users           → buat user baru; jika role klien, buat customer dalam 1 DB transaction
GET    /api/admin/users/{id}      → detail user
PUT    /api/admin/users/{id}      → update user (termasuk reset password)
DELETE /api/admin/users/{id}      → hapus user; customer record tetap ada
```

**Admin — Audit Log**
```
GET    /api/admin/audit-logs      → paginated, filter by user_id / action / subject_type / date range
```

**Operator — User & Tagihan**
```
GET    /api/operator/users           → daftar user role klien saja
POST   /api/operator/users           → buat akun klien + customer (1 DB transaction)
GET    /api/operator/users/{id}      → detail klien
PUT    /api/operator/users/{id}      → update akun klien
DELETE /api/operator/users/{id}      → hapus akun klien

GET    /api/operator/bills           → daftar tagihan (paginated)
POST   /api/operator/bills           → buat tagihan manual
PUT    /api/operator/bills/{id}      → update tagihan
DELETE /api/operator/bills/{id}      → hapus tagihan
POST   /api/operator/bills/generate  → generate tagihan bulk per periode
```

**Kasir — Pembayaran & Transaksi**
```
POST   /api/kasir/cek-tagihan           → cek tagihan by nomor pelanggan (existing)
POST   /api/kasir/bayar                 → proses bayar manual by kasir (existing)
GET    /api/kasir/unpaid-bills          → semua tagihan belum lunas + menunggu konfirmasi
GET    /api/kasir/pending-requests      → tagihan dengan status menunggu_konfirmasi
PUT    /api/kasir/bills/{id}/confirm    → konfirmasi payment request → sudah_bayar
GET    /api/kasir/payments              → riwayat semua transaksi pembayaran (paginated)
PUT    /api/kasir/payments/{id}         → update data transaksi
DELETE /api/kasir/payments/{id}         → hapus transaksi (reverts bill ke belum_bayar)
```

**Klien** (`/api/klien/*`) — semua melewati middleware `ForcePasswordChange`
```
GET    /api/klien/profile                    → data customer + meteran terakhir
GET    /api/klien/bills                      → daftar tagihan milik sendiri
PUT    /api/klien/bills/{id}/request-payment → ajukan permintaan bayar (set menunggu_konfirmasi + simpan metode)
GET    /api/klien/bills/{id}/pdf             → data untuk render struk PDF
PUT    /api/klien/password                   → ganti password sendiri
```

### Bulk Import CSV (Ganti Excel)

- Backend: gunakan PHP native `fgetcsv()` — tidak butuh library tambahan
- Frontend: file input `accept=".csv"` — hapus dependency `xlsx`
- Format CSV: header baris pertama (nama, alamat, telepon, tarif_per_m3, meteran_awal)
- `nomor_langganan` **tidak perlu ada di CSV** — di-generate otomatis saat import
- Validasi per baris, error report per baris yang gagal

### Auto-Generate `nomor_langganan`

```php
do {
    $id = Str::upper(Str::random(6)); // contoh: A3F7K2
} while (Customer::where('nomor_langganan', $id)->exists());
```

Berlaku untuk: create manual via form, create via import CSV, create via DB transaction akun klien baru.

### Controllers Baru / Diubah

| Controller | Perubahan |
|---|---|
| `Admin\UserController` | **Baru** — CRUD semua user; `store` jalankan DB transaction user + customer |
| `Admin\AuditLogController` | **Baru** — index dengan filter, read-only |
| `Operator\UserController` | **Baru** — CRUD khusus user role klien |
| `Operator\BillController` | **Baru** — CRUD tagihan + generate (sama logic Admin\BillController) |
| `KlienController` | **Baru** — profile, bills, request-payment, pdf data, ganti password |
| `KasirController` | **Perluas** — tambah pending-requests, confirm, payments CRUD |
| `AuthController` | **Perbaiki** — `Hash::check()`, sertakan `password_changed_at` di respons |
| `Admin\CustomerController` | **Update** — auto-generate `nomor_langganan`, import ganti ke CSV |

### Audit Logging

Gunakan **Laravel Model Observers** untuk model: `User`, `Customer`, `Bill`, `Payment`. Observer mencatat `create/update/delete` dengan `$model->getOriginal()` (old) dan `$model->getChanges()` (new). Login dan logout dicatat manual di `AuthController`.

---

## Seksi 3 — Frontend

### Forced Password Change Flow

1. Setelah login, `AuthContext` simpan `password_changed_at` dari respons API ke state dan localStorage
2. Jika `password_changed_at === null` dan `user.role === 'klien'` → set flag `mustChangePassword: true`
3. `ProtectedRoute` cek flag — jika aktif dan path bukan `/change-password`, redirect ke `/change-password`
4. Setelah berhasil ganti password, backend set `password_changed_at = now()`, flag di-clear, redirect ke dashboard

### Notification Banner Klien

Tampil di dashboard klien berdasarkan status tagihan terbaru:
- **`belum_bayar`** → banner merah/kuning: *"Anda memiliki tagihan belum lunas. Segera ajukan pembayaran."* + tombol "Lihat Tagihan"
- **`menunggu_konfirmasi`** → banner biru: *"Permintaan pembayaran Anda sedang diproses kasir."*
- Banner hilang otomatis ketika semua tagihan berstatus `sudah_bayar`

### Alur Payment Request (Klien → Kasir)

**Sisi Klien:**
1. Buka `/my-bills` → lihat tagihan `belum_bayar`
2. Klik "Ajukan Pembayaran" → modal pilih metode (tunai / transfer / kartu)
3. Submit → status berubah `menunggu_konfirmasi`, tombol berubah disabled "Menunggu Konfirmasi"

**Sisi Kasir:**
1. Buka `/kasir/pending-requests` → tabel tagihan `menunggu_konfirmasi`
2. Klik "Konfirmasi" → sistem catat payment record, bill jadi `sudah_bayar`

### Routes Frontend

| Path | Role | Halaman |
|---|---|---|
| `/dashboard` | Semua | Dashboard (konten sesuai role) |
| `/users` | Admin, Operator | Kelola akun user |
| `/audit-logs` | Admin | Tabel audit log |
| `/customers` | Admin, Operator | Data pelanggan |
| `/bills` | Admin, Operator | Kelola tagihan |
| `/transactions` | Admin, Kasir | Riwayat transaksi |
| `/kasir/check` | Kasir | Cek tagihan manual |
| `/kasir/pending-requests` | Kasir | Payment request menunggu konfirmasi |
| `/settings` | Admin | Tariff & konfigurasi sistem |
| `/my-profile` | Klien | Info customer & meteran |
| `/my-bills` | Klien | Daftar tagihan + ajukan bayar + unduh PDF |
| `/change-password` | Semua | Form ganti password |

### Navigasi Sidebar per Role

| Menu | Admin | Operator | Kasir | Klien |
|---|---|---|---|---|
| Dashboard | ✓ | ✓ | ✓ | ✓ |
| Kelola Akun | ✓ | ✓ | — | — |
| Kelola Pelanggan | ✓ | ✓ | — | — |
| Kelola Tagihan | ✓ | ✓ | — | — |
| Transaksi | ✓ | — | ✓ | — |
| Cek Tagihan | ✓ | — | ✓ | — |
| Permintaan Bayar | — | — | ✓ | — |
| Audit Log | ✓ | — | — | — |
| Pengaturan (Tarif) | ✓ | — | — | — |
| Profil Saya | — | — | — | ✓ |
| Tagihan Saya | — | — | — | ✓ |

### Halaman Baru / Diubah

**`/users` (Admin & Operator)**
Admin: tabel semua user semua role. Operator: hanya klien. Form tambah user deteksi role — jika `klien`, tampilkan field customer (alamat, telepon, tarif per m³, meteran awal). `nomor_langganan` tidak ada di form, tampil read-only setelah dibuat.

**`/bills` (Admin & Operator)**
CRUD tagihan + tombol "Generate Tagihan" (input periode + tanggal jatuh tempo). Bulk import customer via CSV: tombol upload `.csv`, preview data, error per baris ditampilkan.

**`/kasir/pending-requests` (Kasir)**
Tabel tagihan `menunggu_konfirmasi`: nomor pelanggan, nama, periode, jumlah, metode yang dipilih klien, tombol "Konfirmasi Pembayaran".

**`/my-bills` (Klien)**
Daftar tagihan dengan badge: Belum Bayar / Menunggu Konfirmasi / Lunas. Tombol "Ajukan Pembayaran" hanya untuk `belum_bayar`. Tombol "Unduh PDF" untuk semua tagihan. PDF via `window.print()`.

**`/audit-logs` (Admin)**
Tabel read-only: timestamp, nama user, role, aksi, subjek, old→new collapsible. Filter: by action, by tanggal range.

### Branding — WaterTrack

- Nama: **WaterTrack** di semua title, sidebar header, struk PDF
- Logo: komponen `<WaterDropLogo />` SVG inline
- Warna & tema existing (gold/brown dark) dipertahankan
- Hapus semua string "Water Billing System" → "WaterTrack"
- Hapus dependency `xlsx` dari `package.json`

---

## Seksi 4 — Keamanan & Edge Cases

### Keamanan

- **Password verification** diperbaiki — `AuthController` sebelumnya tidak mengecek password sama sekali
- **Klien isolation** — semua query `KlienController` filter by `Auth::user()->customer_id`
- **Role middleware** eksplisit di setiap route group
- **Audit log immutable** — tidak ada endpoint PUT/DELETE untuk `audit_logs`
- **`nomor_langganan` read-only** — tidak bisa diubah via API manapun setelah dibuat

### Edge Cases

| Situasi | Penanganan |
|---|---|
| Admin/operator hapus user klien | Customer record tetap; `customer_id` pada user di-nullify |
| Buat user klien gagal di tengah transaksi | DB transaction rollback — tidak ada user/customer setengah jadi |
| Klien ajukan bayar tapi sudah `menunggu_konfirmasi` | Backend tolak 422: "Permintaan sudah diajukan" |
| Kasir konfirmasi tagihan yang sudah `sudah_bayar` | Backend tolak 422: "Tagihan sudah lunas" |
| Collision `nomor_langganan` saat generate | Loop re-generate sampai unique (6 char = ~2 miliar kombinasi) |
| CSV import baris invalid | Lewati baris invalid, return summary: berhasil X / gagal Y + detail error per baris |
| Klien ganti password dengan password yang sama | Tolak: `Hash::check(new, current)` true |
| PDF tagihan `menunggu_konfirmasi` diunduh | Bisa diunduh; status di struk: "Menunggu Konfirmasi" |

### Di Luar Scope

- Reset password via email
- Two-factor authentication
- Export audit log ke Excel/CSV
- Notifikasi tagihan jatuh tempo otomatis
- Online payment gateway
- Multi-language
