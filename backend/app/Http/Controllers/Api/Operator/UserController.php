<?php
namespace App\Http\Controllers\Api\Operator;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Tariff;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class UserController extends Controller {
    public function index(): JsonResponse {
        return response()->json(User::where('role', 'klien')->with('customer')->latest()->paginate(15));
    }

    public function show(User $user): JsonResponse {
        if ($user->role !== 'klien') {
            return response()->json(['message' => 'Tidak ditemukan.'], 404);
        }
        return response()->json($user->load('customer'));
    }

    public function store(Request $request): JsonResponse {
        $v = Validator::make($request->all(), [
            'name'         => 'required|string|max:255',
            'email'        => 'required|email|unique:users,email',
            'password'     => 'required|min:8',
            'alamat'       => 'required|string',
            'telepon'      => 'nullable|string',
            'tariff_id'    => 'required|exists:tariffs,id',
            'meteran_awal' => 'required|integer|min:0',
        ]);
        if ($v->fails()) return response()->json(['errors' => $v->errors()], 422);

        $tariff = Tariff::find($request->tariff_id);
        if (!$tariff) {
            return response()->json(['message' => 'Tarif tidak ditemukan.'], 422);
        }

        $user = DB::transaction(function () use ($request, $tariff) {
            $user = User::create([
                'name'     => $request->name,
                'email'    => $request->email,
                'password' => $request->password,
                'role'     => 'klien',
            ]);

            Customer::create([
                'id_klien'              => $user->id,
                'nama'                  => $request->name,
                'alamat'                => $request->alamat,
                'telepon'               => $request->telepon,
                'status'                => 'aktif',
                'tariff_id'             => $tariff->id,
                'tarif_per_m3'          => $tariff->harga_per_m3,
                'meteran_terakhir'      => $request->meteran_awal,
                'tanggal_baca_terakhir' => now(),
            ]);

            return $user->load('customer');
        });

        return response()->json($user, 201);
    }

    public function update(Request $request, User $user): JsonResponse {
        if ($user->role !== 'klien') {
            return response()->json(['message' => 'Operator hanya dapat mengelola akun klien.'], 403);
        }

        $v = Validator::make($request->all(), [
            'name'     => 'sometimes|required|string|max:255',
            'email'    => 'sometimes|required|email|unique:users,email,' . $user->id,
            'password' => 'nullable|min:8',
        ]);
        if ($v->fails()) return response()->json(['errors' => $v->errors()], 422);

        $data = $request->only(['name', 'email']);
        if ($request->filled('password')) {
            $data['password'] = $request->password;
        }
        $user->update($data);

        return response()->json($user->fresh()->load('customer'));
    }

    public function destroy(User $user): JsonResponse {
        if ($user->role !== 'klien') {
            return response()->json(['message' => 'Operator hanya dapat mengelola akun klien.'], 403);
        }
        $user->delete();
        return response()->json(['message' => 'Akun klien berhasil dihapus.']);
    }
}
