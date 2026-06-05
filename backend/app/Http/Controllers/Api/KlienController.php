<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bill;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class KlienController extends Controller {
    /**
     * GET /api/klien/profile
     * Returns the authenticated klien user's data and linked customer record.
     */
    public function profile(Request $request): JsonResponse {
        $user = $request->user()->load('customer');
        return response()->json([
            'user'     => $user,
            'customer' => $user->customer,
        ]);
    }

    /**
     * GET /api/klien/bills
     * Returns paginated bills belonging to this klien's customer.
     */
    public function bills(Request $request): JsonResponse {
        $customerId = $request->user()->customer_id;

        if (!$customerId) {
            return response()->json(['message' => 'Data pelanggan tidak ditemukan.'], 404);
        }

        return response()->json(
            Bill::where('customer_id', $customerId)
                ->orderBy('periode', 'desc')
                ->paginate(15)
        );
    }

    /**
     * PUT /api/klien/bills/{bill}/request-payment
     * Klien submits a payment request; sets bill to menunggu_konfirmasi.
     */
    public function requestPayment(Request $request, Bill $bill): JsonResponse {
        $request->validate([
            'metode_pembayaran' => 'required|in:tunai,transfer,kartu',
        ]);

        // Ownership check — klien can only touch their own bills
        if ($bill->customer_id !== $request->user()->customer_id) {
            return response()->json(['message' => 'Tagihan tidak ditemukan.'], 404);
        }

        if ($bill->status === 'menunggu_konfirmasi') {
            return response()->json(['message' => 'Permintaan pembayaran sudah diajukan.'], 422);
        }

        if ($bill->status === 'sudah_bayar') {
            return response()->json(['message' => 'Tagihan sudah lunas.'], 422);
        }

        $bill->update([
            'status'                      => 'menunggu_konfirmasi',
            'requested_metode_pembayaran' => $request->metode_pembayaran,
        ]);

        return response()->json($bill);
    }

    /**
     * GET /api/klien/bills/{bill}/pdf
     * Returns full bill data for client-side PDF rendering.
     */
    public function billPdf(Request $request, Bill $bill): JsonResponse {
        if ($bill->customer_id !== $request->user()->customer_id) {
            return response()->json(['message' => 'Tagihan tidak ditemukan.'], 404);
        }

        return response()->json($bill->load('customer', 'payments'));
    }
}
