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
    const initData = async () => {
      await fetchAllData();
    };
    initData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const handleTenantStatus = async (id, status) => {
    try {
      const res = await axiosClient.put(`/super-admin/tenants/${id}/status`, { status });
      alert(res.data.message);
      fetchAllData();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi cập nhật trạng thái chủ sân.');
    }
  };

  const handleCourtStatus = async (id, status) => {
    try {
      const res = await axiosClient.put(`/super-admin/courts/${id}/status`, { status });
      alert(res.data.message);
      fetchAllData();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi duyệt sân.');
    }
  };

  const handleStudentVerify = async (userId, status) => {
    try {
      const res = await axiosClient.put(`/super-admin/students/${userId}/verify`, { status });
      alert(res.data.message);
      fetchAllData();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi duyệt thẻ sinh viên.');
    }
  };

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
    <div className="min-h-screen bg-[#F8FAFC] pb-16">
      {/* HEADER */}
      <header className="bg-slate-900 text-white px-6 py-5 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-full">
              Platform Control Center
            </span>
            <h1 className="text-2xl font-black tracking-tight mt-1">Super Admin Portal</h1>
            <p className="text-xs text-slate-400">
              Quản lý Doanh thu Gói cước SaaS, Duyệt Kép Chủ sân / Sân mới & Xác thực Thẻ Sinh viên
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-white/10 px-3.5 py-1.5 rounded-full font-bold">
              👑 {user?.fullName}
            </span>
            <button
              onClick={() => { logout(); navigate('/'); }}
              className="text-xs bg-red-600 hover:bg-red-700 px-3.5 py-2 rounded-xl font-bold transition"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* KHỐI 1: THỐNG KÊ & GHI NHẬN HỢP ĐỒNG SAAS */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Tổng Doanh Thu Gói Cước SaaS
              </p>
              <p className="text-3xl font-black text-emerald-600 mt-2">
                {Number(dashboard.saasRevenue?.total_saas_revenue || 0).toLocaleString()} ₫
              </p>
            </div>
            <p className="text-xs text-slate-500 mt-4 pt-3 border-t border-slate-100">
              Tổng số hợp đồng thuê phần mềm đã thanh toán: <strong>{dashboard.saasRevenue?.total_subscriptions || 0}</strong>
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">
              Hồ Sơ Đang Chờ Phê Duyệt
            </p>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl">
                <span className="font-semibold text-slate-700">🏟️ Chủ sân mới chờ duyệt</span>
                <strong className="bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full">{approvals.pendingTenants.length}</strong>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl">
                <span className="font-semibold text-slate-700">🏸 Sân con mới chờ mở bán</span>
                <strong className="bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full">{approvals.pendingCourts.length}</strong>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl">
                <span className="font-semibold text-slate-700">🎓 Thẻ Sinh viên chờ xác thực</span>
                <strong className="bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full">{approvals.pendingStudents.length}</strong>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleRecordSubscription}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-3"
          >
            <p className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
              Ghi nhận Chủ sân đóng phí SaaS
            </p>
            <input
              type="text"
              required
              placeholder="Nhập UUID của Cụm sân (Tenant ID)..."
              value={subForm.tenantId}
              onChange={(e) => setSubForm({ ...subForm, tenantId: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                required
                placeholder="Giá/tháng"
                value={subForm.pricePerMonth}
                onChange={(e) => setSubForm({ ...subForm, pricePerMonth: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
              <input
                type="number"
                required
                placeholder="Số tháng"
                value={subForm.durationMonths}
                onChange={(e) => setSubForm({ ...subForm, durationMonths: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl text-xs font-bold transition"
            >
              + Ghi nhận Doanh thu SaaS
            </button>
          </form>
        </div>

        {/* KHỐI 2: DUYỆT CHỦ SÂN */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-900 mb-4">
            1. Duyệt Hồ sơ Đăng ký Chủ sân Mới ({approvals.pendingTenants.length})
          </h2>
          {approvals.pendingTenants.length === 0 ? (
            <p className="text-xs text-slate-400">Không có Chủ sân nào đang chờ duyệt.</p>
          ) : (
            <div className="space-y-3">
              {approvals.pendingTenants.map((t) => (
                <div
                  key={t.id}
                  className="p-4 border border-slate-100 rounded-2xl flex flex-wrap justify-between items-center gap-4 bg-slate-50"
                >
                  <div className="text-xs space-y-1">
                    <div className="font-extrabold text-sm text-slate-900">
                      {t.name} <span className="text-emerald-700">(Quận {t.district})</span>
                    </div>
                    <div className="text-slate-600">
                      Chủ sở hữu: <strong>{t.owner_name}</strong> ({t.owner_email}) — SĐT: {t.phone_contact}
                    </div>
                    <div className="text-slate-500 flex items-center gap-2">
                      <span>📍 {t.address} • UUID: <code className="bg-white border px-1.5 py-0.5 rounded">{t.id}</code></span>
                      <button
                        type="button"
                        onClick={() => setSubForm({ ...subForm, tenantId: t.id })}
                        className="text-emerald-600 font-bold hover:underline"
                      >
                        [Điền vào ô thu phí]
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTenantStatus(t.id, 'ACTIVE')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition"
                    >
                      ✓ Duyệt mở khóa (ACTIVE)
                    </button>
                    <button
                      onClick={() => handleTenantStatus(t.id, 'REJECTED')}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition"
                    >
                      ✕ Từ chối
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* KHỐI 3: DUYỆT SÂN MỚI */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-900 mb-4">
            2. Duyệt Sân Mới Tạo Để Mở Bán Lên Sàn ({approvals.pendingCourts.length})
          </h2>
          {approvals.pendingCourts.length === 0 ? (
            <p className="text-xs text-slate-400">Không có sân mới nào đang chờ duyệt.</p>
          ) : (
            <div className="space-y-3">
              {approvals.pendingCourts.map((c) => (
                <div
                  key={c.id}
                  className="p-4 border border-slate-100 rounded-2xl flex flex-wrap justify-between items-center gap-4 bg-slate-50"
                >
                  <div className="text-xs">
                    <span className="font-extrabold text-sm text-slate-900">{c.name}</span>{' '}
                    <span className="bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold ml-1">
                      Loại: {c.type}
                    </span>
                    <p className="text-slate-600 mt-1">
                      Thuộc cụm sân: <strong>{c.tenant_name}</strong> (Quận {c.district})
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCourtStatus(c.id, 'PUBLISHED')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition"
                    >
                      ✓ Duyệt lên sàn (PUBLISHED)
                    </button>
                    <button
                      onClick={() => handleCourtStatus(c.id, 'REJECTED')}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition"
                    >
                      ✕ Từ chối
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* KHỐI 4: DUYỆT THẺ SINH VIÊN */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-900 mb-4">
            3. Duyệt Xác Thực Thẻ Học Sinh / Sinh Viên ({approvals.pendingStudents.length})
          </h2>
          {approvals.pendingStudents.length === 0 ? (
            <p className="text-xs text-slate-400">Không có yêu cầu xác thực thẻ Sinh viên nào.</p>
          ) : (
            <div className="space-y-3">
              {approvals.pendingStudents.map((st) => (
                <div
                  key={st.id}
                  className="p-4 border border-slate-100 rounded-2xl flex flex-wrap justify-between items-center gap-4 bg-slate-50"
                >
                  <div className="text-xs space-y-1">
                    <div className="font-extrabold text-sm text-slate-900">{st.full_name}</div>
                    <div className="text-slate-600">Email: {st.email} • SĐT: {st.phone}</div>
                    <div>
                      Ảnh thẻ SV:{' '}
                      <a
                        href={st.student_card_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-600 underline font-bold"
                      >
                        {st.student_card_url || 'Mở xem ảnh thẻ'}
                      </a>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStudentVerify(st.id, 'VERIFIED')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition"
                    >
                      🎓 Xác thực Sinh viên (VERIFIED)
                    </button>
                    <button
                      onClick={() => handleStudentVerify(st.id, 'REJECTED')}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition"
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