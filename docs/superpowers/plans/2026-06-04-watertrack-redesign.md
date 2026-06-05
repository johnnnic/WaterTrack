# WaterTrack Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Water Billing app into WaterTrack — adding `klien` role, full user management, audit logging, payment request flow, CSV import, and rebranding.

**Architecture:** Schema-extend on an undeployed app — modify original migrations and run `migrate:fresh --seed`. No Docker/active DB locally — verify via PHPUnit (SQLite in-memory, already configured in `phpunit.xml`) and `npx tsc --noEmit` for frontend.

**Tech Stack:** Laravel 12, Sanctum, PHP 8.2, React 18, TypeScript, Vite, Tailwind, shadcn/ui

**Parallelization map:**
- Phase 1 (Tasks 1–3): sequential — all others depend on these
- Phase 2 (Tasks 4–9): backend controllers — fully parallel among themselves
- Phase 3 (Task 10): routes — depends on Phase 2
- Phase 4 (Task 11): frontend types+context — parallel with Phase 2
- Phase 5 (Tasks 12–16): frontend pages — parallel, depend on Task 11
- Phase 6 (Task 17): final wiring — depends on Tasks 12–16
- Phase 7 (Tasks 18–19): verification — final

---

## Phase 1 — Foundation (Sequential)

### Task 1: Update Migrations & Seeder

**Files:**
- Modify: `backend/database/migrations/0001_01_01_000000_create_users_table.php`
- Modify: `backend/database/migrations/2025_07_30_215345_create_bills_table.php`
- Create: `backend/database/migrations/2026_06_05_000001_create_audit_logs_table.php`
- Modify: `backend/database/seeders/DatabaseSeeder.php`
- Modify: `backend/database/seeders/UserSeeder.php`

- [ ] **Step 1: Update users migration** — add `klien` to role enum, add `customer_id` and `password_changed_at`

In `0001_01_01_000000_create_users_table.php`, replace the `up()` Schema::create('users') block:
```php
Schema::create('users', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->string('email')->unique();
    $table->enum('role', ['admin', 'operator', 'kasir', 'klien'])->default('kasir');
    $table->unsignedBigInteger('customer_id')->nullable()->unique();
    $table->timestamp('password_changed_at')->nullable();
    $table->timestamp('email_verified_at')->nullable();
    $table->string('password');
    $table->rememberToken();
    $table->timestamps();
});
```

- [ ] **Step 2: Update bills migration** — add `menunggu_konfirmasi` status and `requested_metode_pembayaran`

In `2025_07_30_215345_create_bills_table.php`, replace the enum line and add new column:
```php
$table->enum('status', ['belum_bayar', 'menunggu_konfirmasi', 'sudah_bayar'])->default('belum_bayar');
$table->string('requested_metode_pembayaran')->nullable();
```
(Add `requested_metode_pembayaran` before `tanggal_jatuh_tempo`)

- [ ] **Step 3: Create audit_logs migration**

Create `backend/database/migrations/2026_06_05_000001_create_audit_logs_table.php`:
```php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('action');
            $table->string('subject_type')->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->string('ip_address')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }
    public function down(): void { Schema::dropIfExists('audit_logs'); }
};
```

- [ ] **Step 4: Update DatabaseSeeder** — only UserSeeder

```php
<?php
namespace Database\Seeders;
use Illuminate\Database\Seeder;
class DatabaseSeeder extends Seeder {
    public function run(): void { $this->call([UserSeeder::class]); }
}
```

- [ ] **Step 5: Update UserSeeder** — single admin only

```php
<?php
namespace Database\Seeders;
use App\Models\User;
use Illuminate\Database\Seeder;
class UserSeeder extends Seeder {
    public function run(): void {
        User::create([
            'name' => 'Admin WaterTrack',
            'email' => 'admin@watertrack.id',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'password_changed_at' => now(),
        ]);
    }
}
```

- [ ] **Step 6: PHP lint check**
```bash
cd backend && php -l database/migrations/2026_06_05_000001_create_audit_logs_table.php
```
Expected: `No syntax errors detected`

- [ ] **Step 7: Commit**
```bash
git add backend/database/
git commit -m "feat: update migrations and seeder for WaterTrack redesign"
```

---

### Task 2: Update Models

**Files:**
- Modify: `backend/app/Models/User.php`
- Modify: `backend/app/Models/Bill.php`
- Modify: `backend/app/Models/Customer.php`
- Create: `backend/app/Models/AuditLog.php`

- [ ] **Step 1: Replace User.php**
```php
<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable {
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = ['name', 'email', 'password', 'role', 'customer_id', 'password_changed_at'];
    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array {
        return [
            'email_verified_at'   => 'datetime',
            'password'            => 'hashed',
            'password_changed_at' => 'datetime',
        ];
    }

    public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }
    public function payments(): HasMany   { return $this->hasMany(Payment::class); }
}
```

- [ ] **Step 2: Update Bill.php** — add `requested_metode_pembayaran` to fillable, add `isPending()`

Add `'requested_metode_pembayaran'` to `$fillable` array. Add method:
```php
public function isPending(): bool { return $this->status === 'menunggu_konfirmasi'; }
```

- [ ] **Step 3: Update Customer.php** — add `hasOne(User)`, fix `getTagihanTerakhir`

Add import: `use Illuminate\Database\Eloquent\Relations\HasOne;`

Add methods:
```php
public function user(): HasOne { return $this->hasOne(User::class); }

public function getTagihanTerakhir() {
    return $this->bills()
        ->whereIn('status', ['belum_bayar', 'menunggu_konfirmasi'])
        ->orderBy('periode', 'desc')
        ->first();
}
```
(Replace the old `getTagihanTerakhir` that only checked `belum_bayar`)

- [ ] **Step 4: Create AuditLog.php**
```php
<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model {
    public $timestamps = false;
    protected $guarded = [];
    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
        'created_at' => 'datetime',
    ];
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
```

- [ ] **Step 5: PHP lint**
```bash
cd backend && php -l app/Models/User.php && php -l app/Models/AuditLog.php && php -l app/Models/Customer.php
```

- [ ] **Step 6: Commit**
```bash
git add backend/app/Models/
git commit -m "feat: update User, Bill, Customer models; add AuditLog"
```

---

### Task 3: Middleware + Bootstrap

**Files:**
- Create: `backend/app/Http/Middleware/CheckRole.php`
- Create: `backend/app/Http/Middleware/ForcePasswordChange.php`
- Modify: `backend/bootstrap/app.php`

- [ ] **Step 1: Create CheckRole.php**
```php
<?php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class CheckRole {
    public function handle(Request $request, Closure $next, string ...$roles): Response {
        if (!Auth::check() || !in_array(Auth::user()->role, $roles)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        return $next($request);
    }
}
```

- [ ] **Step 2: Create ForcePasswordChange.php**
```php
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
```

- [ ] **Step 3: Register aliases in bootstrap/app.php** — replace the withMiddleware closure:
```php
->withMiddleware(function (Middleware $middleware): void {
    $middleware->alias([
        'role'                  => \App\Http\Middleware\CheckRole::class,
        'force.password.change' => \App\Http\Middleware\ForcePasswordChange::class,
    ]);
})
```

- [ ] **Step 4: PHP lint**
```bash
cd backend && php -l app/Http/Middleware/CheckRole.php && php -l app/Http/Middleware/ForcePasswordChange.php
```

- [ ] **Step 5: Commit**
```bash
git add backend/app/Http/Middleware/ backend/bootstrap/app.php
git commit -m "feat: add CheckRole and ForcePasswordChange middleware"
```

---

## Phase 2 — Backend Controllers (Parallel)

### Task 4: Fix AuthController + changePassword

**Files:** Modify `backend/app/Http/Controllers/Api/AuthController.php`

- [ ] **Step 1: Replace AuthController.php**
```php
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
        $request->validate(['email' => 'required|email', 'password' => 'required']);

        $user = User::where('email', $request->email)->first();
        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Email atau password salah.'], 401);
        }

        $token = $user->createToken('auth_token')->plainTextToken;
        AuditLog::create(['user_id' => $user->id, 'action' => 'login', 'ip_address' => $request->ip(), 'created_at' => now()]);

        return response()->json(['access_token' => $token, 'token_type' => 'Bearer', 'user' => $user]);
    }

    public function logout(Request $request): JsonResponse {
        AuditLog::create(['user_id' => $request->user()->id, 'action' => 'logout', 'ip_address' => $request->ip(), 'created_at' => now()]);
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

        $user->update(['password' => $request->new_password, 'password_changed_at' => now()]);
        return response()->json(['message' => 'Password berhasil diubah.', 'user' => $user->fresh()]);
    }
}
```

