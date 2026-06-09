# UI Polish Implementation Plan — WaterTrack Frontend

**Tanggal dibuat**: 2026-06-09  
**Berdasarkan**: Analisis mendalam UI/UX dengan skill `ui-ux-pro-max`  
**Total task**: 8 task dalam 4 fase  

---

## Ringkasan Eksekusi

```
FASE 1 — Sequential (BLOCKER)
└── T-01: Fix black screen bug + Error Boundary

FASE 2 — Parallel (4 agent bersamaan setelah T-01)
├── T-02: DashboardPage — icons, alert → toast, loading skeleton
├── T-03: DashboardPage — kasir/operator/klien forms
├── T-04: Login Page polish
└── T-05: AppSidebar + Header fixes

FASE 3 — Sequential (setelah Fase 2 selesai)
└── T-06: Refactor DashboardPage (split per role)

FASE 4 — Parallel (setelah T-06)
├── T-07: Accessibility pass
└── T-08: Security + deprecated API cleanup
```

---

## FASE 1 — Critical Bug Fix (Harus Pertama, Sequential)

### T-01 — Fix Black Screen & Error Boundary

**Estimasi**: 15 menit | **Prioritas**: BLOCKER  
**Depends on**: —  

**File yang diubah**:
- `frontend/src/components/layout/AppSidebar.tsx`
- `frontend/src/components/ErrorBoundary.tsx` *(file baru)*
- `frontend/src/components/layout/AppLayout.tsx`

---

#### 1a. AppSidebar.tsx — hapus `useLocation` yang tidak diimport

**Root cause**: Baris 51 memanggil `useLocation()` yang tidak ada di import. Ini menyebabkan `ReferenceError: useLocation is not defined` → seluruh AppLayout crash → layar hitam.

Variabel `location` tidak pernah dipakai di JSX — cukup hapus baris ini:

```diff
  // baris 2 — tidak perlu tambah useLocation ke import
  import { NavLink } from 'react-router-dom';

  // AppSidebar.tsx baris 51 — HAPUS
- const location = useLocation();
```

---

#### 1b. Buat ErrorBoundary.tsx

Buat `src/components/ErrorBoundary.tsx` sebagai React class component:

- Tangkap error dengan `componentDidCatch`
- State: `{ hasError: boolean; error: Error | null }`
- Fallback UI menggunakan design tokens: `bg-background`, `text-foreground`, `bg-gradient-gold`
- Fallback berisi: judul error, deskripsi singkat, tombol "Muat Ulang Halaman" yang memanggil `window.location.reload()`
- Props: `children: React.ReactNode`

---

#### 1c. AppLayout.tsx — wrap dengan ErrorBoundary

```diff
+ import { ErrorBoundary } from '@/components/ErrorBoundary';

  export const AppLayout: React.FC = () => {
    return (
      <SidebarProvider>
+       <ErrorBoundary>
          <div className="min-h-screen flex w-full bg-background">
            <AppSidebar />
            <div className="flex-1 flex flex-col">
              <Header />
              <main className="flex-1 p-6">
                <Outlet />
              </main>
            </div>
          </div>
+       </ErrorBoundary>
      </SidebarProvider>
    );
  };
```

**Acceptance criteria**:
- [ ] Dashboard tampil normal setelah login
- [ ] Jika ada error runtime di komponen anak, muncul fallback UI (bukan layar hitam)
- [ ] `npm run build` tanpa TypeScript error baru

---

## FASE 2 — Parallel (Jalankan setelah T-01, bisa 4 agent bersamaan)

> **Conflict note**: T-02 dan T-03 keduanya menyentuh `DashboardPage.tsx`. Jika paralel, assign ke satu agent saja dengan bagian yang sudah dibagi jelas. T-04 dan T-05 file-nya terpisah — bebas paralel.

---

### T-02 — DashboardPage: Emoji → Icons & Alert → Toast

