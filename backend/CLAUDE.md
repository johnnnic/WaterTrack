# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start dev server
php artisan serve

# Run all tests
php artisan test
# Run a single test file
php artisan test tests/Feature/ExampleTest.php

# Migrations
php artisan migrate
php artisan migrate:fresh --seed

# Code style (Laravel Pint)
./vendor/bin/pint

# Clear caches (after config changes)
php artisan config:clear && php artisan route:clear && php artisan cache:clear

# Artisan generators
php artisan make:controller Api/Admin/FooController
php artisan make:model Foo -m   # model + migration
php artisan make:migration add_column_to_table
```

## Architecture

### Controller Structure
```
app/Http/Controllers/
├── Api/
│   ├── Admin/           # Admin-only endpoints (customers, bills, payments, tariffs, users, dashboard, audit-logs)
│   ├── Operator/
│   │   ├── MeteranController  # catatMeteran, catatMeteranBulk, templateMeteran, getCustomerInfo
│   │   ├── BillController     # bill CRUD + generateBills
│   │   └── UserController     # klien user CRUD
│   ├── AuthController   # login / logout (Sanctum tokens)
│   ├── KasirController  # cekTagihan, bayar, payments
│   └── KlienController  # profile, bills, requestPayment, billPdf
└── OperatorController   # DEPRECATED - dipindah ke Api/Operator/MeteranController
```

All routes are in `routes/api.php` and grouped under `auth:sanctum` middleware. The `admin/*`, `kasir/*`, and `operator/*` prefixes are enforced at the route level only — there is no role-checking middleware yet; role enforcement is implicit via prefix separation.

### Models & Relationships
- `User` → `hasOne(Customer, 'id_klien')` — klien users only; admin/operator/kasir have no customer
- `Customer` → `belongsTo(User, 'id_klien')`, `hasMany(Bill)`
- `Bill` → `belongsTo(Customer)`, `hasMany(Payment)`
- `Payment` → `belongsTo(Bill)`, `belongsTo(User)`
- `Tariff` — standalone; tariff rate is **copied onto Customer** at creation (denormalized)

### Key Domain Rules
- `Bill.status`: `belum_bayar` | `menunggu_konfirmasi` | `sudah_bayar`
- `Customer.status`: `aktif` | `nonaktif`
- `Payment.metode_pembayaran`: `tunai` | `transfer` | `kartu`
- `Customer.id_klien` = `User.id` — identifier unik pelanggan; kasir dan operator lookup via `id_klien` (integer)
- Setiap Customer **wajib** punya User (role=klien). Customer hanya dibuat via `UserController::store()` saat membuat klien user.
- Urutan buat klien: buat `User` dulu → buat `Customer` dengan `id_klien = $user->id`
- Bill usage: `pemakaian = meteran_akhir - meteran_awal`, `jumlah_tagihan = pemakaian × tarif_per_m3` (calculated in controller, not model)
- `generateBills` creates placeholder bills with 0 pemakaian for active customers; actual usage filled via `catatMeteran` (single) or `catatMeteranBulk`
- **`AuthController::login` checks password via `Hash::check()`** — production-ready

### API Response Conventions
- Success: returns model/collection directly, HTTP 200/201
- Validation failure: `Validator::make()` → `$validator->errors()` with HTTP 422
- Delete: `{'message': 'X deleted successfully'}` with HTTP 200
- No `{data, message, status}` envelope wrapper is used (contrary to the README)

### Database
Default `.env.example` uses SQLite. For MySQL change:
```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=water_billing
DB_USERNAME=root
DB_PASSWORD=
```
