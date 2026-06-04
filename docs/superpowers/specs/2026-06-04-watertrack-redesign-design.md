# WaterTrack System Redesign — Design Spec

**Date:** 2026-06-04
**Status:** Approved
**Approach:** Schema Extend (Pendekatan 1)

---

## Ringkasan

Mengubah aplikasi Water Billing Management menjadi **WaterTrack** — sistem manajemen penyaluran air bersih perusahaan ke klien. Perubahan utama: penambahan role `klien` dengan portal read-only, user management oleh admin & operator, audit log aktivitas, forced password change untuk klien baru, dan rebranding nama + logo.

---

## Seksi 1 — Schema & Data Layer

### Perubahan Tabel Existing

**`users`** — tambah 2 kolom:
- `customer_id` (unsignedBigInteger, nullable, unique, FK → customers.id) — menghubungkan user klien ke data customer mereka
- `password_changed_at` (timestamp, nullable) — `NULL` berarti belum pernah ganti password; digunakan untuk enforce forced password change pada klien baru

Role enum diperluas menjadi: `admin | operator | kasir | klien`

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

### Routes Baru

**Admin — User Management** (`/api/admin/users`)
```
GET    /api/admin/users           → semua user semua role (paginated)
POST   /api/admin/users           → buat user baru; jika role klien, buat customer dalam 1 DB transaction
GET    /api/admin/users/{id}      → detail user
PUT    /api/admin/users/{id}      → update user (termasuk reset password)
DELETE /api/admin/users/{id}      → hapus user; customer record tetap ada
```

**Admin — Audit Log** (`/api/admin/audit-logs`)
```
GET    /api/admin/audit-logs      → paginated, filter by user_id / action / subject_type / date range
```

**Klien** (`/api/klien/*`) — semua melewati middleware `ForcePasswordChange`
```
GET    /api/klien/profile         → data customer milik sendiri + meteran terakhir
GET    /api/klien/bills           → daftar tagihan milik sendiri (paginated)
GET    /api/klien/bills/{id}/pdf  → data untuk render struk PDF di frontend
PUT    /api/klien/password        → ganti password sendiri
```

**Kasir** — tambahan
```
GET    /api/kasir/unpaid-bills    → semua tagihan berstatus belum_bayar (paginated)
```

### Controllers Baru / Diubah

| Controller | Perubahan |
|---|---|
| `Admin\UserController` | **Baru** — CRUD semua user; method `store` jalankan DB transaction untuk buat user + customer klien |
| `Admin\AuditLogController` | **Baru** — index dengan filter, read-only |
| `KlienController` | **Baru** — profile, bills, pdf data, ganti password |
| `KasirController` | **Tambah** method `unpaidBills()` |
| `AuthController` | **Perbaiki** — gunakan `Hash::check()`, sertakan `password_changed_at` di respons |
| `OperatorController` | **Tambah** akses CRUD klien/customer (sama seperti admin) |

### Audit Logging

Gunakan **Laravel Model Observers** untuk model: `User`, `Customer`, `Bill`, `Payment`. Observer mencatat `create/update/delete` dengan `$model->getOriginal()` (old) dan `$model->getChanges()` (new). Login dan logout dicatat manual di `AuthController`. Semua tulis langsung ke tabel `audit_logs` via Eloquent biasa.

### Role Authorization

Setiap route group ditambah middleware role-check eksplisit — bukan hanya mengandalkan prefix URL:
- `/api/admin/*` → hanya `admin`
- `/api/kasir/*` → hanya `kasir`
- `/api/operator/*` → hanya `operator`
- `/api/klien/*` → hanya `klien`

**Khusus user management:** Karena operator juga bisa CRUD akun klien, endpoint user management diduplikasi di bawah prefix operator:
- `/api/admin/users/*` → hanya `admin`
- `/api/operator/users/*` → hanya `operator`

Kedua prefix mengarah ke controller yang sama (`Admin\UserController`) dengan method yang sama. Dengan demikian tidak ada route yang menerima dua role sekaligus — isolation tetap bersih.

---

## Seksi 3 — Frontend

### Forced Password Change Flow

1. Setelah login berhasil, `AuthContext` simpan `password_changed_at` dari respons API ke state dan localStorage
2. Jika `password_changed_at === null` dan `user.role === 'klien'` → set flag `mustChangePassword: true` di context
3. `ProtectedRoute` cek flag ini — jika aktif dan path bukan `/change-password`, redirect ke `/change-password`
4. Halaman `/change-password` tidak bisa di-skip; setelah berhasil, backend set `password_changed_at = now()`, flag di-clear, redirect ke dashboard

