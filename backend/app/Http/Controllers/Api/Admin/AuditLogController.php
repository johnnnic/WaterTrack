<?php
namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller {
    public function index(Request $request): JsonResponse {
        $request->validate([
            'user_id'      => 'sometimes|integer',
            'action'       => 'sometimes|string|max:50',
            'subject_type' => 'sometimes|string|max:50',
            'date_from'    => 'sometimes|date',
            'date_to'      => 'sometimes|date|after_or_equal:date_from',
        ]);

        $q = AuditLog::with('user')->latest('created_at');

        if ($request->filled('user_id'))     $q->where('user_id', $request->user_id);
        if ($request->filled('action'))       $q->where('action', $request->action);
        if ($request->filled('subject_type')) $q->where('subject_type', $request->subject_type);
        if ($request->filled('date_from'))    $q->whereDate('created_at', '>=', $request->date_from);
        if ($request->filled('date_to'))      $q->whereDate('created_at', '<=', $request->date_to);

        return response()->json($q->paginate(20));
    }
}
