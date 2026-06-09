<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Tariff;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class TariffController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(): JsonResponse
    {
        $tariffs = Tariff::all();
        return response()->json($tariffs);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'golongan' => 'required|string|max:255',
            'harga_per_m3' => 'required|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json($validator->errors(), 422);
        }

        $tariff = Tariff::create($validator->validated());

        return response()->json($tariff, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Tariff $tariff): JsonResponse
    {
        return response()->json($tariff);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Tariff $tariff): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'golongan' => 'sometimes|required|string|max:255',
            'harga_per_m3' => 'sometimes|required|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json($validator->errors(), 422);
        }

        $data = $validator->validated();
        if (isset($data['harga_per_m3']) && bccomp((string) $data['harga_per_m3'], (string) $tariff->harga_per_m3, 2) !== 0) {
            Customer::where('tariff_id', $tariff->id)
                ->update(['tarif_per_m3' => $data['harga_per_m3']]);
        }
        $tariff->update($data);
        return response()->json($tariff);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Tariff $tariff): JsonResponse
    {
        $tariff->delete();
        return response()->json(null, 204);
    }
}
