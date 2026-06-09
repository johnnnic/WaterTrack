# WaterTrack Bug Fix Plan — 2026-06-09

## Scope
Perbaikan 12 bug aktif hasil analisa full-stack review. Dibagi 2 grup paralel (backend dan frontend) + 1 config fix.

---

## Grup A — Backend PHP (paralel dengan Grup B)

### A1 · `DashboardController.php:103` — `nomor_langganan` → `id_klien`
**File:** `backend/app/Http/Controllers/Api/Admin/DashboardController.php`
**Fix:** Ganti `$customer->nomor_langganan` → `"KLN-{$customer->id_klien}"`

### A2 · `Admin/PaymentController.php:100-107` — destroy() tidak aman
**File:** `backend/app/Http/Controllers/Api/Admin/PaymentController.php`
**Fix:**
- Wrap dalam `DB::transaction()`
- Tambah null check: `if (!$payment->bill) { return 404 }`
- Reset `requested_metode_pembayaran` → null saat restore status bill
- Urutan: update bill dulu, delete payment setelahnya

### A3 · `Admin/BillController.php:79` — Status enum tidak lengkap
**File:** `backend/app/Http/Controllers/Api/Admin/BillController.php`
**Fix:** Tambah `menunggu_konfirmasi` ke validasi status: `in:belum_bayar,menunggu_konfirmasi,sudah_bayar`

### A4 · `Admin/PaymentController.php:39` — store() tidak cek duplikat/status bill
**File:** `backend/app/Http/Controllers/Api/Admin/PaymentController.php`
**Fix:** Tambah guard sebelum create payment — cek `bill->status === 'sudah_bayar'` return 422

---

## Grup B — Frontend TypeScript/React (paralel dengan Grup A)

### B1 · `CheckBillPage.tsx:12-35` — Field mapping API salah
**File:** `frontend/src/pages/kasir/CheckBillPage.tsx`
**Fix:** Update interface `ApiResponse.customer` dari `name/address/phone` → `nama/alamat/telepon`; hapus `tanggal_tagihan` yang tidak ada.

### B2 · `PendingRequestsPage.tsx:12-19` — Field `nomor_langganan` → `id_klien`
**File:** `frontend/src/pages/kasir/PendingRequestsPage.tsx`
**Fix:**
- Update interface: ganti `nomor_langganan: string` → `id_klien: number`
- Update table header: "No. Langganan" → "No. Pelanggan"
- Update render: `b.customer?.nomor_langganan` → `KLN-${b.customer?.id_klien}`

### B3 · `TransactionsPage.tsx` — Stats dari paginated data & filter date range broken
**File:** `frontend/src/pages/admin/TransactionsPage.tsx`
**Fix stats:** Tambah call ke `/admin/payments/stats` endpoint untuk stats card
**Fix filter:** Pisahkan state dates dari fungsi close; `applyDateRangeFilter` tidak reset dates sebelum filter diaplikasikan

### B4 · `BillsPage.tsx:25,29` — Duplicate property `status` di interface
**File:** `frontend/src/pages/admin/BillsPage.tsx`
**Fix:** Hapus baris `status: 'belum_bayar' | 'sudah_bayar'` (line 25), pertahankan yang lengkap dengan `menunggu_konfirmasi`

### B5 · `PaymentPage.tsx:153-156` — `keterangan` tidak dikirim ke API
**File:** `frontend/src/pages/kasir/PaymentPage.tsx`
**Fix:** Tambah `keterangan: paymentForm.keterangan` ke payload `/kasir/bayar`

### B6 · `App.tsx:110` — Komentar route misleading
**File:** `frontend/src/App.tsx`
**Fix:** Ubah komentar `Admin only` sebelum transactions route → `Admin + Kasir`

---

## Grup C — Config (langsung)

### C1 · `docker-compose.yml:97` — Komentar port frontend salah
**Fix:** Ubah komentar `Frontend : http://localhost:8080` → `Frontend : http://localhost:3000`

---

## Urutan Eksekusi

```
[Paralel] Grup A (backend)  ──┐
[Paralel] Grup B (frontend) ──┼── selesai ──► Grup C ──► Code Review
```

## Files yang Dimodifikasi

| File | Grup | Perubahan |
|------|------|-----------|
| `backend/app/Http/Controllers/Api/Admin/DashboardController.php` | A | nomor_langganan → id_klien |
| `backend/app/Http/Controllers/Api/Admin/PaymentController.php` | A | destroy() safe + store() guard |
| `backend/app/Http/Controllers/Api/Admin/BillController.php` | A | status enum lengkap |
| `frontend/src/pages/kasir/CheckBillPage.tsx` | B | fix field mapping |
| `frontend/src/pages/kasir/PendingRequestsPage.tsx` | B | fix nomor_langganan |
| `frontend/src/pages/admin/TransactionsPage.tsx` | B | fix stats + filter |
| `frontend/src/pages/admin/BillsPage.tsx` | B | fix duplicate status |
| `frontend/src/pages/kasir/PaymentPage.tsx` | B | fix keterangan |
| `frontend/src/App.tsx` | B | fix komentar |
| `docker-compose.yml` | C | fix komentar port |