**Estimasi**: 45 menit | **Prioritas**: HIGH  
**Depends on**: T-01  
**Scope di file**: `DashboardPage.tsx` baris 1–510 (imports, state, fetchDashboardStats, render header + stats grid + activity card)

**File yang diubah**:
- `frontend/src/pages/DashboardPage.tsx`

---

#### 2a. Ganti semua emoji → Lucide React icons

Lucide sudah terinstall. Tidak ada install baru diperlukan.

| Emoji | Lucide Import | Context |
|-------|--------------|---------|
| `💳` | `CreditCard` | Label bayar, metode tunai |
| `🔍` | `Search` | Tombol cek tagihan |
| `👥` | `Users` | Kelola pelanggan |
| `📊` | `BarChart3` | Laporan / catat meteran |
| `💧` | `Droplets` | Generate tagihan |
| `⚙️` | `Settings` | Pengaturan |
| `📝` | `ClipboardEdit` | Submit catat meteran |
| `✅` | `CheckCircle2` | Konfirmasi pembayaran |
| `❌` | `X` | Batal / hapus |
| `⏳` | spinner `<div>` | Loading state |
| `📋` | `FileText` | Detail tagihan |
| `💰` | `Banknote` | Proses pembayaran header |
| `🖨️` | `Printer` | Cetak struk |
| `💵` | `Wallet` | Opsi tunai di select |
| `🏦` | `Building2` | Transfer bank di select |

**Catatan**: Icon di dalam `<option>` (select element) tidak bisa render Lucide — hapus emoji dari option value, ganti teks menjadi "Tunai", "Transfer Bank", "Kartu Debit/Kredit".

---

#### 2b. Ganti semua `alert()` → `sonner` toast

`sonner` sudah ada di `App.tsx` via `<Sonner />`. Import `toast` dari `'sonner'`.

```tsx
import { toast } from 'sonner';

// Validasi → warning
toast.warning('Nomor pelanggan harus diisi!');

// Success → success
toast.success('Pembayaran berhasil diproses!');
toast.success('Meteran berhasil dicatat!');

// Error → error
toast.error(errorMessage);
```

Hapus semua `alert()` di fungsi: `cekTagihan`, `prosesBayar`, `getCustomerInfo`, `catatMeteran`.

---

#### 2c. Perbaiki loading state agar visible di dark background

```diff
- <div className="flex items-center justify-center min-h-[400px]">
-   <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
- </div>

+ <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
+   <div className="animate-spin rounded-full h-10 w-10 border-4 border-gold/20 border-t-gold"></div>
+   <p className="text-sm text-muted-foreground animate-pulse">Memuat data dashboard...</p>
+ </div>
```

---

#### 2d. Tambah skeleton loading untuk stats cards

Saat `loadingStats === true`, render skeleton cards bukan hanya spinner. `Skeleton` sudah ada di `@/components/ui/skeleton`.

```tsx
// Tentukan jumlah skeleton berdasarkan role
const skeletonCount = user?.role === 'admin' ? 8 : 4;

{loadingStats ? (
  <>
    <div className="space-y-2">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
    </div>
    <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: skeletonCount }).map((_, i) => (
        <Card key={i} className="bg-card/50 border-brown-medium">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </div>
              <Skeleton className="h-12 w-12 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  </>
) : (
  // ... konten asli
)}
```

**Acceptance criteria**:
- [ ] Tidak ada emoji di JSX DashboardPage (baris 1–510)
- [ ] Tidak ada `alert()` di DashboardPage
- [ ] Loading menampilkan skeleton cards, bukan spinner polos di background hitam
- [ ] `toast.success/error/warning` muncul di kanan bawah layar

---

### T-03 — DashboardPage: Polish Quick Action Forms

**Estimasi**: 60 menit | **Prioritas**: HIGH  
**Depends on**: T-01  
**Scope di file**: `DashboardPage.tsx` baris 511–794 (Aksi Cepat section)

