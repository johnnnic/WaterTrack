<?php
namespace App\Http\Controllers\Api\Operator;

use App\Http\Controllers\Controller;
use App\Models\Bill;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class BillController extends Controller {
    public function index(): JsonResponse {
        return response()->json(
            Bill::with(['customer:id,nomor_langganan,nama'])->latest()->paginate(15)
        );
    }

    public function store(Request $request): JsonResponse {
        $v = Validator::make($request->all(), [
            'customer_id'         => 'required|exists:customers,id',
            'periode'             => 'required|string',
            'meteran_awal'        => 'required|integer|min:0',
            'meteran_akhir'       => 'required|integer|min:0',
            'tarif_per_m3'        => 'required|numeric|min:0',
            'tanggal_jatuh_tempo' => 'required|date',
        ]);
        if ($v->fails()) return response()->json($v->errors(), 422);

        $d = $v->validated();
        $d['pemakaian']      = $d['meteran_akhir'] - $d['meteran_awal'];
        $d['jumlah_tagihan'] = $d['pemakaian'] * $d['tarif_per_m3'];

        return response()->json(Bill::create($d)->load('customer'), 201);
    }

    public function show(Bill $bill): JsonResponse {
        return response()->json($bill->load('customer', 'payments'));
    }

    public function update(Request $request, Bill $bill): JsonResponse {
        $v = Validator::make($request->all(), [
            'customer_id'         => 'required|exists:customers,id',
            'periode'             => 'required|string',
            'meteran_awal'        => 'required|integer|min:0',
            'meteran_akhir'       => 'required|integer|min:0',
            'tarif_per_m3'        => 'required|numeric|min:0',
            'tanggal_jatuh_tempo' => 'required|date',
            'status'              => 'required|in:belum_bayar,menunggu_konfirmasi,sudah_bayar',
        ]);
        if ($v->fails()) return response()->json($v->errors(), 422);

        $d = $v->validated();
        $d['pemakaian']      = $d['meteran_akhir'] - $d['meteran_awal'];
        $d['jumlah_tagihan'] = $d['pemakaian'] * $d['tarif_per_m3'];
        $bill->update($d);

        return response()->json($bill->load('customer'));
    }

    public function destroy(Bill $bill): JsonResponse {
        $bill->delete();
        return response()->json(['message' => 'Tagihan berhasil dihapus.']);
    }

    public function generateBills(Request $request): JsonResponse {
        $v = Validator::make($request->all(), [
            'periode'             => 'required|string',
            'tanggal_jatuh_tempo' => 'required|date',
        ]);
        if ($v->fails()) return response()->json($v->errors(), 422);

        $created = 0;
        foreach (Customer::where('status', 'aktif')->get() as $c) {
            if (!Bill::where('customer_id', $c->id)->where('periode', $request->periode)->exists()) {
                Bill::create([
                    'customer_id'         => $c->id,
                    'periode'             => $request->periode,
                    'meteran_awal'        => $c->meteran_terakhir,
                    'meteran_akhir'       => $c->meteran_terakhir,
                    'pemakaian'           => 0,
                    'tarif_per_m3'        => $c->tarif_per_m3,
                    'jumlah_tagihan'      => 0,
                    'tanggal_jatuh_tempo' => $request->tanggal_jatuh_tempo,
                ]);
                $created++;
            }
        }

        return response()->json([
            'message'      => "Generated {$created} bills for {$request->periode}",
            'bills_created' => $created,
        ]);
    }
}
