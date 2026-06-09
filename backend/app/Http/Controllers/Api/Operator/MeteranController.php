<?php

namespace App\Http\Controllers\Api\Operator;

use App\Http\Controllers\Controller;
use App\Models\Bill;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class MeteranController extends Controller
{
    public function catatMeteran(Request $request): JsonResponse
    {
        $v = Validator::make($request->all(), [
            'id_klien'            => 'required|integer|exists:users,id',
            'meteran_baru'        => 'required|integer|min:0',
            'periode'             => 'nullable|string|regex:/^\d{4}-\d{2}$/',
            'tanggal_jatuh_tempo' => 'nullable|date',
        ]);
        if ($v->fails()) {
            return response()->json(['errors' => $v->errors()], 422);
        }

        $customer = Customer::where('id_klien', $request->id_klien)
            ->where('status', 'aktif')
            ->first();

        if (!$customer) {
            return response()->json(['message' => 'Klien tidak ditemukan atau tidak aktif.'], 404);
        }

        if ($request->meteran_baru < $customer->meteran_terakhir) {
            return response()->json([
                'message' => "Meteran baru ({$request->meteran_baru}) tidak boleh kurang dari meteran terakhir ({$customer->meteran_terakhir}).",
            ], 422);
        }

        $periode    = $request->periode ?? now()->format('Y-m');
        $pemakaian  = $request->meteran_baru - $customer->meteran_terakhir;
        $jumlah     = $pemakaian * $customer->tarif_per_m3;
        $jatuhTempo = $request->tanggal_jatuh_tempo ?? now()->addDays(30)->toDateString();

        return DB::transaction(function () use ($request, $customer, $periode, $pemakaian, $jumlah, $jatuhTempo) {
            $existing = Bill::where('customer_id', $customer->id)
                ->where('periode', $periode)
                ->first();

            if ($existing) {
                $existing->update([
                    'meteran_awal'   => $customer->meteran_terakhir,
                    'meteran_akhir'  => $request->meteran_baru,
                    'pemakaian'      => $pemakaian,
                    'tarif_per_m3'   => $customer->tarif_per_m3,
                    'jumlah_tagihan' => $jumlah,
                ]);
                $bill = $existing;
            } else {
                $bill = Bill::create([
                    'customer_id'         => $customer->id,
                    'periode'             => $periode,
                    'meteran_awal'        => $customer->meteran_terakhir,
                    'meteran_akhir'       => $request->meteran_baru,
                    'pemakaian'           => $pemakaian,
                    'tarif_per_m3'        => $customer->tarif_per_m3,
                    'jumlah_tagihan'      => $jumlah,
                    'tanggal_jatuh_tempo' => $jatuhTempo,
                ]);
            }

            $customer->update([
                'meteran_terakhir'      => $request->meteran_baru,
                'tanggal_baca_terakhir' => now(),
            ]);

            return response()->json([
                'message'        => 'Meteran berhasil dicatat.',
                'id_klien'       => $customer->id_klien,
                'nama'           => $customer->nama,
                'periode'        => $periode,
                'meteran_awal'   => $bill->meteran_awal,
                'meteran_akhir'  => $bill->meteran_akhir,
                'pemakaian'      => $pemakaian,
                'tarif_per_m3'   => $customer->tarif_per_m3,
                'jumlah_tagihan' => $jumlah,
                'bill_id'        => $bill->id,
            ]);
        });
    }

    public function catatMeteranBulk(Request $request): JsonResponse
    {
        $v = Validator::make($request->all(), [
            'periode'                 => 'required|string|regex:/^\d{4}-\d{2}$/',
            'tanggal_jatuh_tempo'     => 'nullable|date',
            'readings'                => 'required|array|min:1',
            'readings.*.id_klien'     => 'required|integer|exists:users,id',
            'readings.*.meteran_baru' => 'required|integer|min:0',
        ]);
        if ($v->fails()) {
            return response()->json(['errors' => $v->errors()], 422);
        }

        $jatuhTempo = $request->tanggal_jatuh_tempo ?? now()->addDays(30)->toDateString();
        $results    = ['berhasil' => 0, 'gagal' => 0, 'errors' => [], 'details' => []];

        DB::transaction(function () use ($request, $jatuhTempo, &$results) {
            foreach ($request->readings as $reading) {
                try {
                    $customer = Customer::where('id_klien', $reading['id_klien'])
                        ->where('status', 'aktif')
                        ->first();

                    if (!$customer) {
                        $results['gagal']++;
                        $results['errors'][] = "id_klien {$reading['id_klien']}: Klien tidak ditemukan atau tidak aktif.";
                        continue;
                    }

                    if ($reading['meteran_baru'] < $customer->meteran_terakhir) {
                        $results['gagal']++;
                        $results['errors'][] = "id_klien {$reading['id_klien']} ({$customer->nama}): Meteran baru lebih kecil dari meteran terakhir ({$customer->meteran_terakhir}).";
                        continue;
                    }

                    $pemakaian = $reading['meteran_baru'] - $customer->meteran_terakhir;
                    $jumlah    = $pemakaian * $customer->tarif_per_m3;

                    $existing = Bill::where('customer_id', $customer->id)
                        ->where('periode', $request->periode)
                        ->first();

                    if ($existing) {
                        $existing->update([
                            'meteran_awal'   => $customer->meteran_terakhir,
                            'meteran_akhir'  => $reading['meteran_baru'],
                            'pemakaian'      => $pemakaian,
                            'tarif_per_m3'   => $customer->tarif_per_m3,
                            'jumlah_tagihan' => $jumlah,
                        ]);
                    } else {
                        Bill::create([
                            'customer_id'         => $customer->id,
                            'periode'             => $request->periode,
                            'meteran_awal'        => $customer->meteran_terakhir,
                            'meteran_akhir'       => $reading['meteran_baru'],
                            'pemakaian'           => $pemakaian,
                            'tarif_per_m3'        => $customer->tarif_per_m3,
                            'jumlah_tagihan'      => $jumlah,
                            'tanggal_jatuh_tempo' => $jatuhTempo,
                        ]);
                    }

                    $customer->update([
                        'meteran_terakhir'      => $reading['meteran_baru'],
                        'tanggal_baca_terakhir' => now(),
                    ]);

                    $results['berhasil']++;
                    $results['details'][] = [
                        'id_klien'       => $reading['id_klien'],
                        'nama'           => $customer->nama,
                        'pemakaian'      => $pemakaian,
                        'jumlah_tagihan' => $jumlah,
                    ];
                } catch (\Exception $e) {
                    $results['gagal']++;
                    $results['errors'][] = "id_klien {$reading['id_klien']}: {$e->getMessage()}";
                }
            }
        });

        return response()->json($results);
    }

    public function templateMeteran(string $periode): JsonResponse
    {
        $customers = Customer::where('status', 'aktif')
            ->get(['id', 'id_klien', 'nama', 'meteran_terakhir']);

        $existingBills = Bill::whereIn('customer_id', $customers->pluck('id'))
            ->where('periode', $periode)
            ->where('pemakaian', '>', 0)
            ->pluck('customer_id')
            ->toArray();

        $template = $customers->map(fn ($c) => [
            'id_klien'         => $c->id_klien,
            'nama'             => $c->nama,
            'meteran_terakhir' => $c->meteran_terakhir,
            'meteran_baru'     => null,
            'sudah_dicatat'    => in_array($c->id, $existingBills),
        ]);

        return response()->json(['periode' => $periode, 'template' => $template]);
    }

    public function getCustomerInfo(Request $request): JsonResponse
    {
        $v = Validator::make($request->all(), [
            'id_klien' => 'required|integer|exists:users,id',
        ]);
        if ($v->fails()) {
            return response()->json(['errors' => $v->errors()], 422);
        }

        $customer = Customer::where('id_klien', $request->id_klien)->first();

        if (!$customer) {
            return response()->json(['message' => 'Klien tidak ditemukan.'], 404);
        }

        $latestBill = Bill::where('customer_id', $customer->id)
            ->orderBy('created_at', 'desc')
            ->first();

        return response()->json([
            'customer'    => $customer,
            'latest_bill' => $latestBill,
        ]);
    }
}