**File yang diubah**:
- `frontend/src/pages/DashboardPage.tsx`

---

#### 3a. Ganti raw `<input>`, `<button>`, `<select>` → shadcn/ui components

```tsx
// Import tambahan yang diperlukan
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue
} from '@/components/ui/select';
```

Ganti setiap elemen form raw dengan komponen di atas. Pertahankan className untuk styling kustom jika diperlukan.

---

#### 3b. Ganti `onKeyPress` (deprecated) → `onKeyDown`

```diff
- onKeyPress={(e) => e.key === 'Enter' && cekTagihan()}
+ onKeyDown={(e) => e.key === 'Enter' && cekTagihan()}
```

---

#### 3c. Ganti custom modal konfirmasi → shadcn Dialog

State `showConfirmPayment` sudah ada. Wrap dengan `<Dialog>`:

```tsx
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter
} from '@/components/ui/dialog';

<Dialog open={showConfirmPayment} onOpenChange={setShowConfirmPayment}>
  <DialogContent className="bg-card border-brown-medium max-w-md">
    <DialogHeader>
      <DialogTitle className="text-foreground">Konfirmasi Pembayaran</DialogTitle>
    </DialogHeader>
    {/* isi detail pembayaran yang sudah ada */}
    <DialogFooter className="flex gap-3">
      <Button
        onClick={prosesBayar}
        disabled={loadingBayar}
        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
      >
        {loadingBayar ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Memproses...
          </div>
        ) : (
          <><CheckCircle2 className="h-4 w-4 mr-2" />Konfirmasi</>
        )}
      </Button>
      <Button
        variant="outline"
        onClick={() => setShowConfirmPayment(false)}
        disabled={loadingBayar}
      >
        <X className="h-4 w-4 mr-2" />Batal
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

#### 3d. Tambah konten Aksi Cepat untuk role `klien`

```tsx
{user?.role === 'klien' && (
  <div className="grid grid-cols-1 gap-3">
    <Button
      variant="outline"
      className="w-full justify-start border-brown-medium hover:bg-brown-medium hover:text-gold"
      onClick={() => navigate('/my-bills')}
    >
      <FileText className="h-4 w-4 mr-2" />
      Lihat Tagihan Saya
    </Button>
    <Button
      variant="outline"
      className="w-full justify-start border-brown-medium hover:bg-brown-medium hover:text-gold"
      onClick={() => navigate('/my-profile')}
    >
      <UserCircle className="h-4 w-4 mr-2" />
      Profil Saya
    </Button>
  </div>
)}
```

---

#### 3e. Hapus ternary grid class yang identik (baris 458)

```diff
- <div className={`grid gap-6 ${user?.role === 'admin' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'}`}>
+ <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
```

**Acceptance criteria**:
- [ ] Semua form input menggunakan shadcn/ui components
- [ ] Tidak ada `onKeyPress`
- [ ] Modal konfirmasi menggunakan shadcn Dialog
- [ ] Role `klien` punya konten di Aksi Cepat

---

### T-04 — Login Page Polish

**Estimasi**: 30 menit | **Prioritas**: MEDIUM  
**Depends on**: T-01  
**File**: `frontend/src/pages/LoginPage.tsx` (tidak konflik dengan task lain)

---

#### 4a. Update copyright year

```diff
- <p>&copy; 2024 Water Billing App. Semua hak dilindungi.</p>
+ <p>&copy; 2026 Water Billing App. Semua hak dilindungi.</p>
```

---

#### 4b. Demo account buttons — auto-submit langsung

```diff
- const fillDemoAccount = (email: string, password: string) => {
-   setEmail(email);
-   setPassword(password);
- };

