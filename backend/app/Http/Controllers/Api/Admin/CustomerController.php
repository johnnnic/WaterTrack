<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class CustomerController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(): JsonResponse
    {
        // Ambil semua data customers tanpa pagination
        $customers = Customer::latest()->get();
        return response()->json([
            'data' => $customers,
            'total' => $customers->count()
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'nama'                  => 'required|string|max:255',
            'alamat'                => 'required|string',
            'telepon'               => 'nullable|string',
            'status'                => 'required|in:aktif,nonaktif',
            'tarif_per_m3'          => 'required|numeric|min:0',
            'meteran_terakhir'      => 'required|integer|min:0',
            'tanggal_baca_terakhir' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validation failed', 'errors' => $validator->errors()], 422);
        }

        do {
            $nomor = Str::upper(Str::random(6));
        } while (Customer::where('nomor_langganan', $nomor)->exists());

        $data = $validator->validated();
        $data['nomor_langganan'] = $nomor;

        return response()->json(Customer::create($data), 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Customer $customer): JsonResponse
    {
        return response()->json($customer);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Customer $customer): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'nomor_langganan' => 'sometimes|required|string|unique:customers,nomor_langganan,' . $customer->id,
            'nama' => 'sometimes|required|string|max:255',
            'alamat' => 'sometimes|required|string',
            'telepon' => 'nullable|string',
            'status' => 'sometimes|required|in:aktif,nonaktif',
            'tarif_per_m3' => 'sometimes|required|numeric|min:0',
            'meteran_terakhir' => 'sometimes|required|integer|min:0',
            'tanggal_baca_terakhir' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $customer->update($validator->validated());

        return response()->json($customer);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Customer $customer): JsonResponse
    {
        $customer->delete();
        return response()->json(null, 204);
    }

    /**
     * Import customers from CSV file
     */
    public function importCsv(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimetypes:text/csv,text/plain,application/csv,application/octet-stream',
        ]);

        $handle = fopen($request->file('file')->getPathname(), 'r');
        if ($handle === false) {
            return response()->json(['message' => 'Gagal membuka file CSV.'], 500);
        }
        fgetcsv($handle); // skip header row: nama,alamat,telepon,tarif_per_m3,meteran_awal

        $success = 0;
        $errors  = [];
        $row     = 1;

        while (($line = fgetcsv($handle)) !== false) {
            $row++;
            if (count($line) < 4) {
                $errors[] = "Baris {$row}: Minimal 4 kolom diperlukan";
                continue;
            }

            [$nama, $alamat, $telepon, $tarif, $meteranAwal] = array_pad($line, 5, null);

            if (empty(trim($nama ?? '')) || !is_numeric($tarif)) {
                $errors[] = "Baris {$row}: Nama atau tarif tidak valid";
                continue;
            }

            try {
                do {
                    $nomor = Str::upper(Str::random(6));
                } while (Customer::where('nomor_langganan', $nomor)->exists());

                Customer::create([
                    'nomor_langganan'       => $nomor,
                    'nama'                  => trim($nama),
                    'alamat'                => trim($alamat ?? ''),
                    'telepon'               => trim($telepon ?? ''),
                    'status'                => 'aktif',
                    'tarif_per_m3'          => (float) $tarif,
                    'meteran_terakhir'      => (int) ($meteranAwal ?? 0),
                    'tanggal_baca_terakhir' => now(),
                ]);
                $success++;
            } catch (\Exception) {
                $errors[] = "Baris {$row}: Gagal menyimpan data.";
            }
        }

        fclose($handle);

        return response()->json([
            'berhasil' => $success,
            'gagal'    => count($errors),
            'errors'   => $errors,
        ]);
    }

    /**
     * Import customers from JSON payload (sent by frontend after parsing Excel)
     */
    public function importJson(Request $request): JsonResponse
    {
        $request->validate([
            'customers'                        => 'required|array|min:1|max:500',
            'customers.*.nomor_langganan'      => 'required|string|max:50',
            'customers.*.nama'                 => 'required|string|max:255',
            'customers.*.alamat'               => 'required|string',
            'customers.*.telepon'              => 'nullable|string|max:20',
            'customers.*.status'               => 'required|in:aktif,nonaktif',
            'customers.*.tarif_per_m3'         => 'required|numeric|min:0',
            'customers.*.meteran_terakhir'     => 'required|integer|min:0',
        ]);

        $success = 0;
        $errors  = [];

        foreach ($request->customers as $index => $row) {
            $rowNum = $index + 2;
            try {
                Customer::create([
                    'nomor_langganan'       => strtoupper(trim($row['nomor_langganan'])),
                    'nama'                  => trim($row['nama']),
                    'alamat'                => trim($row['alamat']),
                    'telepon'               => trim($row['telepon'] ?? ''),
                    'status'                => $row['status'],
                    'tarif_per_m3'          => (float) $row['tarif_per_m3'],
                    'meteran_terakhir'      => (int) $row['meteran_terakhir'],
                    'tanggal_baca_terakhir' => now(),
                ]);
                $success++;
            } catch (\Exception) {
                $errors[] = "Baris {$rowNum}: Gagal menyimpan data.";
            }
        }

        return response()->json([
            'berhasil' => $success,
            'gagal'    => count($errors),
            'errors'   => $errors,
        ]);
    }
}
