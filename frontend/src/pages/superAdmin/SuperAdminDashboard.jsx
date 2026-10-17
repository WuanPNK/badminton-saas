import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';

export default function SuperAdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [approvals, setApprovals] = useState({
    pendingTenants: [],
    pendingCourts: [],
    pendingStudents: [],
  });
  const [dashboard, setDashboard] = useState({
    saasRevenue: { total_saas_revenue: 0, total_subscriptions: 0 },
    tenantBreakdown: [],
    recentSubscriptions: [],
  });

  const [subForm, setSubForm] = useState({
    tenantId: '',
    planName: 'Gói Chuyên Nghiệp (Pro SaaS)',
    pricePerMonth: 1500000,
    durationMonths: 6,
  });

  const fetchAllData = async () => {
    try {
      const [appRes, dashRes] = await Promise.all([
        axiosClient.get('/super-admin/pending-approvals'),
        axiosClient.get('/super-admin/dashboard'),
      ]);
      setApprovals(appRes.data.data);
      setDashboard(dashRes.data.data);
    } catch (err) {
      console.error(err);
    }
  };

    useEffect(() => {
    // eslint-disable-next-line
        fetchAllData();
    }, []);
  // 1. Duyệt hoặc Từ chối Chủ sân
  const handleTenantStatus = async (id, status) => {
    try {
      const res = await axiosClient.put(`/super-admin/tenants/${id}/status`, { status });
      alert(res.data.message);
      fetchAllData();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi cập nhật trạng thái chủ sân.');
    }
  };

  // 2. Duyệt hoặc Từ chối Sân mới tạo
  const handleCourtStatus = async (id, status) => {
    try {
      const res = await axiosClient.put(`/super-admin/courts/${id}/status`, { status });
      alert(res.data.message);
      fetchAllData();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi duyệt sân.');
    }
  };

  // 3. Duyệt hoặc Từ chối Thẻ Học sinh / Sinh viên
  const handleStudentVerify = async (userId, status) => {
    try {
      const res = await axiosClient.put(`/super-admin/students/${userId}/verify`, { status });
      alert(res.data.message);
      fetchAllData();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi duyệt thẻ sinh viên.');
    }
  };

  // 4. Ghi nhận doanh thu đóng phí phần mềm từ Chủ sân
  const handleRecordSubscription = async (e) => {
    e.preventDefault();
    try {
      const res = await axiosClient.post('/super-admin/subscriptions/record', subForm);
      alert(res.data.message);
      setSubForm({ ...subForm, tenantId: '' });
      fetchAllData();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi ghi nhận gói cước.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-12">
      {/* HEADER */}
      <header className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">Super Admin Portal (Chủ Nền Tảng SaaS)</h1>
          <p className="text-xs text-slate-400">
            Quản lý Doanh thu Phần mềm, Duyệt Đối tác Chủ sân, Duyệt Sân mới & Xác thực Sinh viên
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs bg-emerald-600 px-3 py-1 rounded-full font-bold">
            {user?.fullName} (SUPER ADMIN)
          </span>
          <button
            onClick={() => { logout(); navigate('/'); }}
            className="text-xs bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg font-semibold"
          >
            Đăng xuất
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 pt-6 space-y-6">
        {/* KHỐI 1: THỐNG KÊ DOANH THU BÁN PHẦN MỀM SAAS */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">TỔNG DOANH THU GÓI CƯỚC SAAS</p>
            <p className="text-2xl font-extrabold text-emerald-600 mt-1">
              {Number(dashboard.saasRevenue?.total_saas_revenue || 0).toLocaleString()}đ
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Tổng số hợp đồng thuê phần mềm: {dashboard.saasRevenue?.total_subscriptions || 0}
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">HỒ SƠ ĐANG CHỜ DUYỆT</p>
            <div className="mt-2 space-y-1 text-xs font-medium text-slate-700">
              <div>• Chủ sân mới chờ duyệt: <strong>{approvals.pendingTenants.length}</strong></div>
              <div>• Sân con mới chờ mở bán: <strong>{approvals.pendingCourts.length}</strong></div>
              <div>• Thẻ Sinh viên chờ xác thực: <strong>{approvals.pendingStudents.length}</strong></div>
            </div>
          </div>

          {/* FORM GHI NHẬN THU TIỀN PHẦN MỀM TỪ CHỦ SÂN */}
          <form
            onSubmit={handleRecordSubscription}
            className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2"
          >
            <p className="text-xs font-bold text-slate-800">Ghi nhận Chủ sân đóng phí SaaS</p>
            <input
              type="text"
              required
              placeholder="Nhập UUID của Cụm sân (Tenant ID)..."
              value={subForm.tenantId}
              onChange={(e) => setSubForm({ ...subForm, tenantId: e.target.value })}
              className="w-full px-2.5 py-1.5 border rounded text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                required
                placeholder="Giá/tháng"
                value={subForm.pricePerMonth}
                onChange={(e) => setSubForm({ ...subForm, pricePerMonth: e.target.value })}
                className="w-full px-2.5 py-1.5 border rounded text-xs"
              />
              <input
                type="number"
                required
                placeholder="Số tháng"
                value={subForm.durationMonths}
                onChange={(e) => setSubForm({ ...subForm, durationMonths: e.target.value })}
                className="w-full px-2.5 py-1.5 border rounded text-xs"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-1.5 rounded text-xs font-semibold"
            >
              + Ghi nhận Doanh thu SaaS
            </button>
          </form>
        </div>

        {/* KHỐI 2: DUYỆT KÉP BƯỚC 1 - DUYỆT TÀI KHOẢN CHỦ SÂN (PENDING -> ACTIVE) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-bold text-slate-800 mb-3">
            1. Duyệt Hồ sơ Đăng ký Chủ sân Mới ({approvals.pendingTenants.length})
          </h2>
          {approvals.pendingTenants.length === 0 ? (
            <p className="text-xs text-slate-500">Không có Chủ sân nào đang chờ duyệt.</p>
          ) : (
            <div className="space-y-3">
              {approvals.pendingTenants.map((t) => (
                <div
                  key={t.id}
                  className="p-3 border rounded-lg flex flex-wrap justify-between items-center gap-3 bg-slate-50"
                >
                  <div className="text-xs space-y-1">
                    <div className="font-bold text-sm text-slate-900">
                      {t.name} (Quận {t.district})
                    </div>
                    <div>
                      Chủ sở hữu: <strong>{t.owner_name}</strong> ({t.owner_email}) - SĐT: {t.phone_contact}
                    </div>
                    <div>Địa chỉ: {t.address} | Tenant UUID: <span className="font-mono">{t.id}</span></div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTenantStatus(t.id, 'ACTIVE')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs font-semibold"
                    >
                      ✓ Duyệt mở khóa (ACTIVE)
                    </button>
                    <button
                      onClick={() => handleTenantStatus(t.id, 'REJECTED')}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-xs font-semibold"
                    >
                      ✕ Từ chối
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* KHỐI 3: DUYỆT KÉP BƯỚC 2 - DUYỆT SÂN MỚI DO CHỦ SÂN TẠO (PENDING -> PUBLISHED) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-bold text-slate-800 mb-3">
            2. Duyệt Sân Mới Tạo Để Mở Bán Lên Sàn ({approvals.pendingCourts.length})
          </h2>
          {approvals.pendingCourts.length === 0 ? (
            <p className="text-xs text-slate-500">Không có sân mới nào đang chờ duyệt.</p>
          ) : (
            <div className="space-y-3">
              {approvals.pendingCourts.map((c) => (
                <div
                  key={c.id}
                  className="p-3 border rounded-lg flex justify-between items-center bg-slate-50"
                >
                  <div className="text-xs">
                    <span className="font-bold text-sm text-slate-800">{c.name}</span>{' '}
                    <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">
                      Loại: {c.type}
                    </span>
                    <p className="text-slate-600 mt-1">
                      Thuộc cụm sân: <strong>{c.tenant_name}</strong> (Quận {c.district})
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCourtStatus(c.id, 'PUBLISHED')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs font-semibold"
                    >
                      ✓ Duyệt lên sàn (PUBLISHED)
                    </button>
                    <button
                      onClick={() => handleCourtStatus(c.id, 'REJECTED')}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-xs font-semibold"
                    >
                      ✕ Từ chối
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* KHỐI 4: DUYỆT THẺ HỌC SINH / SINH VIÊN CHO KHÁCH HÀNG */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-bold text-slate-800 mb-3">
            3. Duyệt Xác Thực Thẻ Học Sinh / Sinh Viên ({approvals.pendingStudents.length})
          </h2>
          {approvals.pendingStudents.length === 0 ? (
            <p className="text-xs text-slate-500">Không có yêu cầu xác thực thẻ Sinh viên nào.</p>
          ) : (
            <div className="space-y-3">
              {approvals.pendingStudents.map((st) => (
                <div
                  key={st.id}
                  className="p-3 border rounded-lg flex flex-wrap justify-between items-center gap-3 bg-slate-50"
                >
                  <div className="text-xs space-y-1">
                    <div className="font-bold text-sm text-slate-800">{st.full_name}</div>
                    <div>Email: {st.email} | SĐT: {st.phone}</div>
                    <div>
                      Ảnh thẻ SV:{' '}
                      <a
                        href={st.student_card_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 underline font-semibold"
                      >
                        {st.student_card_url || 'Xem ảnh thẻ'}
                      </a>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStudentVerify(st.id, 'VERIFIED')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs font-semibold"
                    >
                      🎓 Xác thực Sinh viên (VERIFIED)
                    </button>
                    <button
                      onClick={() => handleStudentVerify(st.id, 'REJECTED')}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-xs font-semibold"
                    >
                      ✕ Từ chối
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}