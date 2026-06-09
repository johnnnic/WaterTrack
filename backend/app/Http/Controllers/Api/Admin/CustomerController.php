<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class CustomerController extends Controller
{
    public function index(): JsonResponse
    {
        $customers = Customer::with('user:id,name,email')->latest()->get();
        return response()->json([
            'data'  => $customers,
            'total' => $customers->count(),
        ]);
    }

    public function show(Customer $customer): JsonResponse
    {
        return response()->json($customer->load('user:id,name,email'));
    }

    public function update(Request $request, Customer $customer): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'nama'                  => 'sometimes|required|string|max:255',
            'alamat'                => 'sometimes|required|string',
            'telepon'               => 'nullable|string',
            'status'                => 'sometimes|required|in:aktif,nonaktif',
            'tarif_per_m3'          => 'sometimes|required|numeric|min:0',
            'meteran_terakhir'      => 'sometimes|required|integer|min:0',
            'tanggal_baca_terakhir' => 'nullable|date',
            'tariff_id'             => 'nullable|exists:tariffs,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors'  => $validator->errors(),
            ], 422);
        }

        $data = $validator->validated();
        if (!empty($data['tariff_id'])) {
            $tariff = \App\Models\Tariff::find($data['tariff_id']);
            if ($tariff) {
                $data['tarif_per_m3'] = $tariff->harga_per_m3;
            }
        }
        // When tariff_id is null (unlink), tarif_per_m3 retains its last known value intentionally —
        // existing bill calculations stay valid until a new tariff is assigned.
        $customer->update($data);

        return response()->json($customer->load('user:id,name,email'));
    }

    public function destroy(Customer $customer): JsonResponse
    {
        $customer->delete();
        return response()->json(null, 204);
    }
}
