<?php
namespace App\Observers;

use App\Models\AuditLog;
use App\Models\Bill;
use Illuminate\Support\Facades\Auth;

class BillObserver {
    public function created(Bill $model): void  { $this->log('create', $model, null, $model->toArray()); }
    public function updated(Bill $model): void  { $this->log('update', $model, $model->getOriginal(), $model->getChanges()); }
    public function deleted(Bill $model): void  { $this->log('delete', $model, $model->toArray(), null); }
    private function log(string $action, Bill $model, ?array $old, ?array $new): void {
        AuditLog::create([
            'user_id'      => Auth::id(),
            'action'       => $action,
            'subject_type' => 'Bill',
            'subject_id'   => $model->id,
            'old_values'   => $old,
            'new_values'   => $new,
            'ip_address'   => request()->ip(),
            'created_at'   => now(),
        ]);
    }
}
