import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import NotFound from "./pages/NotFound";

// Shared pages
import { ChangePasswordPage } from "@/pages/ChangePasswordPage";
import { UsersPage } from "@/pages/UsersPage";
import { AuditLogPage } from "@/pages/AuditLogPage";

// Admin Pages
import { CustomersPage } from "@/pages/admin/CustomersPage";
import { BillsPage } from "@/pages/admin/BillsPage";
import { TransactionsPage } from "@/pages/admin/TransactionsPage";
import { SettingsPage } from "@/pages/admin/SettingsPage";

// Kasir Pages
import { CheckBillPage } from "@/pages/kasir/CheckBillPage";
import { PaymentPage } from "@/pages/kasir/PaymentPage";
import { PendingRequestsPage } from "@/pages/kasir/PendingRequestsPage";

// Operator Pages
import { MeterReadingPage } from "@/pages/operator/MeterReadingPage";

// Klien Pages
import { MyProfilePage } from "@/pages/klien/MyProfilePage";
import { MyBillsPage } from "@/pages/klien/MyBillsPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/change-password"
              element={
                <ProtectedRoute>
                  <ChangePasswordPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/unauthorized"
              element={
                <div className="min-h-screen flex items-center justify-center bg-background">
                  <h1 className="text-2xl text-foreground">Akses Ditolak</h1>
                </div>
              }
            />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="dashboard" element={<DashboardPage />} />

              {/* Admin + Operator */}
              <Route
                path="users"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'operator']}>
                    <UsersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="customers"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'operator']}>
                    <CustomersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="bills"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'operator']}>
                    <BillsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="meter-reading"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'operator']}>
                    <MeterReadingPage />
                  </ProtectedRoute>
                }
              />

              {/* Admin only */}
              <Route
                path="transactions"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'kasir']}>
                    <TransactionsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="settings"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="audit-logs"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AuditLogPage />
                  </ProtectedRoute>
                }
              />

              {/* Kasir */}
              <Route
                path="bills/check"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'kasir']}>
                    <CheckBillPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="kasir/check"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'kasir']}>
                    <CheckBillPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="payments"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'kasir']}>
                    <PaymentPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="kasir/pending-requests"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'kasir']}>
                    <PendingRequestsPage />
                  </ProtectedRoute>
                }
              />

              {/* Klien */}
              <Route
                path="my-profile"
                element={
                  <ProtectedRoute allowedRoles={['klien']}>
                    <MyProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="my-bills"
                element={
                  <ProtectedRoute allowedRoles={['klien']}>
                    <MyBillsPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
