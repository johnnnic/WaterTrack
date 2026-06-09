<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Bill;
use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class BillController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(): JsonResponse
    {
        $bills = Bill::with(['customer' => function ($query) {
            $query->select('id', 'id_klien', 'nama', 'alamat');
        }])
        ->latest()
        ->paginate(15);

        return response()->json($bills);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'customer_id' => 'required|exists:customers,id',
            'periode' => 'required|string',
            'meteran_awal' => 'required|integer|min:0',
            'meteran_akhir' => 'required|integer|min:0',
            'tarif_per_m3' => 'required|numeric|min:0',
            'tanggal_jatuh_tempo' => 'required|date',
        ]);

        if ($validator->fails()) {
            return response()->json($validator->errors(), 422);
        }

        $data = $validator->validated();
        
        // Calculate pemakaian and jumlah_tagihan
        $data['pemakaian'] = $data['meteran_akhir'] - $data['meteran_awal'];
        $data['jumlah_tagihan'] = $data['pemakaian'] * $data['tarif_per_m3'];

        $bill = Bill::create($data);
        $bill->load('customer');

        return response()->json($bill, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Bill $bill): JsonResponse
    {
        $bill->load('customer', 'payments');
        return response()->json($bill);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Bill $bill): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'customer_id' => 'required|exists:customers,id',
            'periode' => 'required|string',
            'meteran_awal' => 'required|integer|min:0',
            'meteran_akhir' => 'required|integer|min:0',
            'tarif_per_m3' => 'required|numeric|min:0',
            'tanggal_jatuh_tempo' => 'required|date',
            'status' => 'required|in:belum_bayar,sudah_bayar',
        ]);

        if ($validator->fails()) {
            return response()->json($validator->errors(), 422);
        }

        $data = $validator->validated();
        
        // Recalculate pemakaian and jumlah_tagihan
        $data['pemakaian'] = $data['meteran_akhir'] - $data['meteran_awal'];
        $data['jumlah_tagihan'] = $data['pemakaian'] * $data['tarif_per_m3'];

        $bill->update($data);
        $bill->load('customer');

        return response()->json($bill);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Bill $bill): JsonResponse
    {
        $bill->delete();
        return response()->json(['message' => 'Bill deleted successfully']);
    }

    /**
     * Generate bills for all customers for a specific period
     */
    public function generateBills(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'periode' => 'required|string',
            'tanggal_jatuh_tempo' => 'required|date',
        ]);

        if ($validator->fails()) {
            return response()->json($validator->errors(), 422);
        }

        $periode = $request->periode;
        $tanggalJatuhTempo = $request->tanggal_jatuh_tempo;

        // Get all active customers
        $customers = Customer::where('status', 'aktif')->get();
        $billsCreated = 0;

        foreach ($customers as $customer) {
            // Check if bill already exists for this period
            $existingBill = Bill::where('customer_id', $customer->id)
                ->where('periode', $periode)
                ->first();

            if (!$existingBill) {
                // Create new bill (you might want to get actual meter readings)
                Bill::create([
                    'customer_id' => $customer->id,
                    'periode' => $periode,
                    'meteran_awal' => $customer->meteran_terakhir,
                    'meteran_akhir' => $customer->meteran_terakhir, // Same as awal for now
                    'pemakaian' => 0, // Will be updated when meter reading is done
                    'tarif_per_m3' => $customer->tarif_per_m3,
                    'jumlah_tagihan' => 0, // Will be calculated after meter reading
                    'tanggal_jatuh_tempo' => $tanggalJatuhTempo,
                ]);
                $billsCreated++;
            }
        }

        return response()->json([
            'message' => "Successfully generated {$billsCreated} bills for period {$periode}",
            'bills_created' => $billsCreated
        ]);
    }
}
