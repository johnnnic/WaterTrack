<?php
namespace App\Observers;

use App\Models\AuditLog;
use App\Models\Customer;
use Illuminate\Support\Facades\Auth;

class CustomerObserver {
    public function created(Customer $model): void  { $this->log('create', $model, null, $model->toArray()); }
    public function updated(Customer $model): void  { $this->log('update', $model, $model->getOriginal(), $model->getChanges()); }
    public function deleted(Customer $model): void  { $this->log('delete', $model, $model->toArray(), null); }
    private function log(string $action, Customer $model, ?array $old, ?array $new): void {
        AuditLog::create([
            'user_id'      => Auth::id(),
            'action'       => $action,
            'subject_type' => 'Customer',
            'subject_id'   => $model->id,
            'old_values'   => $old,
            'new_values'   => $new,
            'ip_address'   => request()->ip() ?? 'system',
            'created_at'   => now(),
        ]);
    }
}
