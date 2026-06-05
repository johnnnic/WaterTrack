<?php
namespace App\Providers;

use App\Models\Bill;
use App\Models\Customer;
use App\Models\Payment;
use App\Models\User;
use App\Observers\BillObserver;
use App\Observers\CustomerObserver;
use App\Observers\PaymentObserver;
use App\Observers\UserObserver;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider {
    public function register(): void {}

    public function boot(): void {
        User::observe(UserObserver::class);
        Customer::observe(CustomerObserver::class);
        Bill::observe(BillObserver::class);
        Payment::observe(PaymentObserver::class);
    }
}
