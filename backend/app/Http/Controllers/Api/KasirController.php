<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Bill;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

class KasirController extends Controller
{
    /**
     * Cek tagihan pelanggan berdasarkan nomor pelanggan
     */
    public function cekTagihan(Request $request): JsonResponse
    {
        $request->validate([
            'nomor_pelanggan' => 'required|string'
        ]);

        try {
            // Cari customer berdasarkan nomor langganan
            $customer = Customer::where('nomor_langganan', $request->nomor_pelanggan)
                ->where('status', 'aktif')
                ->first();

            if (!$customer) {
                return response()->json([
                    'message' => 'Pelanggan tidak ditemukan atau tidak aktif'
                ], 404);
            }

            // Cari tagihan yang belum dibayar
            $tagihan = Bill::where('customer_id', $customer->id)
                ->where('status', 'belum_bayar')
                ->orderBy('created_at', 'desc')
                ->first();

            if (!$tagihan) {
                return response()->json([
                    'message' => 'Tidak ada tagihan yang belum dibayar'
                ], 404);
            }

            return response()->json([
                'customer' => [
                    'id' => $customer->id,
                    'name' => $customer->nama,
                    'address' => $customer->alamat,
                    'nomor_pelanggan' => $customer->nomor_langganan,
                    'phone' => $customer->telepon,
                    'status' => $customer->status
                ],
                'bill' => [
                    'id' => $tagihan->id,
                    'bulan' => $tagihan->bulan,
                    'meteran_lama' => $tagihan->meteran_lama,
                    'meteran_baru' => $tagihan->meteran_baru,
                    'pemakaian' => $tagihan->pemakaian,
                    'tarif_per_m3' => $tagihan->tarif_per_m3,
                    'jumlah_tagihan' => $tagihan->jumlah_tagihan,
                    'tanggal_tagihan' => $tagihan->tanggal_tagihan,
                    'jatuh_tempo' => $tagihan->jatuh_tempo,
                    'status' => $tagihan->status === 'sudah_bayar' ? 'paid' : 'unpaid'
                ],
                'amount' => $tagihan->jumlah_tagihan,
                'status' => $tagihan->status === 'sudah_bayar' ? 'paid' : 'unpaid'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Terjadi kesalahan saat mengambil data tagihan',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Proses pembayaran tagihan
     */
    public function bayar(Request $request): JsonResponse
    {
        $request->validate([
            'nomor_pelanggan' => 'required|string',
            'metode_pembayaran' => 'sometimes|in:tunai,transfer,kartu'
        ]);

        try {
            DB::beginTransaction();

            // Cari customer
            $customer = Customer::where('nomor_langganan', $request->nomor_pelanggan)
                ->where('status', 'aktif')
                ->first();

            if (!$customer) {
                return response()->json([
                    'message' => 'Pelanggan tidak ditemukan'
                ], 404);
            }

            // Cari tagihan yang belum dibayar
            $tagihan = Bill::where('customer_id', $customer->id)
                ->where('status', 'belum_bayar')
                ->orderBy('created_at', 'desc')
                ->first();

            if (!$tagihan) {
                return response()->json([
                    'message' => 'Tidak ada tagihan yang belum dibayar'
                ], 404);
            }

            // Buat record pembayaran
            $payment = Payment::create([
                'bill_id' => $tagihan->id,
                'user_id' => Auth::id(), // ID kasir yang memproses
                'jumlah_bayar' => $tagihan->jumlah_tagihan,
                'metode_pembayaran' => $request->metode_pembayaran ?? 'tunai',
                'tanggal_bayar' => now(),
                'keterangan' => 'Pembayaran melalui kasir'
            ]);

            // Update status tagihan
            $tagihan->update([
                'status' => 'sudah_bayar'
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Pembayaran berhasil diproses',
                'payment_id' => $payment->id,
                'jumlah_bayar' => $payment->jumlah_bayar,
                'tanggal_bayar' => $payment->tanggal_bayar
            ]);

        } catch (\Exception $e) {
            DB::rollback();
            return response()->json([
                'message' => 'Terjadi kesalahan saat memproses pembayaran'
            ], 500);
        }
    }

    public function unpaidBills(): JsonResponse
    {
        return response()->json(
            Bill::with(['customer:id,nomor_langganan,nama'])
                ->whereIn('status', ['belum_bayar', 'menunggu_konfirmasi'])
                ->latest()
                ->paginate(15)
        );
    }

    public function pendingRequests(): JsonResponse
    {
        return response()->json(
            Bill::with(['customer:id,nomor_langganan,nama'])
                ->where('status', 'menunggu_konfirmasi')
                ->latest()
                ->paginate(15)
        );
    }

    public function confirmPayment(Request $request, Bill $bill): JsonResponse
    {
        if ($bill->status === 'sudah_bayar') {
            return response()->json(['message' => 'Tagihan sudah lunas.'], 422);
        }
        if ($bill->status !== 'menunggu_konfirmasi') {
            return response()->json(['message' => 'Tagihan tidak dalam status menunggu konfirmasi.'], 422);
        }

        return DB::transaction(function () use ($bill) {
            $payment = Payment::create([
                'bill_id'            => $bill->id,
                'user_id'            => Auth::id(),
                'jumlah_bayar'       => $bill->jumlah_tagihan,
                'metode_pembayaran'  => $bill->requested_metode_pembayaran ?? 'tunai',
                'tanggal_bayar'      => now(),
                'keterangan'         => 'Konfirmasi pembayaran klien oleh kasir',
            ]);
            $bill->update(['status' => 'sudah_bayar']);

            return response()->json(['message' => 'Pembayaran dikonfirmasi.', 'payment' => $payment]);
        });
    }

    public function payments(): JsonResponse
    {
        return response()->json(
            Payment::with(['bill.customer:id,nomor_langganan,nama', 'user:id,name'])
                ->latest()
                ->paginate(15)
        );
    }

    public function showPayment(Payment $payment): JsonResponse {
        return response()->json($payment->load(['bill.customer:id,nomor_langganan,nama', 'user:id,name']));
    }

    public function updatePayment(Request $request, Payment $payment): JsonResponse
    {
        $request->validate([
            'metode_pembayaran' => 'required|in:tunai,transfer,kartu',
            'keterangan'        => 'nullable|string',
        ]);
        $payment->update($request->only(['metode_pembayaran', 'keterangan']));
        return response()->json($payment);
    }

    public function deletePayment(Payment $payment): JsonResponse
    {
        return DB::transaction(function () use ($payment) {
            $bill = $payment->bill;
            if (!$bill) {
                return response()->json(['message' => 'Tagihan terkait tidak ditemukan.'], 404);
            }
            $payment->delete();
            $bill->update([
                'status'                      => 'belum_bayar',
                'requested_metode_pembayaran' => null,
            ]);
            return response()->json(['message' => 'Transaksi dihapus, tagihan dikembalikan ke belum bayar.']);
        });
    }
}
