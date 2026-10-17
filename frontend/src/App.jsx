import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import AuthPage from './pages/auth/AuthPage';
import UserMarketplace from './pages/user/UserMarketplace';
import TenantBookingPage from './pages/user/TenantBookingPage';
import SuperAdminDashboard from './pages/superAdmin/SuperAdminDashboard';
import TenantDashboard from './pages/tenant/TenantDashboard';
import StaffDashboard from './pages/staff/StaffDashboard';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Trang chủ tối giản: Chỉ hiện màn hình Đăng nhập / Đăng ký */}
          <Route path="/" element={<AuthPage />} />

          {/* Luồng Khách hàng (End-User) */}
          <Route
            path="/marketplace"
            element={
              <ProtectedRoute allowedRoles={['USER']}>
                <UserMarketplace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/marketplace/:id"
            element={
              <ProtectedRoute allowedRoles={['USER']}>
                <TenantBookingPage />
              </ProtectedRoute>
            }
          />

          {/* Luồng Super Admin */}
          <Route
            path="/super-admin"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <SuperAdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Luồng Chủ sân (Tenant Admin) */}
          <Route
            path="/tenant"
            element={
              <ProtectedRoute allowedRoles={['TENANT_ADMIN']}>
                <TenantDashboard />
              </ProtectedRoute>
            }
          />

          {/* Luồng Lễ tân (Staff & Chủ sân đều vào được) */}
          <Route
            path="/staff"
            element={
              <ProtectedRoute allowedRoles={['STAFF', 'TENANT_ADMIN']}>
                <StaffDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}