+ const fillDemoAccount = async (email: string, password: string) => {
+   setIsLoading(true);
+   try {
+     await login({ email, password });
+   } catch {
+     // Error dihandle AuthContext via toast
+   } finally {
+     setIsLoading(false);
+   }
+ };
```

---

#### 4c. Animasi masuk pada card dan logo

```diff
- <div className="mx-auto w-20 h-20 bg-gradient-gold rounded-2xl ...">
+ <div className="mx-auto w-20 h-20 bg-gradient-gold rounded-2xl ... animate-scale-in">

- <Card className="bg-card/50 backdrop-blur-sm ...">
+ <Card className="bg-card/50 backdrop-blur-sm ... animate-fade-in">
```

Keyframes `fade-in` dan `scale-in` sudah terdefinisi di `tailwind.config.ts`.

---

#### 4d. Ganti Droplets icon → inisial role di demo buttons

```diff
  <div className="w-6 h-6 bg-gradient-gold rounded-full flex items-center justify-center">
-   <Droplets className="h-3 w-3 text-black" />
+   <span className="text-black font-bold text-xs">{account.role.charAt(0)}</span>
  </div>
```

---

#### 4e. Tambah `aria-label` pada password toggle

```diff
  <button
    type="button"
+   aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
    onClick={() => setShowPassword(!showPassword)}
    className="..."
  >
```

**Acceptance criteria**:
- [ ] Copyright menampilkan 2026
- [ ] Klik demo account langsung login tanpa klik Login lagi
- [ ] Card dan logo muncul dengan animasi
- [ ] Password toggle memiliki `aria-label`

---

### T-05 — AppSidebar + Header Fixes

**Estimasi**: 30 menit | **Prioritas**: MEDIUM  
**Depends on**: T-01  
**File**: `AppSidebar.tsx`, `Header.tsx` (tidak konflik dengan T-02/T-03/T-04)

---

#### 5a. AppSidebar — ganti avatar Droplets → inisial nama

```diff
  <div className="w-8 h-8 bg-gradient-gold rounded-full flex items-center justify-center">
-   <Droplets className="h-4 w-4 text-black" />
+   <span className="text-black font-semibold text-sm">{user?.name.charAt(0).toUpperCase()}</span>
  </div>
```

---

#### 5b. AppSidebar — diferensiasi icon nav items

```diff
  import {
    LayoutDashboard, Users, Receipt, CreditCard, Settings,
-   LogOut, Droplets, ClipboardList, Bell, UserCircle, FileText,
+   LogOut, Droplets, ClipboardList, Bell, UserCircle, FileText, UserCog,
  } from 'lucide-react';

  const navItems = [
-   { title: 'Kelola Akun', url: '/users', icon: Users, roles: ['admin', 'operator'] },
+   { title: 'Kelola Akun', url: '/users', icon: UserCog, roles: ['admin', 'operator'] },
    { title: 'Kelola Pelanggan', url: '/customers', icon: Users, roles: ['admin', 'operator'] },
  ]
```

---

#### 5c. AppSidebar — tambah `aria-label` pada tombol Logout

```diff
  <Button
+   aria-label="Logout dari aplikasi"
    variant="elegant"
    size={collapsed ? "icon" : "default"}
    onClick={logout}
    className="w-full"
  >
```

---

#### 5d. Header — perbaiki `getRoleDisplayName`

```diff
  switch (role) {
    case 'admin':    return 'Administrator';
    case 'operator': return 'Operator';
    case 'kasir':    return 'Kasir';
+   case 'klien':    return 'Pelanggan';
    default:         return role;
  }
```

---

#### 5e. Header — tambah `aria-label` pada Bell button

```diff
- <Button variant="ghost" size="icon">
+ <Button variant="ghost" size="icon" aria-label="Notifikasi">
    <Bell className="h-5 w-5 text-muted-foreground" />
  </Button>
```

---

#### 5f. Header — tambah page title indicator

```tsx
// Tambah import
import { useLocation } from 'react-router-dom';

