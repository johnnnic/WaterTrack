<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\KasirController;
use App\Http\Controllers\Api\KlienController;
use App\Http\Controllers\Api\Operator\MeteranController;

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::put('/user/password', [AuthController::class, 'changePassword']);
    Route::get('/user', fn(Request $r) => $r->user());
    Route::get('/tariffs', [\App\Http\Controllers\Api\Admin\TariffController::class, 'index']);

    // Kasir + Admin routes
    Route::middleware('role:admin,kasir')->prefix('kasir')->group(function () {
        Route::post('/cek-tagihan', [KasirController::class, 'cekTagihan']);
        Route::post('/bayar', [KasirController::class, 'bayar']);
        Route::get('/unpaid-bills', [KasirController::class, 'unpaidBills']);
        Route::get('/pending-requests', [KasirController::class, 'pendingRequests']);
        Route::put('/bills/{bill}/confirm', [KasirController::class, 'confirmPayment']);
        Route::get('/payments/stats', [KasirController::class, 'paymentStats']);
        Route::get('/payments', [KasirController::class, 'payments']);
        Route::get('/payments/{payment}', [KasirController::class, 'showPayment']);
        Route::put('/payments/{payment}', [KasirController::class, 'updatePayment']);
        Route::delete('/payments/{payment}', [KasirController::class, 'deletePayment']);
    });

    // Operator + Admin routes
    Route::middleware('role:admin,operator')->prefix('operator')->group(function () {
        Route::post('/catat-meteran', [MeteranController::class, 'catatMeteran']);
        Route::post('/catat-meteran/bulk', [MeteranController::class, 'catatMeteranBulk']);
        Route::get('/meter-template/{periode}', [MeteranController::class, 'templateMeteran']);
        Route::post('/customer-info', [MeteranController::class, 'getCustomerInfo']);
        Route::post('/bills/generate', [\App\Http\Controllers\Api\Operator\BillController::class, 'generateBills']);
        Route::apiResource('/users', \App\Http\Controllers\Api\Operator\UserController::class)->names('operator.users');
        Route::apiResource('/bills', \App\Http\Controllers\Api\Operator\BillController::class)->names('operator.bills');
        // Operator: view + update customers only (no create/delete — admin only)
        Route::get('/customers', [\App\Http\Controllers\Api\Admin\CustomerController::class, 'index']);
        Route::get('/customers/{customer}', [\App\Http\Controllers\Api\Admin\CustomerController::class, 'show']);
        Route::put('/customers/{customer}', [\App\Http\Controllers\Api\Admin\CustomerController::class, 'update']);
    });

    // Admin-only routes
    Route::middleware('role:admin')->prefix('admin')->group(function () {
        Route::apiResource('/users', \App\Http\Controllers\Api\Admin\UserController::class)->names('admin.users');
        Route::get('/audit-logs', [\App\Http\Controllers\Api\Admin\AuditLogController::class, 'index']);
        Route::apiResource('/tariffs', \App\Http\Controllers\Api\Admin\TariffController::class);
        Route::apiResource('/customers', \App\Http\Controllers\Api\Admin\CustomerController::class);
        Route::post('/bills/generate', [\App\Http\Controllers\Api\Admin\BillController::class, 'generateBills']);
        Route::apiResource('/bills', \App\Http\Controllers\Api\Admin\BillController::class)->names('admin.bills');
        Route::get('/payments/stats', [\App\Http\Controllers\Api\Admin\PaymentController::class, 'stats']);
        Route::get('/payments/recent', [\App\Http\Controllers\Api\Admin\PaymentController::class, 'recent']);
        Route::apiResource('/payments', \App\Http\Controllers\Api\Admin\PaymentController::class);
        Route::get('/dashboard/stats', [\App\Http\Controllers\Api\Admin\DashboardController::class, 'stats']);
        Route::get('/dashboard/activities', [\App\Http\Controllers\Api\Admin\DashboardController::class, 'recentActivities']);
    });

    // Klien routes
    Route::middleware(['role:klien', 'force.password.change'])->prefix('klien')->group(function () {
        Route::get('/profile', [KlienController::class, 'profile']);
        Route::get('/bills', [KlienController::class, 'bills']);
        Route::put('/bills/{bill}/request-payment', [KlienController::class, 'requestPayment']);
        Route::get('/bills/{bill}/pdf', [KlienController::class, 'billPdf']);
    });
});
