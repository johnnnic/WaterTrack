# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Dev server (http://localhost:5173)
npm run dev

# Production build
npm run build

# Lint
npm run lint

# Preview production build
npm run preview
```

No test runner is configured — `npm run test` does not exist.

## Environment

Create a `.env` file (not tracked in git):
```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

The Axios instance in `src/lib/api.ts` defaults to `http://127.0.0.1:8000/api` if the env var is absent.

## Architecture

### Key Files
- `src/lib/api.ts` — Axios instance; attaches Bearer token from localStorage; redirects to `/login` on 401
- `src/contexts/AuthContext.tsx` — global auth state; persists to `localStorage` keys `water_billing_token` and `water_billing_user`
- `src/components/ProtectedRoute.tsx` — wraps routes; accepts optional `allowedRoles` prop; redirects unauthorized users to `/unauthorized`
- `src/App.tsx` — all routes defined here; role-to-route mapping is explicit

### Auth State
User object shape (from `src/types/auth.ts`):
```ts
{ id: number; name: string; email: string; role: 'admin' | 'operator' | 'kasir' | 'klien'; created_at: string }
```
No `customer_id` on User — customer data accessed via `user.customer` (hasOne via `id_klien`).
Auth is restored from localStorage on app load inside `AuthContext`. `logout()` calls `localStorage.clear()` then hard-redirects to `/login`.

### Customer Identifier
`id_klien` = `users.id` — kasir dan operator input angka ini untuk lookup pelanggan.
Display di UI: `KLN-{id_klien}` (prefix untuk keterbacaan). Dikirim ke API sebagai integer biasa.

### Page Structure
```
src/pages/
├── LoginPage.tsx
├── DashboardPage.tsx         # role-specific UI branches
├── UsersPage.tsx             # Admin+Operator: CRUD semua role; create klien otomatis buat Customer
├── AuditLogPage.tsx          # Admin only
├── ChangePasswordPage.tsx
├── NotFound.tsx
├── admin/
│   ├── CustomersPage.tsx     # view/edit/delete only — create via UsersPage
│   ├── BillsPage.tsx
│   ├── TransactionsPage.tsx
│   └── SettingsPage.tsx      # Tariff management
├── operator/
│   └── MeterReadingPage.tsx  # catat meteran single & bulk via id_klien
├── kasir/
│   ├── CheckBillPage.tsx     # lookup via id_klien (integer input)
│   ├── PaymentPage.tsx
│   └── PendingRequestsPage.tsx
└── klien/
    ├── MyProfilePage.tsx
    └── MyBillsPage.tsx
```

### UI Stack
- shadcn/ui components live in `src/components/ui/` — regenerate via `npx shadcn@latest add <component>`, do not edit manually
- Tailwind CSS with custom design tokens: `bg-brown-dark`, `bg-brown-medium`, `text-gold`, `bg-gradient-gold`, `shadow-gold` — defined in `tailwind.config.ts`
- Currency formatting: `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' })`

### Data Fetching
Uses direct `api.get/post` calls inside `useEffect`/event handlers — not TanStack Query (installed but not actively used). Each component manages its own loading state; there is no global error boundary.