// Tambah mapping
const routeTitles: Record<string, string> = {
  '/dashboard':             'Dashboard',
  '/users':                 'Kelola Akun',
  '/customers':             'Kelola Pelanggan',
  '/bills':                 'Kelola Tagihan',
  '/transactions':          'Transaksi',
  '/settings':              'Pengaturan',
  '/audit-logs':            'Audit Log',
  '/kasir/check':           'Cek Tagihan',
  '/payments':              'Proses Pembayaran',
  '/kasir/pending-requests':'Permintaan Bayar',
  '/my-profile':            'Profil Saya',
  '/my-bills':              'Tagihan Saya',
};

// Di dalam komponen Header:
const { pathname } = useLocation();
const pageTitle = routeTitles[pathname] ?? 'WaterTrack';

// Render — tambahkan di sebelah kanan SidebarTrigger, sebelum div search:
<span className="text-sm font-semibold text-foreground hidden md:block">
  {pageTitle}
</span>
```

---

#### 5g. Header — atasi false affordance search bar

Hapus search bar sementara karena tidak fungsional (false affordance lebih merusak UX):

```diff
- <div className="hidden md:flex items-center gap-4">
-   <div className="relative">
-     <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
-     <Input
-       placeholder="Cari pelanggan, tagihan..."
-       className="pl-10 w-80 bg-background border-brown-medium focus:border-gold"
-     />
-   </div>
- </div>
```

Hapus juga import `Search` dan `Input` dari Header jika tidak digunakan lagi.

**Acceptance criteria**:
- [ ] Sidebar menampilkan inisial nama user (bukan ikon air)
- [ ] `Kelola Akun` dan `Kelola Pelanggan` punya icon berbeda
- [ ] Header menampilkan nama halaman aktif
- [ ] Role `klien` → "Pelanggan" di Header
- [ ] Bell button memiliki `aria-label`
- [ ] Search bar dihapus (tidak ada false affordance)

---

## FASE 3 — Sequential (Setelah Semua Fase 2 Selesai)

### T-06 — Refactor DashboardPage (Split per Role)

**Estimasi**: 90 menit | **Prioritas**: MEDIUM  
**Depends on**: T-02, T-03 selesai (polish dulu, baru split)  

**File yang dibuat**:
- `frontend/src/pages/dashboard/AdminDashboard.tsx`
- `frontend/src/pages/dashboard/KasirDashboard.tsx`
- `frontend/src/pages/dashboard/OperatorDashboard.tsx`
- `frontend/src/pages/dashboard/KlienDashboard.tsx`
- `frontend/src/lib/dashboard.ts` *(shared utilities)*

**File yang diubah**:
- `frontend/src/pages/DashboardPage.tsx` *(dikecilkan jadi router)*

---

#### 6a. Extract shared utilities ke `src/lib/dashboard.ts`

```ts
// src/lib/dashboard.ts
export const formatRupiah = (angka: number): string =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(angka);

