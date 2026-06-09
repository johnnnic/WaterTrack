<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bill;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class KlienController extends Controller {
    public function profile(Request $request): JsonResponse {
        $user = $request->user()->load('customer');
        return response()->json([
            'user'     => $user,
            'customer' => $user->customer,
        ]);
    }

    public function bills(Request $request): JsonResponse {
        $customer = $request->user()->customer;

        if (!$customer) {
            return response()->json(['message' => 'Data pelanggan tidak ditemukan.'], 404);
        }

        return response()->json(
            Bill::where('customer_id', $customer->id)
                ->orderBy('periode', 'desc')
                ->paginate(15)
        );
    }

    public function requestPayment(Request $request, Bill $bill): JsonResponse {
        $request->validate([
            'metode_pembayaran' => 'required|in:tunai,transfer,kartu',
        ]);

        $customer = $request->user()->customer;
        if (!$customer || $bill->customer_id !== $customer->id) {
            return response()->json(['message' => 'Tagihan tidak ditemukan.'], 404);
        }

        if ($bill->status === 'menunggu_konfirmasi') {
            return response()->json(['message' => 'Permintaan pembayaran sudah diajukan.'], 422);
        }

        if ($bill->status !== 'belum_bayar') {
            return response()->json(['message' => 'Tagihan tidak dapat diajukan pembayaran.'], 422);
        }

        $bill->update([
            'status'                      => 'menunggu_konfirmasi',
            'requested_metode_pembayaran' => $request->input('metode_pembayaran'),
        ]);

        return response()->json($bill);
    }

    public function billPdf(Request $request, Bill $bill): JsonResponse {
        $customer = $request->user()->customer;
        if (!$customer || $bill->customer_id !== $customer->id) {
            return response()->json(['message' => 'Tagihan tidak ditemukan.'], 404);
        }

        return response()->json($bill->load('customer', 'payments'));
    }
}
