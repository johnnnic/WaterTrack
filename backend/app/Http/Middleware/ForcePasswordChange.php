<?php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class ForcePasswordChange {
    public function handle(Request $request, Closure $next): Response {
        $user = Auth::user();
        if ($user && $user->role === 'klien' && $user->password_changed_at === null) {
            return response()->json(['require_password_change' => true], 403);
        }
        return $next($request);
    }
}
