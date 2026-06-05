<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Bill;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Carbon\Carbon;

class DashboardController extends Controller
{
    /**
     * Get dashboard statistics
     */
    public function stats(): JsonResponse
    {
        try {
            $today = Carbon::today();
            
            // Total customers
            $totalCustomers = Customer::count();
            
            // Total bills
            $totalBills = Bill::count();
            
            // Total payments
            $totalPayments = Payment::count();
            
            // Unpaid bills
            $unpaidBills = Bill::where('status', 'belum_bayar')->count();
            
            // Today's payments
            $todayPayments = Payment::whereDate('tanggal_bayar', $today)->count();
            
            // Today's payments amount
            $todayPaymentsAmount = Payment::whereDate('tanggal_bayar', $today)
                ->sum('jumlah_bayar');
            
            // Monthly payments amount
            $monthlyPaymentsAmount = Payment::whereMonth('tanggal_bayar', now()->month)
                ->whereYear('tanggal_bayar', now()->year)
                ->sum('jumlah_bayar');
            
            // Active customers
            $activeCustomers = Customer::where('status', 'aktif')->count();
            
            // This month's bills
            $monthlyBills = Bill::whereMonth('created_at', now()->month)
                ->whereYear('created_at', now()->year)
                ->count();

            return response()->json([
                'totalCustomers' => $totalCustomers,
                'activeCustomers' => $activeCustomers,
                'totalBills' => $totalBills,
                'monthlyBills' => $monthlyBills,
                'totalPayments' => $totalPayments,
                'unpaidBills' => $unpaidBills,
                'todayPayments' => $todayPayments,
                'todayPaymentsAmount' => $todayPaymentsAmount,
                'monthlyPaymentsAmount' => $monthlyPaymentsAmount,
            ]);
            
        } catch (\Exception) {
            return response()->json(['message' => 'Failed to fetch dashboard stats'], 500);
        }
    }

    /**
     * Get recent activities
     */
    public function recentActivities(): JsonResponse
    {
        try {
            $recentPayments = Payment::with(['bill.customer', 'user'])
                ->latest()
                ->limit(10)
                ->get()
                ->map(function ($payment) {
                    return [
                        'id' => $payment->id,
                        'type' => 'payment',
                        'action' => 'Pembayaran diterima',
                        'customer' => $payment->bill->customer->nama,
                        'amount' => 'Rp ' . number_format($payment->jumlah_bayar, 0, ',', '.'),
                        'time' => $payment->created_at->diffForHumans(),
                        'date' => $payment->created_at,
                    ];
                });

            $recentCustomers = Customer::latest()
                ->limit(5)
                ->get()
                ->map(function ($customer) {
                    return [
                        'id' => $customer->id,
                        'type' => 'customer',
                        'action' => 'Pelanggan baru ditambahkan',
                        'customer' => $customer->nama,
                        'amount' => 'ID: ' . $customer->nomor_langganan,
                        'time' => $customer->created_at->diffForHumans(),
                        'date' => $customer->created_at,
                    ];
                });

            $recentBills = Bill::with(['customer'])
                ->latest()
                ->limit(5)
                ->get()
                ->map(function ($bill) {
                    return [
                        'id' => $bill->id,
                        'type' => 'bill',
                        'action' => 'Tagihan diterbitkan',
                        'customer' => $bill->customer->nama,
                        'amount' => 'Rp ' . number_format($bill->jumlah_tagihan, 0, ',', '.'),
                        'time' => $bill->created_at->diffForHumans(),
                        'date' => $bill->created_at,
                    ];
                });

            // Combine and sort by date
            $activities = collect()
                ->merge($recentPayments)
                ->merge($recentCustomers)
                ->merge($recentBills)
                ->sortByDesc('date')
                ->take(15)
                ->values();

            return response()->json($activities);
            
        } catch (\Exception) {
            return response()->json(['message' => 'Failed to fetch recent activities'], 500);
        }
    }
}