- [ ] **Step 2: Write test** — create `backend/tests/Feature/AuthControllerTest.php`
```php
<?php
namespace Tests\Feature;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthControllerTest extends TestCase {
    use RefreshDatabase;

    public function test_login_success(): void {
        User::create(['name' => 'A', 'email' => 'a@a.com', 'password' => bcrypt('secret123'), 'role' => 'admin', 'password_changed_at' => now()]);
        $this->postJson('/api/login', ['email' => 'a@a.com', 'password' => 'secret123'])
             ->assertStatus(200)->assertJsonStructure(['access_token', 'user']);
    }

    public function test_login_wrong_password(): void {
        User::create(['name' => 'B', 'email' => 'b@b.com', 'password' => bcrypt('correct'), 'role' => 'kasir', 'password_changed_at' => now()]);
        $this->postJson('/api/login', ['email' => 'b@b.com', 'password' => 'wrong'])->assertStatus(401);
    }

    public function test_change_password(): void {
        $user = User::create(['name' => 'C', 'email' => 'c@c.com', 'password' => bcrypt('oldpass1'), 'role' => 'admin', 'password_changed_at' => now()]);
        $token = $user->createToken('t')->plainTextToken;
        $this->withToken($token)->putJson('/api/user/password', [
            'current_password' => 'oldpass1', 'new_password' => 'newpass99', 'new_password_confirmation' => 'newpass99',
        ])->assertStatus(200)->assertJson(['message' => 'Password berhasil diubah.']);
    }
}
```

- [ ] **Step 3: Run tests**
```bash
cd backend && php artisan test tests/Feature/AuthControllerTest.php
```
Expected: 3 tests pass

- [ ] **Step 4: Commit**
```bash
git add backend/app/Http/Controllers/Api/AuthController.php backend/tests/Feature/AuthControllerTest.php
git commit -m "fix: AuthController - Hash::check, user in response, changePassword"
```

---

### Task 5: Admin\UserController

**Files:** Create `backend/app/Http/Controllers/Api/Admin/UserController.php`

- [ ] **Step 1: Create the controller**
```php
<?php
namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class UserController extends Controller {
    public function index(): JsonResponse {
        return response()->json(User::with('customer')->latest()->paginate(15));
    }

    public function show(User $user): JsonResponse {
        return response()->json($user->load('customer'));
    }

    public function store(Request $request): JsonResponse {
        $v = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|min:8',
            'role' => 'required|in:admin,operator,kasir,klien',
            'alamat' => 'required_if:role,klien|string',
            'telepon' => 'nullable|string',
            'tarif_per_m3' => 'required_if:role,klien|numeric|min:0',
            'meteran_awal' => 'required_if:role,klien|integer|min:0',
        ]);
        if ($v->fails()) return response()->json(['errors' => $v->errors()], 422);

        if ($request->role === 'klien') {
            $user = DB::transaction(function () use ($request) {
                do { $nomor = Str::upper(Str::random(6)); }
                while (Customer::where('nomor_langganan', $nomor)->exists());

                $customer = Customer::create([
                    'nomor_langganan' => $nomor, 'nama' => $request->name,
                    'alamat' => $request->alamat, 'telepon' => $request->telepon,
                    'status' => 'aktif', 'tarif_per_m3' => $request->tarif_per_m3,
                    'meteran_terakhir' => $request->meteran_awal, 'tanggal_baca_terakhir' => now(),
                ]);
                return User::create([
                    'name' => $request->name, 'email' => $request->email,
                    'password' => $request->password, 'role' => 'klien',
                    'customer_id' => $customer->id,
                    // password_changed_at = null → forced change on first login
                ]);
            });
            return response()->json($user->load('customer'), 201);
        }

        $user = User::create([
            'name' => $request->name, 'email' => $request->email,
            'password' => $request->password, 'role' => $request->role,
            'password_changed_at' => now(),
        ]);
        return response()->json($user, 201);
    }

    public function update(Request $request, User $user): JsonResponse {
        $v = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'email' => 'sometimes|required|email|unique:users,email,' . $user->id,
            'password' => 'nullable|min:8',
            'role' => 'sometimes|required|in:admin,operator,kasir,klien',
        ]);
        if ($v->fails()) return response()->json(['errors' => $v->errors()], 422);

        $data = $request->only(['name', 'email', 'role']);
        if ($request->filled('password')) $data['password'] = $request->password;
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
```

- [ ] **Step 2: Write test** — create `backend/tests/Feature/Admin/UserControllerTest.php`
```php
<?php
namespace Tests\Feature\Admin;
use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserControllerTest extends TestCase {
    use RefreshDatabase;

    private function adminToken(): string {
        $a = User::create(['name' => 'Admin', 'email' => 'a@a.com', 'password' => bcrypt('p'), 'role' => 'admin', 'password_changed_at' => now()]);
        return $a->createToken('t')->plainTextToken;
    }

    public function test_store_klien_creates_user_and_customer(): void {
        $r = $this->withToken($this->adminToken())->postJson('/api/admin/users', [
            'name' => 'Budi', 'email' => 'budi@mail.com', 'password' => 'secret123',
            'role' => 'klien', 'alamat' => 'Jl. A', 'tarif_per_m3' => 5000, 'meteran_awal' => 100,
        ]);
        $r->assertStatus(201);
        $this->assertDatabaseHas('users', ['email' => 'budi@mail.com', 'role' => 'klien']);
        $this->assertDatabaseCount('customers', 1);
        $this->assertNull(User::where('email', 'budi@mail.com')->first()->password_changed_at);
    }

    public function test_store_klien_missing_fields_returns_422(): void {
        $r = $this->withToken($this->adminToken())->postJson('/api/admin/users', [
            'name' => 'X', 'email' => 'x@mail.com', 'password' => 'secret123', 'role' => 'klien',
            // missing alamat, tarif_per_m3
        ]);
        $r->assertStatus(422);
        $this->assertDatabaseMissing('users', ['email' => 'x@mail.com']);
        $this->assertDatabaseCount('customers', 0);
    }

    public function test_destroy_cannot_delete_self(): void {
        $admin = User::create(['name' => 'A', 'email' => 'self@a.com', 'password' => bcrypt('p'), 'role' => 'admin', 'password_changed_at' => now()]);
        $this->withToken($admin->createToken('t')->plainTextToken)->deleteJson('/api/admin/users/' . $admin->id)->assertStatus(422);
    }
}
```

- [ ] **Step 3: Commit**
```bash
git add backend/app/Http/Controllers/Api/Admin/UserController.php backend/tests/Feature/Admin/
git commit -m "feat: add Admin\\UserController with klien DB transaction"
```

---

### Task 6: Audit Log System

**Files:**
- Create: `backend/app/Observers/UserObserver.php`
- Create: `backend/app/Observers/CustomerObserver.php`
- Create: `backend/app/Observers/BillObserver.php`
- Create: `backend/app/Observers/PaymentObserver.php`
- Create: `backend/app/Http/Controllers/Api/Admin/AuditLogController.php`
- Modify: `backend/app/Providers/AppServiceProvider.php`

- [ ] **Step 1: Create UserObserver.php**
```php
<?php
namespace App\Observers;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Facades\Auth;

class UserObserver {
    public function created(User $m): void { $this->log('create', $m, null, $m->toArray()); }
    public function updated(User $m): void { $this->log('update', $m, $m->getOriginal(), $m->getChanges()); }
    public function deleted(User $m): void  { $this->log('delete', $m, $m->toArray(), null); }
    private function log(string $action, User $m, ?array $old, ?array $new): void {
        unset($old['password'], $new['password']); // never log password
        AuditLog::create(['user_id' => Auth::id(), 'action' => $action, 'subject_type' => 'User',
            'subject_id' => $m->id, 'old_values' => $old, 'new_values' => $new,
            'ip_address' => request()->ip() ?? 'system', 'created_at' => now()]);
    }
}
```

- [ ] **Step 2: Create CustomerObserver.php, BillObserver.php, PaymentObserver.php**

Each follows the same structure — change the class name, model type hint, and `subject_type` string:

`CustomerObserver` → `subject_type = 'Customer'`, model type `Customer`
`BillObserver` → `subject_type = 'Bill'`, model type `Bill`
`PaymentObserver` → `subject_type = 'Payment'`, model type `Payment`

Template (replace class name, use statement, and subject_type):
```php
<?php
namespace App\Observers;
use App\Models\AuditLog;
use App\Models\Customer; // change per observer
use Illuminate\Support\Facades\Auth;

class CustomerObserver { // change class name
    public function created(Customer $m): void { $this->log('create', $m, null, $m->toArray()); }
    public function updated(Customer $m): void { $this->log('update', $m, $m->getOriginal(), $m->getChanges()); }
    public function deleted(Customer $m): void  { $this->log('delete', $m, $m->toArray(), null); }
    private function log(string $action, $m, ?array $old, ?array $new): void {
        AuditLog::create(['user_id' => Auth::id(), 'action' => $action, 'subject_type' => 'Customer',
            'subject_id' => $m->id, 'old_values' => $old, 'new_values' => $new,
            'ip_address' => request()->ip() ?? 'system', 'created_at' => now()]);
    }
}
```

