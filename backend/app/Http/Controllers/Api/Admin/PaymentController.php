<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\Bill;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class PaymentController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(): JsonResponse
    {
        $payments = Payment::with([
            'bill' => function ($query) {
                $query->select('id', 'customer_id', 'periode');
            },
            'bill.customer' => function ($query) {
                $query->select('id', 'id_klien', 'nama');
            },
            'user' => function ($query) {
                $query->select('id', 'name', 'role');
            }
        ])
        ->latest()
        ->paginate(15);

        return response()->json($payments);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'bill_id' => 'required|exists:bills,id',
            'jumlah_bayar' => 'required|numeric|min:0',
            'metode_pembayaran' => 'required|string',
            'keterangan' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json($validator->errors(), 422);
        }

        $data = $validator->validated();

        return DB::transaction(function () use ($data) {
            $bill = Bill::lockForUpdate()->findOrFail($data['bill_id']);
            if ($bill->status === 'sudah_bayar') {
                return response()->json(['message' => 'Tagihan sudah lunas, tidak dapat membuat pembayaran baru.'], 422);
            }

            $data['user_id'] = auth()->id();
            $data['tanggal_bayar'] = now();

            $payment = Payment::create($data);
            $bill->update(['status' => 'sudah_bayar']);
            $payment->load('bill.customer', 'user');

            return response()->json($payment, 201);
        });
    }

    /**
     * Display the specified resource.
     */
    public function show(Payment $payment): JsonResponse
    {
        $payment->load('bill.customer', 'user');
        return response()->json($payment);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Payment $payment): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'jumlah_bayar' => 'required|numeric|min:0',
            'metode_pembayaran' => 'required|string',
            'keterangan' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json($validator->errors(), 422);
        }

        $payment->update($validator->validated());
        $payment->load('bill.customer', 'user');

        return response()->json($payment);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Payment $payment): JsonResponse
    {
        return DB::transaction(function () use ($payment) {
            $bill = $payment->bill;
            if (!$bill) {
                return response()->json(['message' => 'Tagihan terkait tidak ditemukan.'], 404);
            }
            $bill->update([
                'status'                      => 'belum_bayar',
                'requested_metode_pembayaran' => null,
            ]);
            $payment->delete();
            return response()->json(['message' => 'Pembayaran dihapus, tagihan dikembalikan ke belum bayar.']);
        });
    }

    /**
     * Get payment statistics
     */
    public function stats(): JsonResponse
    {
        $today = now()->startOfDay();
        
        $stats = [
            'total_payments' => Payment::count(),
            'today_payments' => Payment::whereDate('tanggal_bayar', $today)->count(),
            'total_amount' => Payment::sum('jumlah_bayar'),
            'today_amount' => Payment::whereDate('tanggal_bayar', $today)->sum('jumlah_bayar'),
            'this_month_amount' => Payment::whereMonth('tanggal_bayar', now()->month)
                ->whereYear('tanggal_bayar', now()->year)
                ->sum('jumlah_bayar'),
        ];

        return response()->json($stats);
    }

    /**
     * Get recent payments
     */
    public function recent(): JsonResponse
    {
        $recentPayments = Payment::with([
            'bill.customer' => function ($query) {
                $query->select('id', 'id_klien', 'nama');
            },
            'user' => function ($query) {
                $query->select('id', 'name');
            }
        ])
        ->latest()
        ->take(10)
        ->get();

        return response()->json($recentPayments);
    }
}
