import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

import AuthPage from './pages/auth/AuthPage';
import UserMarketplace from './pages/user/UserMarketplace';
import TenantBookingPage from './pages/user/TenantBookingPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import TenantDashboard from './pages/tenant/TenantDashboard';
import TenantPendingPage from './pages/tenant/TenantPendingPage';
import StaffDashboard from './pages/staff/StaffDashboard';

const ProtectedRoute = ({ children, allowedRoles, requireActiveTenant = false }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  // Nếu là Chủ sân nhưng đang ở trạng thái PENDING mà cố vào dashboard chính thức
  if (user.role === 'TENANT_ADMIN' && user.tenantStatus === 'PENDING' && requireActiveTenant) {
    return <Navigate to="/tenant-pending" replace />;
  }

  return children;
};

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
      <BrowserRouter>
        <Routes>
          {/* Trang chủ: Hiển thị danh sách sân ngay khi mở web */}
          <Route path="/" element={<UserMarketplace />} />
          <Route path="/marketplace" element={<Navigate to="/" replace />} />
          <Route path="/marketplace/:id" element={<TenantBookingPage />} />

          {/* Trang Đăng nhập & Đăng ký */}
          <Route path="/login" element={<AuthPage />} />
          <Route path="/auth" element={<Navigate to="/login" replace />} />

          {/* Luồng Admin */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Luồng Chủ sân chờ phê duyệt (Pending Tenant) */}
          <Route
            path="/tenant-pending"
            element={
              <ProtectedRoute allowedRoles={['TENANT_ADMIN']}>
                <TenantPendingPage />
              </ProtectedRoute>
            }
          />

          {/* Luồng Chủ sân chính thức (Yêu cầu Cụm sân đã ACTIVE) */}
          <Route
            path="/tenant"
            element={
              <ProtectedRoute allowedRoles={['TENANT_ADMIN']} requireActiveTenant={true}>
                <TenantDashboard />
              </ProtectedRoute>
            }
          />

          {/* Luồng Lễ tân (Yêu cầu Cụm sân đã ACTIVE) */}
          <Route
            path="/staff"
            element={
              <ProtectedRoute allowedRoles={['STAFF', 'TENANT_ADMIN']} requireActiveTenant={true}>
                <StaffDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/super-admin" element={<Navigate to="/admin" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}