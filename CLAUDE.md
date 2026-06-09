# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Water Billing Management System — full-stack app for water utility billing. Backend: Laravel 12 REST API. Frontend: React 18 + TypeScript SPA. Three roles: `admin`, `operator`, `kasir` (cashier).

## Repository Structure

```
WaterTrack/
├── backend/    # Laravel 12 API (PHP 8.2+)
└── frontend/   # React 18 + TypeScript (Vite)
```

## Development Setup

### Backend
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
# Edit .env: set DB_CONNECTION=mysql and DB_DATABASE=water_billing
php artisan migrate:fresh --seed
php artisan serve          # runs on http://127.0.0.1:8000
```

### Frontend
```bash
cd frontend
npm install
# Create .env with: VITE_API_BASE_URL=http://127.0.0.1:8000/api
npm run dev                # runs on http://localhost:5173
```

### Default Seeder Accounts
All passwords are `password`:
- `admin@example.com` — Admin
- `operator@example.com` — Operator
- `kasir@example.com` — Kasir

## Architecture

### Authentication Flow
1. Frontend POSTs to `/api/login` → receives `access_token`
2. Token + user object stored in `localStorage` (`water_billing_token`, `water_billing_user`)
3. Axios interceptor attaches `Authorization: Bearer <token>` to every request
4. On 401, interceptor clears localStorage and redirects to `/login`
5. **Warning**: `AuthController::login` does NOT verify passwords — it issues a token to any known email. This is a dev-only shortcut.

### Role-Based Access
- `ProtectedRoute` wraps routes with an optional `allowedRoles` prop
- `useAuth()` from `AuthContext` provides `user`, `token`, `login`, `logout`
- Route access: admin → all; operator → `/customers`; kasir → `/bills/check`, `/payments`

### API URL Convention
All protected routes require `Authorization: Bearer` header. Backend base: `http://127.0.0.1:8000/api`.

### Bill Calculation Logic
`pemakaian = meteran_akhir - meteran_awal`
`jumlah_tagihan = pemakaian × tarif_per_m3`

Bills are generated per-period (YYYY-MM format) with `generateBills` — creates placeholder bills with 0 usage that get updated when the operator records meter readings.
