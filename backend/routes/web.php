<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// ALB health check — no auth, confirms PHP-FPM is alive
Route::get('/health', function () {
    return response()->json(['status' => 'ok'], 200);
});
