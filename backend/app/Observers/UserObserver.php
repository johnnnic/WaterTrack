<?php
namespace App\Observers;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Facades\Auth;

class UserObserver {
    public function created(User $model): void {
        $this->log('create', $model, null, $model->toArray());
    }
    public function updated(User $model): void {
        $this->log('update', $model, $model->getOriginal(), $model->getChanges());
    }
    public function deleted(User $model): void {
        $this->log('delete', $model, $model->toArray(), null);
    }
    private function log(string $action, User $model, ?array $old, ?array $new): void {
        // Never log raw password values
        unset($old['password'], $new['password']);
        AuditLog::create([
            'user_id'      => Auth::id(),
            'action'       => $action,
            'subject_type' => 'User',
            'subject_id'   => $model->id,
            'old_values'   => $old,
            'new_values'   => $new,
            'ip_address'   => request()->ip() ?? 'system',
            'created_at'   => now(),
        ]);
    }
}