- [ ] **Step 3: Create AuditLogController.php**
```php
<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller {
    public function index(Request $request): JsonResponse {
        $q = AuditLog::with('user')->latest('created_at');
        if ($request->filled('user_id'))     $q->where('user_id', $request->user_id);
        if ($request->filled('action'))       $q->where('action', $request->action);
        if ($request->filled('subject_type')) $q->where('subject_type', $request->subject_type);
        if ($request->filled('date_from'))    $q->whereDate('created_at', '>=', $request->date_from);
        if ($request->filled('date_to'))      $q->whereDate('created_at', '<=', $request->date_to);
        return response()->json($q->paginate(20));
    }
}
```

- [ ] **Step 4: Register observers in AppServiceProvider.php**
```php
<?php
namespace App\Providers;
use App\Models\{Bill, Customer, Payment, User};
use App\Observers\{BillObserver, CustomerObserver, PaymentObserver, UserObserver};
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
```

- [ ] **Step 5: PHP lint**
```bash
cd backend && php -l app/Observers/UserObserver.php && php -l app/Providers/AppServiceProvider.php
```

- [ ] **Step 6: Commit**
```bash
git add backend/app/Observers/ backend/app/Http/Controllers/Api/Admin/AuditLogController.php backend/app/Providers/AppServiceProvider.php
git commit -m "feat: add model observers and AuditLogController"
```

---

### Task 7: Operator Controllers

**Files:**
- Create: `backend/app/Http/Controllers/Api/Operator/UserController.php`
- Create: `backend/app/Http/Controllers/Api/Operator/BillController.php`

- [ ] **Step 1: Create Operator\UserController.php** — CRUD restricted to klien role only
```php
<?php
namespace App\Http\Controllers\Api\Operator;
use App\Http\Controllers\Controller;
use App\Models\{Customer, User};
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Facades\{DB, Validator};
use Illuminate\Support\Str;

class UserController extends Controller {
    public function index(): JsonResponse {
        return response()->json(User::where('role', 'klien')->with('customer')->latest()->paginate(15));
    }

    public function show(User $user): JsonResponse {
        if ($user->role !== 'klien') return response()->json(['message' => 'Tidak ditemukan.'], 404);
        return response()->json($user->load('customer'));
    }

    public function store(Request $request): JsonResponse {
        $v = Validator::make($request->all(), [
            'name' => 'required|string|max:255', 'email' => 'required|email|unique:users,email',
            'password' => 'required|min:8', 'alamat' => 'required|string',
            'telepon' => 'nullable|string', 'tarif_per_m3' => 'required|numeric|min:0',
            'meteran_awal' => 'required|integer|min:0',
        ]);
        if ($v->fails()) return response()->json(['errors' => $v->errors()], 422);

        $user = DB::transaction(function () use ($request) {
            do { $nomor = Str::upper(Str::random(6)); }
            while (Customer::where('nomor_langganan', $nomor)->exists());

            $customer = Customer::create([
                'nomor_langganan' => $nomor, 'nama' => $request->name,
                'alamat' => $request->alamat, 'telepon' => $request->telepon,
                'status' => 'aktif', 'tarif_per_m3' => $request->tarif_per_m3,
                'meteran_terakhir' => $request->meteran_awal, 'tanggal_baca_terakhir' => now(),
            ]);
            return User::create([
                'name' => $request->name, 'email' => $request->email,
                'password' => $request->password, 'role' => 'klien',
                'customer_id' => $customer->id,
            ]);
        });
        return response()->json($user->load('customer'), 201);
    }

    public function update(Request $request, User $user): JsonResponse {
        if ($user->role !== 'klien') return response()->json(['message' => 'Hanya dapat mengelola akun klien.'], 403);

        $v = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'email' => 'sometimes|required|email|unique:users,email,' . $user->id,
            'password' => 'nullable|min:8',
        ]);
        if ($v->fails()) return response()->json(['errors' => $v->errors()], 422);

        $data = $request->only(['name', 'email']);
        if ($request->filled('password')) $data['password'] = $request->password;
        $user->update($data);
        return response()->json($user->fresh()->load('customer'));
    }

    public function destroy(User $user): JsonResponse {
        if ($user->role !== 'klien') return response()->json(['message' => 'Hanya dapat mengelola akun klien.'], 403);
        $user->delete();
        return response()->json(['message' => 'Akun klien berhasil dihapus.']);
    }
}
```

- [ ] **Step 2: Create Operator\BillController.php** — same logic as Admin\BillController, includes `menunggu_konfirmasi`
```php
<?php
namespace App\Http\Controllers\Api\Operator;
use App\Http\Controllers\Controller;
use App\Models\{Bill, Customer};
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Facades\Validator;

class BillController extends Controller {
    public function index(): JsonResponse {
        return response()->json(Bill::with(['customer:id,nomor_langganan,nama'])->latest()->paginate(15));
    }

    public function store(Request $request): JsonResponse {
        $v = Validator::make($request->all(), [
            'customer_id' => 'required|exists:customers,id', 'periode' => 'required|string',
            'meteran_awal' => 'required|integer|min:0', 'meteran_akhir' => 'required|integer|min:0',
            'tarif_per_m3' => 'required|numeric|min:0', 'tanggal_jatuh_tempo' => 'required|date',
        ]);
        if ($v->fails()) return response()->json($v->errors(), 422);
        $d = $v->validated();
        $d['pemakaian'] = $d['meteran_akhir'] - $d['meteran_awal'];
        $d['jumlah_tagihan'] = $d['pemakaian'] * $d['tarif_per_m3'];
        return response()->json(Bill::create($d)->load('customer'), 201);
    }

    public function show(Bill $bill): JsonResponse {
        return response()->json($bill->load('customer', 'payments'));
    }

    public function update(Request $request, Bill $bill): JsonResponse {
        $v = Validator::make($request->all(), [
            'customer_id' => 'required|exists:customers,id', 'periode' => 'required|string',
            'meteran_awal' => 'required|integer|min:0', 'meteran_akhir' => 'required|integer|min:0',
            'tarif_per_m3' => 'required|numeric|min:0', 'tanggal_jatuh_tempo' => 'required|date',
            'status' => 'required|in:belum_bayar,menunggu_konfirmasi,sudah_bayar',
        ]);
        if ($v->fails()) return response()->json($v->errors(), 422);
        $d = $v->validated();
        $d['pemakaian'] = $d['meteran_akhir'] - $d['meteran_awal'];
        $d['jumlah_tagihan'] = $d['pemakaian'] * $d['tarif_per_m3'];
        $bill->update($d);
        return response()->json($bill->load('customer'));
    }

    public function destroy(Bill $bill): JsonResponse {
        $bill->delete();
        return response()->json(['message' => 'Tagihan berhasil dihapus.']);
    }

    public function generateBills(Request $request): JsonResponse {
        $v = Validator::make($request->all(), ['periode' => 'required|string', 'tanggal_jatuh_tempo' => 'required|date']);
        if ($v->fails()) return response()->json($v->errors(), 422);
        $created = 0;
        foreach (Customer::where('status', 'aktif')->get() as $c) {
            if (!Bill::where('customer_id', $c->id)->where('periode', $request->periode)->exists()) {
                Bill::create([
                    'customer_id' => $c->id, 'periode' => $request->periode,
                    'meteran_awal' => $c->meteran_terakhir, 'meteran_akhir' => $c->meteran_terakhir,
                    'pemakaian' => 0, 'tarif_per_m3' => $c->tarif_per_m3, 'jumlah_tagihan' => 0,
                    'tanggal_jatuh_tempo' => $request->tanggal_jatuh_tempo,
                ]);
                $created++;
            }
        }
        return response()->json(['message' => "Generated {$created} bills", 'bills_created' => $created]);
    }
}
```

- [ ] **Step 3: PHP lint**
```bash
cd backend && php -l app/Http/Controllers/Api/Operator/UserController.php && php -l app/Http/Controllers/Api/Operator/BillController.php
```

- [ ] **Step 4: Commit**
```bash
git add backend/app/Http/Controllers/Api/Operator/
git commit -m "feat: add Operator\\UserController and Operator\\BillController"
```

---

### Task 8: KlienController

**Files:** Create `backend/app/Http/Controllers/Api/KlienController.php`