export interface DashboardStats { /* existing interface */ }
export interface RecentActivity { /* existing interface */ }
```

---

#### 6b. Buat sub-dashboard per role

Setiap file berisi: state lokal, API calls, dan JSX relevan yang sudah di-polish di T-02/T-03.

- `AdminDashboard.tsx` — 8 stat cards + activity + aksi cepat admin
- `KasirDashboard.tsx` — 4 stat cards + form cek/bayar tagihan + receipt
- `OperatorDashboard.tsx` — 4 stat cards + form catat meteran
- `KlienDashboard.tsx` — KlienBanner + aksi cepat klien

---

#### 6c. Buat DashboardPage.tsx menjadi thin router

```tsx
// DashboardPage.tsx setelah refactor (~25 baris)
import { useAuth } from '@/contexts/AuthContext';
import { AdminDashboard }    from './dashboard/AdminDashboard';
import { KasirDashboard }    from './dashboard/KasirDashboard';
import { OperatorDashboard } from './dashboard/OperatorDashboard';
import { KlienDashboard }    from './dashboard/KlienDashboard';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  switch (user?.role) {
    case 'admin':    return <AdminDashboard />;
    case 'kasir':    return <KasirDashboard />;
    case 'operator': return <OperatorDashboard />;
    case 'klien':    return <KlienDashboard />;
    default:         return null;
  }
};
```

**Acceptance criteria**:
- [ ] `DashboardPage.tsx` < 40 baris
- [ ] Setiap role dashboard di file terpisah
- [ ] Tidak ada regresi — semua role masih berfungsi identik dengan sebelum refactor
- [ ] `npm run build` bersih

---

## FASE 4 — Parallel Final Pass (Setelah T-06)

### T-07 — Accessibility Pass

**Estimasi**: 30 menit | **Prioritas**: LOW-MEDIUM  
**Depends on**: T-06  

**Checklist**:
- [ ] Icon-only buttons punya `aria-label` (sudah sebagian dilakukan di T-05)
- [ ] Form inputs punya `id` yang matching dengan `htmlFor` pada label
- [ ] Error messages menggunakan `role="alert"` atau `aria-live="polite"`
- [ ] Disabled state punya `disabled` attribute dan `cursor-not-allowed`
- [ ] Tab order logis di semua form
- [ ] Tidak ada `tabIndex` positif

**File target**: Semua file yang dimodifikasi di fase sebelumnya.

---

### T-08 — Security & Deprecated API Cleanup

**Estimasi**: 20 menit | **Prioritas**: LOW-MEDIUM  
**Depends on**: T-06  

**File yang diubah**: `frontend/src/pages/dashboard/KasirDashboard.tsx`

---

#### 8a. Fix XSS di print receipt

```ts
// Tambah fungsi escape di atas printReceipt
const escapeHtml = (str: string): string =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

// Terapkan ke semua interpolasi data dari server di receiptHtml:
// ${lastPaymentReceipt.customer.name} → ${escapeHtml(lastPaymentReceipt.customer.name)}
// ${lastPaymentReceipt.customer.nomor_pelanggan} → ${escapeHtml(...)}
// dst untuk semua field string yang diinterpolasi ke HTML
```

---

#### 8b. Konfirmasi tidak ada `onKeyPress` yang tersisa

Setelah T-03 selesai, grep untuk memastikan bersih:
```bash
grep -r "onKeyPress" frontend/src/
```
Ganti semua yang ditemukan dengan `onKeyDown`.

**Acceptance criteria**:
- [ ] `escapeHtml` diterapkan ke semua user-supplied string di receipt HTML
- [ ] Tidak ada `onKeyPress` di seluruh `src/`

---

## Dependency Graph

```
T-01
 │
 ├──── T-02 ────┐
 ├──── T-03 ────┤
 ├──── T-04 ────┼──── T-06 ────┬──── T-07
 └──── T-05 ────┘               └──── T-08
```

## File Ownership (No Conflict Map)

| Task | File Eksklusif |
|------|---------------|
| T-01 | `AppSidebar.tsx` (baris 51 saja), `ErrorBoundary.tsx` (baru), `AppLayout.tsx` |
| T-02 | `DashboardPage.tsx` baris 1–510 |
| T-03 | `DashboardPage.tsx` baris 511–794 |
| T-04 | `LoginPage.tsx` |
| T-05 | `AppSidebar.tsx` (setelah T-01), `Header.tsx` |
| T-06 | `DashboardPage.tsx` (rewrite), `dashboard/` folder (baru), `lib/dashboard.ts` (baru) |
| T-07 | Review semua file, perubahan minor |
| T-08 | `KasirDashboard.tsx` |

> T-01 dan T-05 sama-sama menyentuh `AppSidebar.tsx`. T-01 harus **selesai dan di-commit** sebelum T-05 dimulai.

## Definisi Done

Task dianggap selesai jika:
1. `npm run build` tidak ada error baru
2. Semua acceptance criteria di-checklist
3. App dijalankan manual, semua role dicek tidak ada regresi