### Routes Baru

| Path | Role | Halaman |
|---|---|---|
| `/users` | admin, operator | Kelola semua akun user |
| `/audit-logs` | admin | Tabel audit log |
| `/my-profile` | klien | Info customer & meteran milik sendiri |
| `/my-bills` | klien | Daftar tagihan + unduh PDF |
| `/change-password` | semua (wajib klien baru) | Form ganti password |
| `/kasir/unpaid-bills` | kasir | Daftar tagihan belum lunas |

### Halaman Baru

**`/users` (Admin & Operator)**
Tabel semua user: nama, email, role badge, aksi edit/hapus. Tombol "Tambah User" buka modal form. Form deteksi role yang dipilih — jika `klien`, tampilkan field tambahan: nomor langganan, alamat, telepon, tarif per m³, meteran awal.

**`/audit-logs` (Admin)**
Tabel read-only: timestamp, nama user, role, aksi, subjek, perubahan old→new (collapsible JSON). Filter: by action, by tanggal range. Tidak ada aksi hapus/edit.

**`/my-profile` & `/my-bills` (Klien)**
Kartu info personal: nomor langganan, nama, alamat, meteran terakhir, tagihan aktif. Halaman bills: daftar tagihan dengan badge status Lunas/Belum Bayar, tombol "Unduh PDF" per baris. PDF di-generate client-side via `window.print()` dengan template HTML print-friendly — tanpa library tambahan.

**`/kasir/unpaid-bills` (Kasir)**
Tabel tagihan belum lunas: nomor pelanggan, nama, periode, jumlah tagihan, jatuh tempo. Klik baris → isi otomatis form cek tagihan existing.

**`/change-password` (Semua Role)**
Form dua field: password baru + konfirmasi. Validasi: minimal 8 karakter, tidak boleh sama dengan password lama. Setelah berhasil, klien diarahkan ke dashboard.

### Navigasi Sidebar per Role

| Menu | Admin | Operator | Kasir | Klien |
|---|---|---|---|---|
| Dashboard | ✓ | ✓ | ✓ | — |
| Kelola Pelanggan | ✓ | ✓ | — | — |
| Tagihan | ✓ | — | — | — |
| Transaksi | ✓ | — | — | — |
| Kelola Akun | ✓ | ✓ | — | — |
| Audit Log | ✓ | — | — | — |
| Cek Tagihan | — | — | ✓ | — |
| Tagihan Belum Lunas | — | — | ✓ | — |
| Profil Saya | — | — | — | ✓ |
| Tagihan Saya | — | — | — | ✓ |

### Branding — WaterTrack

- Nama aplikasi: **WaterTrack** di semua title halaman, sidebar header, struk PDF
- Logo: komponen `<WaterDropLogo />` berupa SVG inline — tidak butuh asset eksternal
- Warna & tema existing (gold/brown dark) dipertahankan
- String "Water Billing System" diganti "WaterTrack" di seluruh codebase

---

## Seksi 4 — Keamanan & Edge Cases

### Keamanan

- **Password verification** diperbaiki di `AuthController` — sebelumnya tidak mengecek password sama sekali
- **Klien isolation** — semua query di `KlienController` filter by `Auth::user()->customer_id`; tidak ada parameter ID dari request untuk data personal
- **Role middleware** eksplisit di setiap route group — tidak mengandalkan prefix URL
- **Audit log immutable** — tidak ada endpoint PUT/DELETE untuk `audit_logs`; Observer tidak memanggil method yang trigger Observer lain

### Edge Cases

| Situasi | Penanganan |
|---|---|
| Admin/operator hapus user klien | Customer record tetap ada (data tagihan & bayar tidak hilang); `customer_id` pada user di-nullify |
| Buat user klien gagal di tengah transaksi | DB transaction rollback — tidak ada user atau customer yang terbuat setengah |
| Klien akses endpoint admin/kasir/operator | Middleware return 403 |
| Klien ganti password dengan password yang sama | Backend validasi: password baru tidak boleh sama dengan password lama |
| PDF tagihan yang sudah lunas diunduh | Tetap bisa diunduh; status di struk menampilkan "Lunas" dengan tanggal bayar |
| User non-klien akses `/change-password` | Halaman accessible untuk semua; forced redirect hanya berlaku untuk klien dengan `password_changed_at === null` |

### Di Luar Scope

- Reset password via email
- Two-factor authentication
- Export audit log ke Excel/CSV
- Notifikasi tagihan jatuh tempo otomatis
- Multi-language