- [ ] **Step 1: Create KlienController.php**
```php
<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\Bill;
use Illuminate\Http\{JsonResponse, Request};

class KlienController extends Controller {
    public function profile(Request $request): JsonResponse {
        return response()->json(['user' => $request->user()->load('customer'), 'customer' => $request->user()->customer]);
    }

    public function bills(Request $request): JsonResponse {
        $cid = $request->user()->customer_id;
        if (!$cid) return response()->json(['message' => 'Data pelanggan tidak ditemukan.'], 404);
        return response()->json(Bill::where('customer_id', $cid)->orderBy('periode', 'desc')->paginate(15));
    }

    public function requestPayment(Request $request, Bill $bill): JsonResponse {
        $request->validate(['metode_pembayaran' => 'required|in:tunai,transfer,kartu']);

        if ($bill->customer_id !== $request->user()->customer_id) {
            return response()->json(['message' => 'Tagihan tidak ditemukan.'], 404);
        }
        if ($bill->status === 'menunggu_konfirmasi') {
            return response()->json(['message' => 'Permintaan pembayaran sudah diajukan.'], 422);
        }
        if ($bill->status === 'sudah_bayar') {
            return response()->json(['message' => 'Tagihan sudah lunas.'], 422);
        }

        $bill->update(['status' => 'menunggu_konfirmasi', 'requested_metode_pembayaran' => $request->metode_pembayaran]);
        return response()->json($bill);
    }

    public function billPdf(Request $request, Bill $bill): JsonResponse {
        if ($bill->customer_id !== $request->user()->customer_id) {
            return response()->json(['message' => 'Tagihan tidak ditemukan.'], 404);
        }
        return response()->json($bill->load('customer', 'payments'));
    }
}
```

- [ ] **Step 2: Write test** — create `backend/tests/Feature/KlienControllerTest.php`
```php
<?php
namespace Tests\Feature;
use App\Models\{Bill, Customer, User};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class KlienControllerTest extends TestCase {
    use RefreshDatabase;

    private function makeKlien(): array {
        $c = Customer::create(['nomor_langganan' => 'ABC123', 'nama' => 'K', 'alamat' => 'Jl.A',
            'status' => 'aktif', 'tarif_per_m3' => 5000, 'meteran_terakhir' => 100, 'tanggal_baca_terakhir' => now()]);
        $u = User::create(['name' => 'K', 'email' => 'k@k.com', 'password' => bcrypt('p'),
            'role' => 'klien', 'customer_id' => $c->id, 'password_changed_at' => now()]);
        return ['customer' => $c, 'user' => $u, 'token' => $u->createToken('t')->plainTextToken];
    }

    private function makeBill(int $customerId, string $status = 'belum_bayar'): Bill {
        return Bill::create(['customer_id' => $customerId, 'periode' => '2026-06',
            'meteran_awal' => 100, 'meteran_akhir' => 120, 'pemakaian' => 20,
            'tarif_per_m3' => 5000, 'jumlah_tagihan' => 100000,
            'status' => $status, 'tanggal_jatuh_tempo' => '2026-06-30']);
    }

    public function test_request_payment_success(): void {
        ['customer' => $c, 'token' => $t] = $this->makeKlien();
        $bill = $this->makeBill($c->id);
        $this->withToken($t)->putJson("/api/klien/bills/{$bill->id}/request-payment", ['metode_pembayaran' => 'transfer'])
             ->assertStatus(200);
        $this->assertDatabaseHas('bills', ['id' => $bill->id, 'status' => 'menunggu_konfirmasi']);
    }

    public function test_already_pending_returns_422(): void {
        ['customer' => $c, 'token' => $t] = $this->makeKlien();
        $bill = $this->makeBill($c->id, 'menunggu_konfirmasi');
        $this->withToken($t)->putJson("/api/klien/bills/{$bill->id}/request-payment", ['metode_pembayaran' => 'tunai'])
             ->assertStatus(422)->assertJson(['message' => 'Permintaan pembayaran sudah diajukan.']);
    }

    public function test_cannot_access_other_customer_bill(): void {
        ['token' => $t] = $this->makeKlien();
        $other = Customer::create(['nomor_langganan' => 'ZZZ999', 'nama' => 'X', 'alamat' => 'Jl.X',
            'status' => 'aktif', 'tarif_per_m3' => 5000, 'meteran_terakhir' => 50, 'tanggal_baca_terakhir' => now()]);
        $bill = $this->makeBill($other->id);
        $this->withToken($t)->putJson("/api/klien/bills/{$bill->id}/request-payment", ['metode_pembayaran' => 'tunai'])
             ->assertStatus(404);
    }
}
```

- [ ] **Step 3: Commit**
```bash
git add backend/app/Http/Controllers/Api/KlienController.php backend/tests/Feature/KlienControllerTest.php
git commit -m "feat: add KlienController with payment request flow"
```

---

### Task 9: Extend KasirController + CustomerController CSV

**Files:**
- Modify: `backend/app/Http/Controllers/Api/KasirController.php`
- Modify: `backend/app/Http/Controllers/Api/Admin/CustomerController.php`

- [ ] **Step 1: Add 5 methods to KasirController** — append after existing `bayar()` method

Add these imports at top if missing: `use App\Models\Payment;`

```php
public function unpaidBills(): JsonResponse {
    return response()->json(Bill::with(['customer:id,nomor_langganan,nama'])
        ->whereIn('status', ['belum_bayar', 'menunggu_konfirmasi'])->latest()->paginate(15));
}

public function pendingRequests(): JsonResponse {
    return response()->json(Bill::with(['customer:id,nomor_langganan,nama'])
        ->where('status', 'menunggu_konfirmasi')->latest()->paginate(15));
}

public function confirmPayment(Request $request, Bill $bill): JsonResponse {
    if ($bill->status === 'sudah_bayar') return response()->json(['message' => 'Tagihan sudah lunas.'], 422);
    if ($bill->status !== 'menunggu_konfirmasi') return response()->json(['message' => 'Tagihan tidak dalam status menunggu konfirmasi.'], 422);

    return DB::transaction(function () use ($bill) {
        $payment = Payment::create([
            'bill_id' => $bill->id, 'user_id' => Auth::id(),
            'jumlah_bayar' => $bill->jumlah_tagihan,
            'metode_pembayaran' => $bill->requested_metode_pembayaran ?? 'tunai',
            'tanggal_bayar' => now(), 'keterangan' => 'Konfirmasi pembayaran klien oleh kasir',
        ]);
        $bill->update(['status' => 'sudah_bayar']);
        return response()->json(['message' => 'Pembayaran dikonfirmasi.', 'payment' => $payment]);
    });
}

public function payments(): JsonResponse {
    return response()->json(Payment::with(['bill.customer:id,nomor_langganan,nama', 'user:id,name'])->latest()->paginate(15));
}

public function updatePayment(Request $request, Payment $payment): JsonResponse {
    $request->validate(['metode_pembayaran' => 'required|in:tunai,transfer,kartu', 'keterangan' => 'nullable|string']);
    $payment->update($request->only(['metode_pembayaran', 'keterangan']));
    return response()->json($payment);
}

public function deletePayment(Payment $payment): JsonResponse {
    return DB::transaction(function () use ($payment) {
        $bill = $payment->bill;
        $payment->delete();
        $bill->update(['status' => 'belum_bayar', 'requested_metode_pembayaran' => null]);
        return response()->json(['message' => 'Transaksi dihapus, tagihan dikembalikan ke belum bayar.']);
    });
}
```

- [ ] **Step 2: Update Admin\CustomerController** — replace `store()` and `import()` methods

Add `use Illuminate\Support\Str;` to the imports.

Replace `store()`:
```php
public function store(Request $request): JsonResponse {
    $v = Validator::make($request->all(), [
        'nama' => 'required|string|max:255', 'alamat' => 'required|string',
        'telepon' => 'nullable|string', 'status' => 'required|in:aktif,nonaktif',
        'tarif_per_m3' => 'required|numeric|min:0', 'meteran_terakhir' => 'required|integer|min:0',
        'tanggal_baca_terakhir' => 'nullable|date',
    ]);
    if ($v->fails()) return response()->json(['message' => 'Validation failed', 'errors' => $v->errors()], 422);

    do { $nomor = Str::upper(Str::random(6)); }
    while (Customer::where('nomor_langganan', $nomor)->exists());

    $data = $v->validated();
    $data['nomor_langganan'] = $nomor;
    return response()->json(Customer::create($data), 201);
}
```

