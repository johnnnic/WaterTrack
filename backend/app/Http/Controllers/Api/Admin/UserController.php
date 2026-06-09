<?php
namespace App\Http\Controllers\Api\Admin;

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
        return response()->json(User::with('customer')->latest()->paginate(15));
    }

    public function show(User $user): JsonResponse {
        return response()->json($user->load('customer'));
    }

    public function store(Request $request): JsonResponse {
        $v = Validator::make($request->all(), [
            'name'         => 'required|string|max:255',
            'email'        => 'required|email|unique:users,email',
            'password'     => 'required|min:8',
            'role'         => 'required|in:admin,operator,kasir,klien',
            'alamat'       => 'required_if:role,klien|string',
            'telepon'      => 'nullable|string',
            'tariff_id'    => 'required_if:role,klien|exists:tariffs,id',
            'meteran_awal' => 'required_if:role,klien|integer|min:0',
        ]);
        if ($v->fails()) return response()->json(['errors' => $v->errors()], 422);

        if ($request->role === 'klien') {
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

        $user = User::create([
            'name'                => $request->name,
            'email'               => $request->email,
            'password'            => $request->password,
            'role'                => $request->role,
            'password_changed_at' => now(),
        ]);

        return response()->json($user, 201);
    }

    public function update(Request $request, User $user): JsonResponse {
        $v = Validator::make($request->all(), [
            'name'     => 'sometimes|required|string|max:255',
            'email'    => 'sometimes|required|email|unique:users,email,' . $user->id,
            'password' => 'nullable|min:8',
            'role'     => 'sometimes|required|in:admin,operator,kasir,klien',
        ]);
        if ($v->fails()) return response()->json(['errors' => $v->errors()], 422);

        $data = $request->only(['name', 'email', 'role']);
        if ($request->filled('password')) {
            $data['password'] = $request->password;
        }
        $user->update($data);

        return response()->json($user->fresh()->load('customer'));
    }

    public function destroy(User $user): JsonResponse {
        if ($user->id === auth()->id()) {
            return response()->json(['message' => 'Tidak dapat menghapus akun sendiri.'], 422);
        }
        $user->delete();
        return response()->json(['message' => 'User berhasil dihapus.']);
    }
}
