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
    public function cekTagihan(Request $request): JsonResponse
    {
        $request->validate([
            'id_klien' => 'required|integer|exists:users,id',
        ]);

        try {
            $customer = Customer::where('id_klien', $request->id_klien)
                ->where('status', 'aktif')
                ->first();

            if (!$customer) {
                return response()->json(['message' => 'Klien tidak ditemukan atau tidak aktif.'], 404);
            }

            $tagihan = Bill::where('customer_id', $customer->id)
                ->whereIn('status', ['belum_bayar', 'menunggu_konfirmasi'])
                ->orderBy('periode', 'desc')
                ->first();

            if (!$tagihan) {
                return response()->json(['message' => 'Tidak ada tagihan yang belum dibayar.'], 404);
            }

            return response()->json([
                'customer' => [
                    'id'       => $customer->id,
                    'id_klien' => $customer->id_klien,
                    'nama'     => $customer->nama,
                    'alamat'   => $customer->alamat,
                    'telepon'  => $customer->telepon,
                    'status'   => $customer->status,
                ],
                'bill' => [
                    'id'                  => $tagihan->id,
                    'periode'             => $tagihan->periode,
                    'meteran_awal'        => $tagihan->meteran_awal,
                    'meteran_akhir'       => $tagihan->meteran_akhir,
                    'pemakaian'           => $tagihan->pemakaian,
                    'tarif_per_m3'        => $tagihan->tarif_per_m3,
                    'jumlah_tagihan'      => $tagihan->jumlah_tagihan,
                    'tanggal_jatuh_tempo' => $tagihan->tanggal_jatuh_tempo,
                    'status'              => $tagihan->status,
                ],
                'amount' => $tagihan->jumlah_tagihan,
                'status' => $tagihan->status,
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Terjadi kesalahan.', 'error' => $e->getMessage()], 500);
        }
    }

    public function bayar(Request $request): JsonResponse
    {
        $request->validate([
            'id_klien'          => 'required|integer|exists:users,id',
            'metode_pembayaran' => 'sometimes|in:tunai,transfer,kartu',
        ]);

        try {
            DB::beginTransaction();

            $customer = Customer::where('id_klien', $request->id_klien)
                ->where('status', 'aktif')
                ->first();

            if (!$customer) {
                return response()->json(['message' => 'Klien tidak ditemukan.'], 404);
            }

            $tagihan = Bill::where('customer_id', $customer->id)
                ->where('status', 'belum_bayar')
                ->orderBy('periode', 'desc')
                ->first();

            if (!$tagihan) {
                return response()->json(['message' => 'Tidak ada tagihan yang belum dibayar.'], 404);
            }

            $payment = Payment::create([
                'bill_id'            => $tagihan->id,
                'user_id'            => Auth::id(),
                'jumlah_bayar'       => $tagihan->jumlah_tagihan,
                'metode_pembayaran'  => $request->metode_pembayaran ?? 'tunai',
                'tanggal_bayar'      => now(),
                'keterangan'         => 'Pembayaran melalui kasir',
            ]);

            $tagihan->update(['status' => 'sudah_bayar']);

            DB::commit();

            return response()->json([
                'message'      => 'Pembayaran berhasil diproses.',
                'payment_id'   => $payment->id,
                'jumlah_bayar' => $payment->jumlah_bayar,
                'tanggal_bayar' => $payment->tanggal_bayar,
            ]);
        } catch (\Exception $e) {
            DB::rollback();
            return response()->json(['message' => 'Terjadi kesalahan saat memproses pembayaran.'], 500);
        }
    }

    public function unpaidBills(): JsonResponse
    {
        return response()->json(
            Bill::with(['customer:id,id_klien,nama'])
                ->whereIn('status', ['belum_bayar', 'menunggu_konfirmasi'])
                ->latest()
                ->paginate(15)
        );
    }

    public function pendingRequests(): JsonResponse
    {
        return response()->json(
            Bill::with(['customer:id,id_klien,nama'])
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
                'bill_id'           => $bill->id,
                'user_id'           => Auth::id(),
                'jumlah_bayar'      => $bill->jumlah_tagihan,
                'metode_pembayaran' => $bill->requested_metode_pembayaran ?? 'tunai',
                'tanggal_bayar'     => now(),
                'keterangan'        => 'Konfirmasi pembayaran klien oleh kasir',
            ]);
            $bill->update(['status' => 'sudah_bayar']);

            return response()->json(['message' => 'Pembayaran dikonfirmasi.', 'payment' => $payment]);
        });
    }

    public function payments(): JsonResponse
    {
        return response()->json(
            Payment::with(['bill.customer:id,id_klien,nama', 'user:id,name'])
                ->latest()
                ->paginate(15)
        );
    }

    public function showPayment(Payment $payment): JsonResponse
    {
        return response()->json($payment->load(['bill.customer:id,id_klien,nama', 'user:id,name']));
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