Replace old `import()` with `importCsv()`:
```php
public function importCsv(Request $request): JsonResponse {
    $request->validate(['file' => 'required|file|mimetypes:text/csv,text/plain,application/csv,application/octet-stream']);

    $handle = fopen($request->file('file')->getPathname(), 'r');
    fgetcsv($handle); // skip header row: nama,alamat,telepon,tarif_per_m3,meteran_awal

    $success = 0; $errors = []; $row = 1;

    while (($line = fgetcsv($handle)) !== false) {
        $row++;
        if (count($line) < 4) { $errors[] = "Baris {$row}: Minimal 4 kolom"; continue; }
        [$nama, $alamat, $telepon, $tarif, $meteranAwal] = array_pad($line, 5, null);
        if (empty(trim($nama ?? '')) || !is_numeric($tarif)) { $errors[] = "Baris {$row}: Nama/tarif tidak valid"; continue; }

        try {
            do { $nomor = Str::upper(Str::random(6)); }
            while (Customer::where('nomor_langganan', $nomor)->exists());

            Customer::create([
                'nomor_langganan' => $nomor, 'nama' => trim($nama), 'alamat' => trim($alamat ?? ''),
                'telepon' => trim($telepon ?? ''), 'status' => 'aktif',
                'tarif_per_m3' => (float)$tarif, 'meteran_terakhir' => (int)($meteranAwal ?? 0),
                'tanggal_baca_terakhir' => now(),
            ]);
            $success++;
        } catch (\Exception $e) { $errors[] = "Baris {$row}: " . $e->getMessage(); }
    }
    fclose($handle);
    return response()->json(['berhasil' => $success, 'gagal' => count($errors), 'errors' => $errors]);
}
```

- [ ] **Step 3: PHP lint**
```bash
cd backend && php -l app/Http/Controllers/Api/KasirController.php && php -l app/Http/Controllers/Api/Admin/CustomerController.php
```

- [ ] **Step 4: Commit**
```bash
git add backend/app/Http/Controllers/Api/KasirController.php backend/app/Http/Controllers/Api/Admin/CustomerController.php
git commit -m "feat: extend KasirController; update CustomerController with CSV and auto-gen nomor_langganan"
```

---

## Phase 3 — Routes

### Task 10: Update routes/api.php

**Files:** Modify `backend/routes/api.php`

- [ ] **Step 1: Replace entire file**
```php
<?php
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\KasirController;
use App\Http\Controllers\Api\KlienController;
use App\Http\Controllers\OperatorController;

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::put('/user/password', [AuthController::class, 'changePassword']);
    Route::get('/user', fn(Request $r) => $r->user());

    Route::middleware('role:admin,kasir')->prefix('kasir')->group(function () {
        Route::post('/cek-tagihan', [KasirController::class, 'cekTagihan']);
        Route::post('/bayar', [KasirController::class, 'bayar']);
        Route::get('/unpaid-bills', [KasirController::class, 'unpaidBills']);
        Route::get('/pending-requests', [KasirController::class, 'pendingRequests']);
        Route::put('/bills/{bill}/confirm', [KasirController::class, 'confirmPayment']);
        Route::get('/payments', [KasirController::class, 'payments']);
        Route::put('/payments/{payment}', [KasirController::class, 'updatePayment']);
        Route::delete('/payments/{payment}', [KasirController::class, 'deletePayment']);
    });

    Route::middleware('role:admin,operator')->prefix('operator')->group(function () {
        Route::post('/catat-meteran', [OperatorController::class, 'catatMeteran']);
        Route::post('/customer-info', [OperatorController::class, 'getCustomerInfo']);
        Route::apiResource('users', \App\Http\Controllers\Api\Operator\UserController::class);
        Route::post('bills/generate', [\App\Http\Controllers\Api\Operator\BillController::class, 'generateBills']);
        Route::apiResource('bills', \App\Http\Controllers\Api\Operator\BillController::class);
    });

    Route::middleware('role:admin')->prefix('admin')->group(function () {
        Route::apiResource('users', \App\Http\Controllers\Api\Admin\UserController::class);
        Route::get('audit-logs', [\App\Http\Controllers\Api\Admin\AuditLogController::class, 'index']);
        Route::apiResource('tariffs', \App\Http\Controllers\Api\Admin\TariffController::class);
        Route::apiResource('customers', \App\Http\Controllers\Api\Admin\CustomerController::class);
        Route::post('customers/import-csv', [\App\Http\Controllers\Api\Admin\CustomerController::class, 'importCsv']);
        Route::post('bills/generate', [\App\Http\Controllers\Api\Admin\BillController::class, 'generateBills']);
        Route::apiResource('bills', \App\Http\Controllers\Api\Admin\BillController::class);
        Route::apiResource('payments', \App\Http\Controllers\Api\Admin\PaymentController::class);
        Route::get('payments/stats', [\App\Http\Controllers\Api\Admin\PaymentController::class, 'stats']);
        Route::get('payments/recent', [\App\Http\Controllers\Api\Admin\PaymentController::class, 'recent']);
        Route::get('dashboard/stats', [\App\Http\Controllers\Api\Admin\DashboardController::class, 'stats']);
        Route::get('dashboard/activities', [\App\Http\Controllers\Api\Admin\DashboardController::class, 'recentActivities']);
    });

    // Klien routes — ForcePasswordChange middleware blocks if password_changed_at is null
    Route::middleware(['role:klien', 'force.password.change'])->prefix('klien')->group(function () {
        Route::get('/profile', [KlienController::class, 'profile']);
        Route::get('/bills', [KlienController::class, 'bills']);
        Route::put('/bills/{bill}/request-payment', [KlienController::class, 'requestPayment']);
        Route::get('/bills/{bill}/pdf', [KlienController::class, 'billPdf']);
    });
});
```

- [ ] **Step 2: PHP lint**
```bash
cd backend && php -l routes/api.php
```

- [ ] **Step 3: Commit**
```bash
git add backend/routes/api.php
git commit -m "feat: update api.php with all routes and role middleware"
```

---

## Phase 4 — Frontend Foundation (Parallel with Phase 2)

### Task 11: types/auth.ts + AuthContext + ProtectedRoute

**Files:**
- Modify: `frontend/src/types/auth.ts`
- Modify: `frontend/src/contexts/AuthContext.tsx`
- Modify: `frontend/src/components/ProtectedRoute.tsx`

- [ ] **Step 1: Replace types/auth.ts**
```ts
export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'operator' | 'kasir' | 'klien';
  customer_id: number | null;
  password_changed_at: string | null;
  created_at: string;
}

export interface LoginRequest { email: string; password: string; }
export interface LoginResponse { access_token: string; token_type: string; user: User; }

export interface AuthContextType {
  user: User | null;
  token: string | null;
  mustChangePassword: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  refreshUser: () => void;
  isLoading: boolean;
}
```

- [ ] **Step 2: Update AuthContext.tsx** — read user from login response directly, add mustChangePassword and refreshUser

Key changes in `login()`: use `data.user` instead of separate `/user` call. Derive `mustChangePassword`. In `refreshUser()`: call `GET /user`, update state and localStorage.

Replace the `login` function:
```ts
const login = async (credentials: LoginRequest) => {
  try {
    setIsLoading(true);
    const { data } = await api.post<LoginResponse>('/login', credentials);
    localStorage.setItem('water_billing_token', data.access_token);
    localStorage.setItem('water_billing_user', JSON.stringify(data.user));
    setToken(data.access_token);
    setUser(data.user);
    setMustChangePassword(data.user.role === 'klien' && data.user.password_changed_at === null);
    toast({ title: 'Login Berhasil', description: `Selamat datang, ${data.user.name}!` });
  } catch (error: any) {
    localStorage.removeItem('water_billing_token');
    localStorage.removeItem('water_billing_user');
    setToken(null); setUser(null); setMustChangePassword(false);
    const msg = error.response?.data?.message || 'Terjadi kesalahan';
    toast({ title: 'Login Gagal', description: msg, variant: 'destructive' });
    throw new Error(msg);
  } finally { setIsLoading(false); }
};
```

Add `mustChangePassword` state and `refreshUser`:
```ts
const [mustChangePassword, setMustChangePassword] = useState(false);

const refreshUser = async () => {
  try {
    const { data } = await api.get<User>('/user');
    setUser(data);
    localStorage.setItem('water_billing_user', JSON.stringify(data));
    setMustChangePassword(data.role === 'klien' && data.password_changed_at === null);
  } catch { /* ignore */ }
};
```

In the `useEffect` restore block, also restore `mustChangePassword`:
```ts
setMustChangePassword(parsedUser.role === 'klien' && parsedUser.password_changed_at === null);
```

Include `mustChangePassword` and `refreshUser` in the context value object.

- [ ] **Step 3: Update ProtectedRoute.tsx** — redirect klien to /change-password if mustChangePassword

Add after the `allowedRoles` check:
```tsx
import { useLocation } from 'react-router-dom';
// in component:
const { mustChangePassword } = useAuth();

if (mustChangePassword && location.pathname !== '/change-password') {
  return <Navigate to="/change-password" replace />;
}
```

