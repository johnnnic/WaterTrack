<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller {
    public function login(Request $request): JsonResponse {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Email atau password salah.'], 401);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        AuditLog::create([
            'user_id'    => $user->id,
            'action'     => 'login',
            'ip_address' => $request->ip(),
            'created_at' => now(),
        ]);

        return response()->json([
            'access_token' => $token,
            'token_type'   => 'Bearer',
            'user'         => $user,
        ]);
    }

    public function logout(Request $request): JsonResponse {
        AuditLog::create([
            'user_id'    => $request->user()->id,
            'action'     => 'logout',
            'ip_address' => $request->ip(),
            'created_at' => now(),
        ]);
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Berhasil logout.']);
    }

    public function changePassword(Request $request): JsonResponse {
        $request->validate([
            'current_password' => 'required',
            'new_password'     => 'required|min:8|confirmed',
        ]);

        $user = $request->user();

        if (!Hash::check($request->current_password, $user->password)) {
            return response()->json(['message' => 'Password saat ini salah.'], 422);
        }

        if (Hash::check($request->new_password, $user->password)) {
            return response()->json(['message' => 'Password baru tidak boleh sama dengan yang lama.'], 422);
        }

        $user->update([
            'password'            => Hash::make($request->new_password),
            'password_changed_at' => now(),
        ]);

        return response()->json([
            'message' => 'Password berhasil diubah.',
            'user'    => $user->fresh(),
        ]);
    }
}