Remove the debug `console.log` statements from ProtectedRoute (they're noisy in production).

- [ ] **Step 4: TypeScript check**
```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 5: Commit**
```bash
git add frontend/src/types/auth.ts frontend/src/contexts/AuthContext.tsx frontend/src/components/ProtectedRoute.tsx
git commit -m "feat: add klien role, mustChangePassword, refreshUser to auth layer"
```

---

## Phase 5 — Frontend Pages (Parallel after Task 11)

### Task 12: WaterDropLogo + AppSidebar Rebranding

**Files:**
- Create: `frontend/src/components/WaterDropLogo.tsx`
- Modify: `frontend/src/components/layout/AppSidebar.tsx`

- [ ] **Step 1: Create WaterDropLogo.tsx**
```tsx
export const WaterDropLogo = ({ className = 'w-8 h-8' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C12 2 5 9.5 5 14.5C5 18.09 8.13 21 12 21C15.87 21 19 18.09 19 14.5C19 9.5 12 2 12 2Z"
          fill="#60a5fa" />
    <path d="M9 15.5C9 17.15 10.34 18.5 12 18.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
```

- [ ] **Step 2: Update AppSidebar.tsx** — replace logo import, update branding text, add 4-role nav

Remove: `import logo from '@/assets/logo.png';`
Add: `import { WaterDropLogo } from '@/components/WaterDropLogo';`

Replace the logo `<img>` element with `<WaterDropLogo className="w-8 h-8" />`.

Replace "Water Billing" / "Water Billing System" text with "WaterTrack".

Replace the nav items array with role-aware items. The nav config per role (based on spec matrix):

```tsx
const navItems = [
  { title: 'Dashboard', url: '/dashboard', roles: ['admin', 'operator', 'kasir', 'klien'] },
  { title: 'Kelola Akun', url: '/users', roles: ['admin', 'operator'] },
  { title: 'Kelola Pelanggan', url: '/customers', roles: ['admin', 'operator'] },
  { title: 'Kelola Tagihan', url: '/bills', roles: ['admin', 'operator'] },
  { title: 'Transaksi', url: '/transactions', roles: ['admin', 'kasir'] },
  { title: 'Cek Tagihan', url: '/kasir/check', roles: ['admin', 'kasir'] },
  { title: 'Permintaan Bayar', url: '/kasir/pending-requests', roles: ['kasir'] },
  { title: 'Audit Log', url: '/audit-logs', roles: ['admin'] },
  { title: 'Pengaturan', url: '/settings', roles: ['admin'] },
  { title: 'Profil Saya', url: '/my-profile', roles: ['klien'] },
  { title: 'Tagihan Saya', url: '/my-bills', roles: ['klien'] },
];

// Filter: only show items whose roles include current user's role
const visibleItems = navItems.filter(item => item.roles.includes(user?.role ?? ''));
```

- [ ] **Step 3: TypeScript check**
```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**
```bash
git add frontend/src/components/WaterDropLogo.tsx frontend/src/components/layout/AppSidebar.tsx
git commit -m "feat: add WaterDropLogo; rebrand sidebar to WaterTrack with 4-role nav"
```

---

### Task 13: UsersPage

**Files:** Create `frontend/src/pages/UsersPage.tsx`

- [ ] **Step 1: Create UsersPage.tsx** — admin sees all roles, operator sees klien only

```tsx
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { User } from '@/types/auth';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface UserWithCustomer extends User {
  customer?: { nomor_langganan: string; nama: string; alamat: string } | null;
}

export const UsersPage = () => {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const isAdmin = currentUser?.role === 'admin';
  const endpoint = isAdmin ? '/admin/users' : '/operator/users';

  const [users, setUsers] = useState<UserWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<UserWithCustomer | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'klien', alamat: '', telepon: '', tarif_per_m3: '', meteran_awal: '' });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(endpoint);
      setUsers(data.data ?? data);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: Record<string, any> = { name: form.name, email: form.email, role: isAdmin ? form.role : 'klien' };
      if (form.password) payload.password = form.password;
      if (payload.role === 'klien' || !isAdmin) {
        payload.alamat = form.alamat;
        payload.telepon = form.telepon;
        payload.tarif_per_m3 = parseFloat(form.tarif_per_m3);
        payload.meteran_awal = parseInt(form.meteran_awal);
      }

      if (editUser) {
        await api.put(`${endpoint}/${editUser.id}`, payload);
        toast({ title: 'User diperbarui' });
      } else {
        if (!payload.password) { toast({ title: 'Password wajib diisi', variant: 'destructive' }); return; }
        await api.post(endpoint, payload);
        toast({ title: 'User berhasil dibuat' });
      }
      setShowForm(false); setEditUser(null);
      setForm({ name: '', email: '', password: '', role: 'klien', alamat: '', telepon: '', tarif_per_m3: '', meteran_awal: '' });
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'Gagal', description: err.response?.data?.message ?? 'Terjadi kesalahan', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus user ini?')) return;
    try {
      await api.delete(`${endpoint}/${id}`);
      toast({ title: 'User dihapus' });
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'Gagal hapus', description: err.response?.data?.message, variant: 'destructive' });
    }
  };

  const roleBadgeColor: Record<string, string> = {
    admin: 'bg-red-500', operator: 'bg-blue-500', kasir: 'bg-yellow-500', klien: 'bg-green-500',
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-foreground">Kelola Akun {isAdmin ? '' : 'Klien'}</h1>
        <Button onClick={() => { setEditUser(null); setShowForm(true); }}>+ Tambah User</Button>
      </div>

      {loading ? <p>Memuat...</p> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead><TableHead>Email</TableHead>
              <TableHead>Role</TableHead><TableHead>No. Langganan</TableHead><TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(u => (
              <TableRow key={u.id}>
                <TableCell>{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell><Badge className={roleBadgeColor[u.role]}>{u.role}</Badge></TableCell>
                <TableCell>{u.customer?.nomor_langganan ?? '-'}</TableCell>
                <TableCell className="space-x-2">
                  <Button size="sm" variant="outline" onClick={() => { setEditUser(u); setForm({ name: u.name, email: u.email, password: '', role: u.role, alamat: u.customer?.alamat ?? '', telepon: '', tarif_per_m3: '', meteran_awal: '' }); setShowForm(true); }}>Edit</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(u.id)}>Hapus</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editUser ? 'Edit User' : 'Tambah User'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>Nama</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required /></div>
            <div><Label>Password {editUser && '(kosongkan jika tidak diubah)'}</Label><Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
            {isAdmin && !editUser && (
              <div><Label>Role</Label>
                <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="operator">Operator</SelectItem>
                    <SelectItem value="kasir">Kasir</SelectItem>
                    <SelectItem value="klien">Klien</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {(form.role === 'klien' || !isAdmin) && (
              <>
                <div><Label>Alamat</Label><Input value={form.alamat} onChange={e => setForm(f => ({ ...f, alamat: e.target.value }))} /></div>
                <div><Label>Telepon</Label><Input value={form.telepon} onChange={e => setForm(f => ({ ...f, telepon: e.target.value }))} /></div>
                {!editUser && <>
                  <div><Label>Tarif per m³</Label><Input type="number" value={form.tarif_per_m3} onChange={e => setForm(f => ({ ...f, tarif_per_m3: e.target.value }))} /></div>
                  <div><Label>Meteran Awal</Label><Input type="number" value={form.meteran_awal} onChange={e => setForm(f => ({ ...f, meteran_awal: e.target.value }))} /></div>
                </>}
              </>
            )}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Batal</Button>
              <Button type="submit">{editUser ? 'Simpan' : 'Buat'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
```

- [ ] **Step 2: TypeScript check**
```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**
```bash
git add frontend/src/pages/UsersPage.tsx
git commit -m "feat: add UsersPage for admin (all roles) and operator (klien only)"
```

---

### Task 14: AuditLogPage + ChangePasswordPage

**Files:**
- Create: `frontend/src/pages/AuditLogPage.tsx`
- Create: `frontend/src/pages/ChangePasswordPage.tsx`

- [ ] **Step 1: Create AuditLogPage.tsx**
```tsx
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface AuditLog {
  id: number; action: string; subject_type: string | null; subject_id: number | null;
  old_values: Record<string, any> | null; new_values: Record<string, any> | null;
  ip_address: string; created_at: string;
  user: { name: string; role: string } | null;
}

const actionColor: Record<string, string> = {
  create: 'bg-green-500', update: 'bg-blue-500', delete: 'bg-red-500',
  login: 'bg-yellow-500', logout: 'bg-gray-500',
};

export const AuditLogPage = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    const { data } = await api.get('/admin/audit-logs', { params });
    setLogs(data.data ?? data);
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-foreground mb-4">Audit Log</h1>
      <div className="flex gap-4 mb-4">
        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="Dari tanggal" />
        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="Sampai tanggal" />
        <button onClick={fetchLogs} className="px-4 py-2 bg-primary text-primary-foreground rounded">Filter</button>
      </div>
      {loading ? <p>Memuat...</p> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead><TableHead>User</TableHead><TableHead>Aksi</TableHead>
              <TableHead>Subjek</TableHead><TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map(log => (
              <TableRow key={log.id}>
                <TableCell>{new Date(log.created_at).toLocaleString('id-ID')}</TableCell>
                <TableCell>{log.user?.name ?? 'System'} <span className="text-muted-foreground text-xs">({log.user?.role})</span></TableCell>
                <TableCell><Badge className={actionColor[log.action] ?? 'bg-gray-500'}>{log.action}</Badge></TableCell>
                <TableCell>{log.subject_type ? `${log.subject_type} #${log.subject_id}` : '-'}</TableCell>
                <TableCell>{log.ip_address}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Create ChangePasswordPage.tsx**
```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export const ChangePasswordPage = () => {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState({ current_password: '', new_password: '', new_password_confirmation: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.new_password !== form.new_password_confirmation) {
      toast({ title: 'Konfirmasi password tidak cocok', variant: 'destructive' }); return;
    }
    setLoading(true);
    try {
      await api.put('/user/password', form);
      toast({ title: 'Password berhasil diubah' });
      await refreshUser();
      navigate('/dashboard');
    } catch (err: any) {
      toast({ title: 'Gagal', description: err.response?.data?.message ?? 'Terjadi kesalahan', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>Ganti Password</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>Password Saat Ini</Label><Input type="password" value={form.current_password} onChange={e => setForm(f => ({ ...f, current_password: e.target.value }))} required /></div>
            <div><Label>Password Baru (min. 8 karakter)</Label><Input type="password" value={form.new_password} onChange={e => setForm(f => ({ ...f, new_password: e.target.value }))} required /></div>
            <div><Label>Konfirmasi Password Baru</Label><Input type="password" value={form.new_password_confirmation} onChange={e => setForm(f => ({ ...f, new_password_confirmation: e.target.value }))} required /></div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Menyimpan...' : 'Ubah Password'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
```

- [ ] **Step 3: TypeScript check**
```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**
```bash
git add frontend/src/pages/AuditLogPage.tsx frontend/src/pages/ChangePasswordPage.tsx
git commit -m "feat: add AuditLogPage and ChangePasswordPage"
```

---

### Task 15: Klien Pages

**Files:**
- Create: `frontend/src/pages/klien/MyProfilePage.tsx`
- Create: `frontend/src/pages/klien/MyBillsPage.tsx`

- [ ] **Step 1: Create MyProfilePage.tsx**
```tsx
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CustomerProfile {
  nomor_langganan: string; nama: string; alamat: string;
  telepon: string; status: string; tarif_per_m3: number; meteran_terakhir: number;
}

export const MyProfilePage = () => {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);

  useEffect(() => {
    api.get('/klien/profile').then(({ data }) => setCustomer(data.customer));
  }, []);

  if (!customer) return <div className="p-6">Memuat...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-foreground">Profil Saya</h1>
      <Card>
        <CardHeader><CardTitle>Informasi Pelanggan</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div><p className="text-muted-foreground text-sm">No. Langganan</p><p className="font-mono font-bold text-gold">{customer.nomor_langganan}</p></div>
          <div><p className="text-muted-foreground text-sm">Nama</p><p>{customer.nama}</p></div>
          <div><p className="text-muted-foreground text-sm">Alamat</p><p>{customer.alamat}</p></div>
          <div><p className="text-muted-foreground text-sm">Telepon</p><p>{customer.telepon || '-'}</p></div>
          <div><p className="text-muted-foreground text-sm">Tarif per m³</p><p>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(customer.tarif_per_m3)}</p></div>
          <div><p className="text-muted-foreground text-sm">Meteran Terakhir</p><p>{customer.meteran_terakhir} m³</p></div>
          <div><p className="text-muted-foreground text-sm">Status</p><p className={customer.status === 'aktif' ? 'text-green-500' : 'text-red-500'}>{customer.status}</p></div>
        </CardContent>
      </Card>
    </div>
  );
};
```

- [ ] **Step 2: Create MyBillsPage.tsx** — list bills with request-payment modal and PDF print
```tsx
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface Bill {
  id: number; periode: string; pemakaian: number; jumlah_tagihan: number;
  status: 'belum_bayar' | 'menunggu_konfirmasi' | 'sudah_bayar';
  tanggal_jatuh_tempo: string; requested_metode_pembayaran: string | null;
}

const statusLabel: Record<Bill['status'], string> = {
  belum_bayar: 'Belum Bayar', menunggu_konfirmasi: 'Menunggu Konfirmasi', sudah_bayar: 'Lunas',
};
const statusColor: Record<Bill['status'], string> = {
  belum_bayar: 'bg-red-500', menunggu_konfirmasi: 'bg-yellow-500', sudah_bayar: 'bg-green-500',
};

export const MyBillsPage = () => {
  const { toast } = useToast();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [payBill, setPayBill] = useState<Bill | null>(null);
  const [metode, setMetode] = useState('tunai');
  const [submitting, setSubmitting] = useState(false);

  const fetchBills = async () => {
    setLoading(true);
    const { data } = await api.get('/klien/bills');
    setBills(data.data ?? data);
    setLoading(false);
  };

  useEffect(() => { fetchBills(); }, []);

  const handleRequestPayment = async () => {
    if (!payBill) return;
    setSubmitting(true);
    try {
      await api.put(`/klien/bills/${payBill.id}/request-payment`, { metode_pembayaran: metode });
      toast({ title: 'Permintaan pembayaran diajukan' });
      setPayBill(null);
      fetchBills();
    } catch (err: any) {
      toast({ title: 'Gagal', description: err.response?.data?.message, variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  const handlePrintPdf = async (bill: Bill) => {
    const { data } = await api.get(`/klien/bills/${bill.id}/pdf`);
    const w = window.open('', '_blank');
    if (!w) return;
    const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(n);
    w.document.write(`<html><head><title>Struk WaterTrack</title><style>body{font-family:sans-serif;padding:20px}</style></head><body>
      <h2>WaterTrack — Struk Tagihan</h2>
      <p>No. Langganan: ${data.customer?.nomor_langganan ?? '-'}</p>
      <p>Nama: ${data.customer?.nama ?? '-'}</p>
      <p>Periode: ${data.periode}</p>
      <p>Pemakaian: ${data.pemakaian} m³</p>
      <p>Jumlah Tagihan: ${fmt(data.jumlah_tagihan)}</p>
      <p>Status: ${statusLabel[data.status as Bill['status']]}</p>
      <p>Jatuh Tempo: ${data.tanggal_jatuh_tempo}</p>
    </body></html>`);
    w.print();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-foreground mb-6">Tagihan Saya</h1>
      {loading ? <p>Memuat...</p> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Periode</TableHead><TableHead>Pemakaian</TableHead>
              <TableHead>Jumlah</TableHead><TableHead>Jatuh Tempo</TableHead>
              <TableHead>Status</TableHead><TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bills.map(b => (
              <TableRow key={b.id}>
                <TableCell>{b.periode}</TableCell>
                <TableCell>{b.pemakaian} m³</TableCell>
                <TableCell>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(b.jumlah_tagihan)}</TableCell>
                <TableCell>{b.tanggal_jatuh_tempo}</TableCell>
                <TableCell><Badge className={statusColor[b.status]}>{statusLabel[b.status]}</Badge></TableCell>
                <TableCell className="space-x-2">
                  {b.status === 'belum_bayar' && (
                    <Button size="sm" onClick={() => { setPayBill(b); setMetode('tunai'); }}>Ajukan Bayar</Button>
                  )}
                  {b.status === 'menunggu_konfirmasi' && (
                    <Button size="sm" disabled variant="outline">Menunggu Konfirmasi</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => handlePrintPdf(b)}>Unduh PDF</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!payBill} onOpenChange={() => setPayBill(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajukan Pembayaran</DialogTitle></DialogHeader>
          <p className="text-muted-foreground">Periode: {payBill?.periode}</p>
          <div>
            <p className="mb-2 font-medium">Pilih Metode Pembayaran</p>
            <Select value={metode} onValueChange={setMetode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tunai">Tunai</SelectItem>
                <SelectItem value="transfer">Transfer Bank</SelectItem>
                <SelectItem value="kartu">Kartu</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setPayBill(null)}>Batal</Button>
            <Button onClick={handleRequestPayment} disabled={submitting}>{submitting ? 'Mengirim...' : 'Ajukan'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
```

- [ ] **Step 3: TypeScript check**
```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**
```bash
git add frontend/src/pages/klien/
git commit -m "feat: add MyProfilePage and MyBillsPage for klien"
```

---

### Task 16: Kasir PendingRequestsPage

**Files:** Create `frontend/src/pages/kasir/PendingRequestsPage.tsx`

- [ ] **Step 1: Create PendingRequestsPage.tsx**
```tsx
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface PendingBill {
  id: number; periode: string; jumlah_tagihan: number;
  requested_metode_pembayaran: string | null;
  customer: { nomor_langganan: string; nama: string } | null;
}

export const PendingRequestsPage = () => {
  const { toast } = useToast();
  const [bills, setBills] = useState<PendingBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<number | null>(null);

  const fetchPending = async () => {
    setLoading(true);
    const { data } = await api.get('/kasir/pending-requests');
    setBills(data.data ?? data);
    setLoading(false);
  };

  useEffect(() => { fetchPending(); }, []);

  const handleConfirm = async (billId: number) => {
    setConfirming(billId);
    try {
      await api.put(`/kasir/bills/${billId}/confirm`, {});
      toast({ title: 'Pembayaran dikonfirmasi' });
      fetchPending();
    } catch (err: any) {
      toast({ title: 'Gagal', description: err.response?.data?.message, variant: 'destructive' });
    } finally { setConfirming(null); }
  };

  const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(n);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-foreground mb-6">Permintaan Pembayaran</h1>
      {loading ? <p>Memuat...</p> : bills.length === 0 ? (
        <p className="text-muted-foreground">Tidak ada permintaan pembayaran yang menunggu.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Langganan</TableHead><TableHead>Nama</TableHead>
              <TableHead>Periode</TableHead><TableHead>Jumlah</TableHead>
              <TableHead>Metode</TableHead><TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bills.map(b => (
              <TableRow key={b.id}>
                <TableCell className="font-mono">{b.customer?.nomor_langganan ?? '-'}</TableCell>
                <TableCell>{b.customer?.nama ?? '-'}</TableCell>
                <TableCell>{b.periode}</TableCell>
                <TableCell>{fmt(b.jumlah_tagihan)}</TableCell>
                <TableCell><Badge>{b.requested_metode_pembayaran ?? 'tunai'}</Badge></TableCell>
                <TableCell>
                  <Button size="sm" onClick={() => handleConfirm(b.id)} disabled={confirming === b.id}>
                    {confirming === b.id ? 'Memproses...' : 'Konfirmasi'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};
```

- [ ] **Step 2: TypeScript check**
```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**
```bash
git add frontend/src/pages/kasir/PendingRequestsPage.tsx
git commit -m "feat: add PendingRequestsPage for kasir"
```

---

## Phase 6 — Final Wiring

### Task 17: App.tsx + DashboardPage Banner + package.json

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/package.json`

- [ ] **Step 1: Update App.tsx** — add all new routes

Replace the existing route tree with:
```tsx
import { ChangePasswordPage } from '@/pages/ChangePasswordPage';
import { UsersPage } from '@/pages/UsersPage';
import { AuditLogPage } from '@/pages/AuditLogPage';
import { MyProfilePage } from '@/pages/klien/MyProfilePage';
import { MyBillsPage } from '@/pages/klien/MyBillsPage';
import { PendingRequestsPage } from '@/pages/kasir/PendingRequestsPage';
// ... keep existing imports
```

Add to the route tree (inside the AppLayout `<Route>`):
```tsx
{/* Change password — accessible to all authenticated users, no role restriction */}
<Route path="change-password" element={<ChangePasswordPage />} />

{/* Admin + Operator */}
<Route path="users" element={
  <ProtectedRoute allowedRoles={['admin', 'operator']}><UsersPage /></ProtectedRoute>
} />
<Route path="bills" element={
  <ProtectedRoute allowedRoles={['admin', 'operator']}><BillsPage /></ProtectedRoute>
} />

{/* Admin only */}
<Route path="audit-logs" element={
  <ProtectedRoute allowedRoles={['admin']}><AuditLogPage /></ProtectedRoute>
} />

{/* Kasir */}
<Route path="kasir/pending-requests" element={
  <ProtectedRoute allowedRoles={['admin', 'kasir']}><PendingRequestsPage /></ProtectedRoute>
} />

{/* Klien */}
<Route path="my-profile" element={
  <ProtectedRoute allowedRoles={['klien']}><MyProfilePage /></ProtectedRoute>
} />
<Route path="my-bills" element={
  <ProtectedRoute allowedRoles={['klien']}><MyBillsPage /></ProtectedRoute>
} />
```

Also update existing routes:
- `/bills` — change `allowedRoles` from `['admin']` to `['admin', 'operator']`
- `/transactions` — change `allowedRoles` from `['admin']` to `['admin', 'kasir']`
- `/kasir/check` — change `allowedRoles` from `['kasir']` to `['admin', 'kasir']`

- [ ] **Step 2: Add klien notification banner to DashboardPage.tsx**

In `DashboardPage.tsx`, after the role check, add this block for klien role:
```tsx
// Inside DashboardPage, find where user.role branches are handled.
// Add this klien branch:
if (user?.role === 'klien') {
  // The klien section should show the unpaid bill banner.
  // Fetch bills to determine banner:
}
```

Find the klien or default branch of the dashboard and add a banner at the top:
```tsx
{user?.role === 'klien' && <KlienBanner />}
```

Create the `KlienBanner` component inline in DashboardPage (or as a small helper):
```tsx
const KlienBanner = () => {
  const [latestBill, setLatestBill] = useState<{ status: string } | null>(null);
  useEffect(() => {
    api.get('/klien/bills').then(({ data }) => {
      const bills = data.data ?? data;
      if (bills.length > 0) setLatestBill(bills[0]);
    }).catch(() => {});
  }, []);

  if (!latestBill) return null;
  if (latestBill.status === 'sudah_bayar') return null;

  if (latestBill.status === 'menunggu_konfirmasi') {
    return (
      <div className="bg-blue-100 border border-blue-400 text-blue-800 px-4 py-3 rounded mb-6">
        Permintaan pembayaran Anda sedang diproses kasir.
      </div>
    );
  }

  return (
    <div className="bg-red-100 border border-red-400 text-red-800 px-4 py-3 rounded mb-6 flex justify-between items-center">
      <span>Anda memiliki tagihan yang belum lunas. Segera ajukan pembayaran.</span>
      <a href="/my-bills" className="underline font-medium ml-4">Lihat Tagihan</a>
    </div>
  );
};
```

- [ ] **Step 3: Remove xlsx from package.json**

In `frontend/package.json`, remove the `xlsx` entry from `dependencies`. Then run:
```bash
cd frontend && npm uninstall xlsx
```

- [ ] **Step 4: TypeScript check + lint**
```bash
cd frontend && npx tsc --noEmit && npm run lint
```

- [ ] **Step 5: Commit**
```bash
git add frontend/src/App.tsx frontend/src/pages/DashboardPage.tsx frontend/package.json frontend/package-lock.json
git commit -m "feat: wire all new routes; add klien banner; remove xlsx dependency"
```

---

## Phase 7 — Verification

### Task 18: Run PHPUnit Tests (SQLite in-memory)

- [ ] **Step 1: Run all backend tests**
```bash
cd backend && php artisan test
```
Expected: All tests pass. SQLite in-memory is already configured in `phpunit.xml`.

- [ ] **Step 2: If tests fail due to missing routes** — ensure Task 10 (routes/api.php) is complete before running tests for controllers that depend on routes.

- [ ] **Step 3: Run specific test files to isolate failures**
```bash
cd backend && php artisan test tests/Feature/AuthControllerTest.php
cd backend && php artisan test tests/Feature/Admin/UserControllerTest.php
cd backend && php artisan test tests/Feature/KlienControllerTest.php
```

---

### Task 19: Frontend TypeScript + Lint Check

- [ ] **Step 1: TypeScript compile check**
```bash
cd frontend && npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 2: Lint check**
```bash
cd frontend && npm run lint
```
Expected: 0 errors

- [ ] **Step 3: Commit if any lint fixes were needed**
```bash
git add frontend/src/
git commit -m "fix: resolve TypeScript and lint errors"
```

---

## Self-Review Checklist

- [x] Hash::check password fix — Task 4
- [x] klien role enum in users table — Task 1
- [x] customer_id + password_changed_at on users — Tasks 1 & 2
- [x] menunggu_konfirmasi in bills status — Tasks 1 & 2
- [x] audit_logs table + observers + controller — Task 6
- [x] ForcePasswordChange middleware — Task 3
- [x] mustChangePassword in frontend — Task 11
- [x] ProtectedRoute redirect to /change-password — Task 11
- [x] Admin\UserController with DB transaction for klien — Task 5
- [x] Operator\UserController restricted to klien — Task 7
- [x] KlienController with ownership checks — Task 8
- [x] confirmPayment in KasirController — Task 9
- [x] Auto-generate nomor_langganan — Tasks 5, 7, 9
- [x] CSV import replacing Excel — Task 9
- [x] WaterDropLogo + WaterTrack branding — Task 12
- [x] 4-role sidebar nav — Task 12
- [x] /my-bills with request-payment + PDF print — Task 15
- [x] /kasir/pending-requests — Task 16
- [x] /change-password accessible to all roles — Tasks 14 & 17
- [x] xlsx removed from package.json — Task 17
- [x] All new routes in api.php with role middleware — Task 10
- [x] klien notification banner on dashboard — Task 17
