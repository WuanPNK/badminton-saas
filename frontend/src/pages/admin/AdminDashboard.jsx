import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';
import SaasRevenueCharts from '../../components/admin/SaasRevenueCharts';
import ExpandableAddButton from '../../components/common/ExpandableAddButton';
import NotificationBell from '../../components/common/NotificationBell';
import { exportAdminRevenueToExcel, exportAdminRevenueToCSV } from '../../utils/excelExport';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Mặc định đăng nhập vào sẽ mở HUB / BẢNG ĐIỀU KHIỂN TRUNG TÂM
  const [tab, setTab] = useState('HUB');

  const [isExportingSaas, setIsExportingSaas] = useState(false);

  const handleExportSaasExcel = async () => {
    setIsExportingSaas(true);
    const toastId = toast.loading('Đang trích xuất toàn bộ sổ cái hợp đồng phần mềm...');
    try {
      const res = await axiosClient.get('/admin/revenue-export');
      if (res.data?.success && res.data?.exportData) {
        await exportAdminRevenueToExcel(res.data.exportData);
        toast.success('Đã xuất file Excel SaaS (.xlsx) thành công!', { id: toastId });
      } else {
        toast.error('Không tìm thấy dữ liệu để xuất.', { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi xuất file Excel. Vui lòng thử lại.', { id: toastId });
    } finally {
      setIsExportingSaas(false);
    }
  };

  const handleExportSaasCSV = async () => {
    setIsExportingSaas(true);
    const toastId = toast.loading('Đang chuẩn bị file CSV...');
    try {
      const res = await axiosClient.get('/admin/revenue-export');
      if (res.data?.success && res.data?.exportData) {
        exportAdminRevenueToCSV(res.data.exportData);
        toast.success('Đã xuất file CSV thành công!', { id: toastId });
      } else {
        toast.error('Không tìm thấy dữ liệu để xuất.', { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi xuất file CSV. Vui lòng thử lại.', { id: toastId });
    } finally {
      setIsExportingSaas(false);
    }
  };

  // Dữ liệu phê duyệt & Báo cáo
  const [approvals, setApprovals] = useState({
    pendingTenants: [],
    pendingCourts: [],
    pendingStudents: [],
    pendingSubscriptions: [],
  });
  const [dashboard, setDashboard] = useState({
    saasRevenue: { total_saas_revenue: 0, total_subscriptions: 0, average_deal: 0, this_month_revenue: 0 },
    monthlyRevenue: [],
    planDistribution: [],
    tenantRanking: [],
    tenantBreakdown: [],
    recentSubscriptions: [],
    pendingCounts: { pending_tenants: 0, pending_courts: 0, pending_students: 0 },
  });
  const [plans, setPlans] = useState([]);
  const [allTenants, setAllTenants] = useState([]);

  // Popup Xác nhận Tùy biến Hiện đại (Thay thế window.confirm mặc định của trình duyệt)
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Xác nhận',
    cancelText: 'Hủy bỏ',
    confirmColor: 'emerald', // 'emerald' | 'red' | 'amber'
    onConfirm: null,
  });

  const askConfirm = ({
    title,
    message,
    confirmText = 'Xác nhận',
    cancelText = 'Hủy bỏ',
    confirmColor = 'emerald',
    onConfirm,
  }) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      confirmText,
      cancelText,
      confirmColor,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        if (onConfirm) await onConfirm();
      },
    });
  };

  // Modal Xem trước Thẻ Học sinh / Sinh viên
  const [studentCardPreview, setStudentCardPreview] = useState(null);

  // Modal Thêm / Chỉnh sửa Gói Cước SaaS
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm, setPlanForm] = useState({
    name: '',
    pricePerMonth: 1200000,
    maxCourts: 10,
    description: '',
    badge: 'Phổ biến',
    commissionRate: 0,
    isFeatured: false,
    features: ['Đặt lịch trực tuyến 24/7', 'Mô-đun bán hàng POS', 'Cấu hình giá giờ vàng'],
    featureInput: '',
  });

  // Modal Ghi nhận / Gia hạn Hợp đồng SaaS cho Cụm sân
  const [showSubModal, setShowSubModal] = useState(false);
  const [subForm, setSubForm] = useState({
    tenantId: '',
    planId: '',
    durationMonths: 6,
    pricePerMonth: 1500000,
    discountPercent: 10,
    notes: '',
  });

  // Tìm kiếm trong các danh sách
  const [searchTenant, setSearchTenant] = useState('');
  const [searchCourt, setSearchCourt] = useState('');
  const [searchStudent, setSearchStudent] = useState('');
  const [searchSub, setSearchSub] = useState('');

  // Modal Từ chối & Hoàn tiền Gói cước
  const [rejectSubModal, setRejectSubModal] = useState({
    isOpen: false,
    sub: null,
    reason: '',
  });

  // Tải dữ liệu toàn diện
  const fetchAllData = async () => {
    try {
      const [appRes, dashRes, plansRes, tenantsRes] = await Promise.all([
        axiosClient.get('/admin/pending-approvals'),
        axiosClient.get('/admin/dashboard'),
        axiosClient.get('/admin/plans'),
        axiosClient.get('/admin/all-tenants'),
      ]);
      setApprovals(appRes.data.data);
      setDashboard(dashRes.data.data);
      setPlans(plansRes.data.data);
      setAllTenants(tenantsRes.data.data);
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi tải dữ liệu từ máy chủ.');
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // --- CÁC HÀM XỬ LÝ PHÊ DUYỆT ---
  const handleTenantStatus = (id, status, tenantName) => {
    const isApprove = status === 'ACTIVE';
    askConfirm({
      title: isApprove ? 'Duyệt Hồ Sơ Chủ Sân' : 'Từ Chối Hồ Sơ Chủ Sân',
      message: isApprove
        ? `Xác nhận phê duyệt và kích hoạt tài khoản cụm sân "${tenantName}"? Cụm sân sẽ chính thức được phép hoạt động trên hệ thống.`
        : `Bạn có chắc muốn từ chối hồ sơ đăng ký cụm sân "${tenantName}"?`,
      confirmText: isApprove ? 'Duyệt mở khóa' : 'Từ chối',
      confirmColor: isApprove ? 'emerald' : 'red',
      onConfirm: async () => {
        try {
          const res = await axiosClient.put(`/admin/tenants/${id}/status`, { status });
          toast.success(res.data.message);
          fetchAllData();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Lỗi cập nhật trạng thái chủ sân.');
        }
      },
    });
  };

  const handleCourtStatus = (id, status, courtName) => {
    const isApprove = status === 'PUBLISHED';
    askConfirm({
      title: isApprove ? 'Duyệt Sân Mới Mở Bán' : 'Từ Chối Duyệt Sân',
      message: isApprove
        ? `Xác nhận phê duyệt sân "${courtName}" lên sàn? Khách hàng có thể nhìn thấy và đặt lịch trực tuyến.`
        : `Bạn có chắc muốn từ chối đưa sân "${courtName}" lên sàn?`,
      confirmText: isApprove ? 'Duyệt lên sàn' : 'Từ chối',
      confirmColor: isApprove ? 'emerald' : 'red',
      onConfirm: async () => {
        try {
          const res = await axiosClient.put(`/admin/courts/${id}/status`, { status });
          toast.success(res.data.message);
          fetchAllData();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Lỗi duyệt sân.');
        }
      },
    });
  };

  const handleStudentVerify = (userId, status, studentName) => {
    const isApprove = status === 'VERIFIED';
    askConfirm({
      title: isApprove ? 'Xác Thực Thẻ Sinh Viên' : 'Từ Chối Thẻ Sinh Viên',
      message: isApprove
        ? `Xác nhận thông tin thẻ học sinh/sinh viên của "${studentName}" hợp lệ? Tài khoản sẽ được hưởng chính sách giảm giá ưu đãi khi đặt sân.`
        : `Bạn có chắc muốn từ chối yêu cầu xác thực thẻ của "${studentName}"?`,
      confirmText: isApprove ? 'Xác thực ngay' : 'Từ chối',
      confirmColor: isApprove ? 'emerald' : 'red',
      onConfirm: async () => {
        try {
          const res = await axiosClient.put(`/admin/students/${userId}/verify`, { status });
          toast.success(res.data.message);
          fetchAllData();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Lỗi duyệt thẻ sinh viên.');
        }
      },
    });
  };

  // --- XỬ LÝ DUYỆT GÓI CƯỚC SAAS & HOÀN TIỀN ---
  const handleApproveSubscription = (sub) => {
    askConfirm({
      title: 'Phê Duyệt Gói Cước SaaS',
      message: `Xác nhận phê duyệt và kích hoạt gói "${sub.plan_name}" cho cụm sân "${sub.tenant_name}"? Số tiền đã thanh toán: ${Number(sub.amount_paid).toLocaleString()} ₫ (Mã GD: ${sub.transaction_code || 'N/A'}).`,
      confirmText: 'Duyệt & Kích hoạt',
      confirmColor: 'emerald',
      onConfirm: async () => {
        try {
          const res = await axiosClient.put(`/admin/subscriptions/${sub.id}/approve`);
          toast.success(res.data.message);
          fetchAllData();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Lỗi khi phê duyệt gói cước.');
        }
      },
    });
  };

  const handleOpenRejectSub = (sub) => {
    setRejectSubModal({
      isOpen: true,
      sub,
      reason: 'Thông tin đối soát giao dịch thanh toán không khớp với tài khoản ngân hàng.',
    });
  };

  const handleConfirmRejectSub = async () => {
    if (!rejectSubModal.sub) return;
    try {
      const res = await axiosClient.put(`/admin/subscriptions/${rejectSubModal.sub.id}/reject`, {
        rejectionReason: rejectSubModal.reason,
      });
      toast.success(res.data.message);
      setRejectSubModal({ isOpen: false, sub: null, reason: '' });
      fetchAllData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi từ chối gói cước.');
    }
  };

  // --- CÁC HÀM XỬ LÝ GÓI CƯỚC SAAS ---
  const openCreatePlanModal = () => {
    setEditingPlan(null);
    setPlanForm({
      name: '',
      pricePerMonth: 199000,
      maxCourts: 8,
      description: 'Gói tiêu chuẩn đầy đủ tính năng cho cụm sân',
      badge: 'Phổ biến (4-8 sân)',
      commissionRate: 3,
      isFeatured: false,
      features: [
        'Quản lý tối đa 8 sân cầu lông',
        'Đặt lịch trực tuyến và VietQR 24/7',
        'Mô-đun bán hàng và quản lý kho POS',
        'Cấu hình Bảng giá động giờ cao điểm',
        '0% phí giao dịch đối với đơn tại quầy',
      ],
      featureInput: '',
    });
    setShowPlanModal(true);
  };

  const openEditPlanModal = (plan) => {
    setEditingPlan(plan);
    const existingFeatures = Array.isArray(plan.features)
      ? plan.features
      : typeof plan.features === 'string'
      ? JSON.parse(plan.features)
      : [];

    setPlanForm({
      name: plan.name,
      pricePerMonth: Number(plan.price_per_month),
      maxCourts: plan.max_courts,
      description: plan.description || '',
      badge: plan.badge || '',
      commissionRate: Number(plan.commission_rate || 0),
      isFeatured: Boolean(plan.is_featured),
      features: existingFeatures,
      featureInput: '',
    });
    setShowPlanModal(true);
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    try {
      if (editingPlan) {
        await axiosClient.put(`/admin/plans/${editingPlan.id}`, planForm);
        toast.success('Đã cập nhật gói cước phần mềm thành công!');
      } else {
        await axiosClient.post('/admin/plans', planForm);
        toast.success('Đã tạo gói cước phần mềm mới thành công!');
      }
      setShowPlanModal(false);
      fetchAllData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi lưu gói cước.');
    }
  };

  const handleDeletePlan = (plan) => {
    askConfirm({
      title: 'Xóa hoặc Tạm Ẩn Gói Cước',
      message: `Bạn có chắc muốn xóa hoặc tạm ẩn gói cước "${plan.name}"? Các chủ sân đang sử dụng sẽ không bị ảnh hưởng.`,
      confirmText: 'Xác nhận xóa/ẩn',
      confirmColor: 'red',
      onConfirm: async () => {
        try {
          const res = await axiosClient.delete(`/admin/plans/${plan.id}`);
          toast.success(res.data.message);
          fetchAllData();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Lỗi khi xóa gói cước.');
        }
      },
    });
  };

  const addFeatureToPlan = () => {
    if (!planForm.featureInput.trim()) return;
    setPlanForm({
      ...planForm,
      features: [...planForm.features, planForm.featureInput.trim()],
      featureInput: '',
    });
  };

  const removeFeatureFromPlan = (idx) => {
    setPlanForm({
      ...planForm,
      features: planForm.features.filter((_, i) => i !== idx),
    });
  };

  // --- CÁC HÀM XỬ LÝ GÁN HỢP ĐỒNG / GIA HẠN SAAS ---
  const openAssignModal = (prefillTenantId = '') => {
    const defaultPlan = plans[0] || {};
    setSubForm({
      tenantId: prefillTenantId,
      planId: defaultPlan.id || '',
      durationMonths: 6,
      pricePerMonth: Number(defaultPlan.price_per_month || 199000),
      discountPercent: 10,
      notes: '',
    });
    setShowSubModal(true);
  };

  const handleRecordSubscription = async (e) => {
    e.preventDefault();
    try {
      const res = await axiosClient.post('/admin/subscriptions/record', subForm);
      toast.success(res.data.message);
      setShowSubModal(false);
      fetchAllData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi kích hoạt hợp đồng phần mềm.');
    }
  };

  // Danh mục tab điều hướng phía trên (Đã loại bỏ tab Hub trùng lặp, dùng nút Back ở Header)
  const TAB_ITEMS = [
    {
      id: 'SUBSCRIPTIONS',
      label: `Duyệt Gói Cước (${approvals.pendingSubscriptions?.length || 0})`,
      badge: approvals.pendingSubscriptions?.length || 0,
    },
    {
      id: 'TENANTS',
      label: `Duyệt Chủ Sân (${approvals.pendingTenants.length})`,
      badge: approvals.pendingTenants.length,
    },
    {
      id: 'COURTS',
      label: `Duyệt Sân Mới (${approvals.pendingCourts.length})`,
      badge: approvals.pendingCourts.length,
    },
    {
      id: 'STUDENTS',
      label: `Duyệt Thẻ HSSV (${approvals.pendingStudents.length})`,
      badge: approvals.pendingStudents.length,
    },
    { id: 'PRICING', label: `Cấu Hình Giá & Gói Dịch Vụ (${plans.length})` },
    { id: 'REVENUE', label: 'Doanh Thu & Biểu Đồ' },
    { id: 'ALL_TENANTS', label: `Quản Lý Cụm Sân (${allTenants.length})` },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16 font-sans">
      {/* HEADER QUẢN TRỊ NỀN TẢNG */}
      <header className="bg-slate-900 text-white px-6 py-4 shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            {tab !== 'HUB' && (
              <button
                onClick={() => setTab('HUB')}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-emerald-300 text-xs font-extrabold px-3 py-2 rounded-xl transition"
              >
                <span>‹</span>
                <span>Bảng điều khiển</span>
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-full">
                  Platform Control Center
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline">Badminton SaaS Ecosystem</span>
              </div>
              <h1 className="text-xl font-black tracking-tight mt-0.5">Admin Portal</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs bg-white/10 px-3.5 py-2 rounded-xl font-bold text-slate-200 hidden sm:inline-block">
              {user?.fullName || 'Quản Trị Viên'}
            </span>
            <button
              onClick={() => {
                logout();
                navigate('/');
              }}
              className="text-xs bg-red-600 hover:bg-red-700 active:scale-95 text-white px-4 py-2 rounded-xl font-bold transition shadow-sm"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        {/* SUB-NAVIGATOR (Thanh điều hướng chuyển tab khi không ở Hub) */}
        {tab !== 'HUB' && (
          <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-100 mb-6 overflow-x-auto text-xs font-bold">
            {TAB_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`px-3.5 py-2 rounded-xl whitespace-nowrap transition flex items-center gap-1.5 ${
                  tab === item.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100/70'
                }`}
              >
                <span>{item.label}</span>
                {item.badge > 0 && (
                  <span className="bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded-full text-[10px] font-black">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 1: HUB / BẢNG ĐIỀU KHIỂN TRUNG TÂM (LẤY CẢM HỨNG TỪ ẢNH 2) */}
        {/* ========================================================= */}
        {tab === 'HUB' && (
          <div className="space-y-6">
            {/* HERO BANNER */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
              <div className="relative z-10 max-w-2xl">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-500/30">
                  Trung Tâm Quản Trị Hệ Thống SaaS
                </span>
                <h2 className="text-2xl sm:text-3xl font-black mt-3">
                  Chào mừng trở lại, {user?.fullName || 'Admin'}!
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                  Lựa chọn một danh mục quản trị dưới đây để kiểm duyệt hồ sơ mở sân mới, cấu hình bảng giá thuê nền tảng cho các chủ sân hoặc theo dõi biểu đồ tăng trưởng doanh thu.
                </p>

                {/* THỐNG KÊ NHANH TRÊN HERO BANNER */}
                <div className="flex flex-wrap gap-3 mt-5 text-xs font-bold">
                  <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 flex items-center gap-2">
                    <span className="text-emerald-400">Tổng Doanh Thu SaaS:</span>
                    <span className="text-white font-black text-sm">
                      {Number(dashboard.saasRevenue?.total_saas_revenue || 0).toLocaleString()} ₫
                    </span>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 flex items-center gap-2">
                    <span className="text-amber-400">Đang Chờ Duyệt:</span>
                    <span className="text-white font-black text-sm">
                      {(approvals.pendingSubscriptions?.length || 0) +
                        approvals.pendingTenants.length +
                        approvals.pendingCourts.length +
                        approvals.pendingStudents.length}{' '}
                      hồ sơ
                    </span>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 flex items-center gap-2">
                    <span className="text-cyan-400">Cụm Sân Hoạt Động:</span>
                    <span className="text-white font-black text-sm">
                      {allTenants.filter((t) => t.status === 'ACTIVE').length} / {allTenants.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* LƯỚI CARD CHỨC NĂNG (GIAO DIỆN DỊU MẮT, RÕ RÀNG, CHUYÊN NGHIỆP) */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* CARD 0: DUYỆT GÓI CƯỚC SAAS CHỦ SÂN */}
              <div
                onClick={() => setTab('SUBSCRIPTIONS')}
                className="group cursor-pointer rounded-3xl p-6 bg-white border border-slate-200/90 hover:border-indigo-500 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between h-52 relative overflow-hidden shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center shadow-sm">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <span
                    className={`text-[11px] font-black px-3 py-1 rounded-full ${
                      (approvals.pendingSubscriptions?.length || 0) > 0
                        ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {approvals.pendingSubscriptions?.length || 0} Đơn chờ duyệt
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 group-hover:text-indigo-700 transition-colors tracking-tight">
                    Duyệt Gói Cước Chủ Sân
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed font-medium">
                    Chủ sân chọn gói và thanh toán VietQR. Phê duyệt để kích hoạt hoặc từ chối để hoàn tiền tự động
                  </p>
                </div>
                <div className="text-[11px] font-bold text-slate-400 group-hover:text-indigo-600 pt-2 border-t border-slate-100 flex justify-between items-center transition-colors">
                  <span>Xử lý yêu cầu gói cước</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
              {/* CARD 1: DUYỆT HỒ SƠ CHỦ SÂN */}
              <div
                onClick={() => setTab('TENANTS')}
                className="group cursor-pointer rounded-3xl p-6 bg-white border border-slate-200/90 hover:border-emerald-500 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between h-52 relative overflow-hidden shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shadow-sm">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <span className="text-[11px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200/70 px-3 py-1 rounded-full">
                    {approvals.pendingTenants.length} Hồ sơ chờ
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 group-hover:text-emerald-700 transition-colors tracking-tight">
                    Duyệt Hồ Sơ Chủ Sân
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed font-medium">
                    Thẩm định hồ sơ cụm sân mới đăng ký, thông tin liên hệ chủ sở hữu và kích hoạt tài khoản
                  </p>
                </div>
                <div className="text-[11px] font-bold text-slate-400 group-hover:text-emerald-600 pt-2 border-t border-slate-100 flex justify-between items-center transition-colors">
                  <span>Xem danh sách duyệt</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>

              {/* CARD 2: DUYỆT SÂN MỚI TẠO */}
              <div
                onClick={() => setTab('COURTS')}
                className="group cursor-pointer rounded-3xl p-6 bg-white border border-slate-200/90 hover:border-teal-500 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between h-52 relative overflow-hidden shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center shadow-sm">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7M4 18h2" />
                    </svg>
                  </div>
                  <span className="text-[11px] font-black bg-teal-50 text-teal-800 border border-teal-200/70 px-3 py-1 rounded-full">
                    {approvals.pendingCourts.length} Sân chờ
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 group-hover:text-teal-700 transition-colors tracking-tight">
                    Duyệt Sân Mở Bán
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed font-medium">
                    Kiểm duyệt các sân con (Tiêu chuẩn / VIP) do chủ sân tạo trước khi chính thức hiển thị lên sàn
                  </p>
                </div>
                <div className="text-[11px] font-bold text-slate-400 group-hover:text-teal-600 pt-2 border-t border-slate-100 flex justify-between items-center transition-colors">
                  <span>Mở xét duyệt sân</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>

              {/* CARD 3: DUYỆT XÁC THỰC THẺ SINH VIÊN */}
              <div
                onClick={() => setTab('STUDENTS')}
                className="group cursor-pointer rounded-3xl p-6 bg-white border border-slate-200/90 hover:border-amber-500 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between h-52 relative overflow-hidden shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center shadow-sm">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5" />
                    </svg>
                  </div>
                  <span className="text-[11px] font-black bg-amber-50 text-amber-800 border border-amber-200/70 px-3 py-1 rounded-full">
                    {approvals.pendingStudents.length} Yêu cầu
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 group-hover:text-amber-700 transition-colors tracking-tight">
                    Duyệt Xác Thực Thẻ HSSV
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed font-medium">
                    Xem ảnh chụp thẻ học sinh/sinh viên và cấp quyền hưởng chính sách giảm giá ưu đãi
                  </p>
                </div>
                <div className="text-[11px] font-bold text-slate-400 group-hover:text-amber-600 pt-2 border-t border-slate-100 flex justify-between items-center transition-colors">
                  <span>Kiểm tra ảnh thẻ</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>

              {/* CARD 4: THAY ĐỔI GIÁ & GÓI CƯỚC SAAS */}
              <div
                onClick={() => setTab('PRICING')}
                className="group cursor-pointer rounded-3xl p-6 bg-white border border-slate-200/90 hover:border-purple-500 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between h-52 relative overflow-hidden shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 border border-purple-100 flex items-center justify-center shadow-sm">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                  <span className="text-[11px] font-black bg-purple-50 text-purple-800 border border-purple-200/70 px-3 py-1 rounded-full">
                    {plans.length} Gói cước
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 group-hover:text-purple-700 transition-colors tracking-tight">
                    Cấu Hình Giá & Gói Dịch Vụ
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed font-medium">
                    Mô hình giá thực tế ALOBO (99k – 299k/tháng, 14 ngày dùng thử, hoa hồng app 0% – 5%)
                  </p>
                </div>
                <div className="text-[11px] font-bold text-slate-400 group-hover:text-purple-600 pt-2 border-t border-slate-100 flex justify-between items-center transition-colors">
                  <span>Tùy chỉnh bảng giá</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>

              {/* CARD 5: DOANH THU & BIỂU ĐỒ TRỰC QUAN */}
              <div
                onClick={() => setTab('REVENUE')}
                className="group cursor-pointer rounded-3xl p-6 bg-white border border-slate-200/90 hover:border-indigo-500 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between h-52 relative overflow-hidden shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center shadow-sm">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <span className="text-[11px] font-black bg-indigo-50 text-indigo-800 border border-indigo-200/70 px-3 py-1 rounded-full">
                    Trực quan
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 group-hover:text-indigo-700 transition-colors tracking-tight">
                    Doanh Thu & Biểu Đồ
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed font-medium">
                    Biểu đồ cột xu hướng 6 tháng, cơ cấu gói cước, chỉ số tài chính và xếp hạng đóng góp cụm sân
                  </p>
                </div>
                <div className="text-[11px] font-bold text-slate-400 group-hover:text-indigo-600 pt-2 border-t border-slate-100 flex justify-between items-center transition-colors">
                  <span>Xem báo cáo chi tiết</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>

              {/* CARD 6: QUẢN LÝ TẤT CẢ CỤM SÂN */}
              <div
                onClick={() => setTab('ALL_TENANTS')}
                className="group cursor-pointer rounded-3xl p-6 bg-white border border-slate-200/90 hover:border-blue-500 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between h-52 relative overflow-hidden shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center shadow-sm">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                    </svg>
                  </div>
                  <span className="text-[11px] font-black bg-slate-100 text-slate-700 border border-slate-200/70 px-2.5 py-1 rounded-full">
                    {allTenants.length} Cụm sân
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 group-hover:text-blue-700 transition-colors tracking-tight">
                    Danh Sách Cụm Sân
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed font-medium">
                    Quản lý toàn bộ cụm sân, thời hạn gói cước, gia hạn nhanh và khóa/mở khóa tài khoản
                  </p>
                </div>
                <div className="text-[11px] font-bold text-slate-400 group-hover:text-blue-600 pt-2 border-t border-slate-100 flex justify-between items-center transition-colors">
                  <span>Quản lý hệ thống</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 1.5: DUYỆT YÊU CẦU GÓI CƯỚC SAAS CỦA CHỦ SÂN */}
        {/* ========================================================= */}
        {tab === 'SUBSCRIPTIONS' && (
          <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  Duyệt Yêu Cầu Đăng Ký & Gia Hạn Gói Cước SaaS
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chủ sân tự chọn gói cước và thanh toán VietQR. Admin phê duyệt để kích hoạt hoặc từ chối để hoàn tiền 100% về tài khoản của chủ sân.
                </p>
              </div>

              <div className="w-full sm:w-72">
                <input
                  type="text"
                  placeholder="Tìm kiếm giao dịch..."
                  value={searchSub}
                  onChange={(e) => setSearchSub(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-slate-100 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h3 className="font-extrabold text-slate-900 text-base">
                  Yêu Cầu Chờ Phê Duyệt ({approvals.pendingSubscriptions?.length || 0})
                </h3>
              </div>

              {(!approvals.pendingSubscriptions || approvals.pendingSubscriptions.length === 0) ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Hiện không có yêu cầu gói cước nào đang chờ duyệt.
                </div>
              ) : (
                <div className="space-y-4">
                  {approvals.pendingSubscriptions
                    .filter((s) => {
                      if (!searchSub.trim()) return true;
                      const q = searchSub.toLowerCase();
                      return (
                        s.tenant_name?.toLowerCase().includes(q) ||
                        s.owner_name?.toLowerCase().includes(q) ||
                        s.plan_name?.toLowerCase().includes(q) ||
                        s.transaction_code?.toLowerCase().includes(q)
                      );
                    })
                    .map((s) => (
                      <div
                        key={s.id}
                        className="p-5 border border-slate-200/90 bg-slate-50/70 hover:bg-white hover:shadow-md rounded-3xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 transition-all"
                      >
                        <div className="space-y-2 text-xs flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-black text-slate-900">{s.tenant_name}</span>
                            <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                              Quận {s.district}
                            </span>
                            <span className="bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold animate-pulse">
                              Chờ phê duyệt thanh toán
                            </span>
                            {s.tenant_status === 'PENDING' && (
                              <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                Cụm sân mới
                              </span>
                            )}
                          </div>

                          <div className="text-slate-600">
                            Chủ sân: <strong className="text-slate-900">{s.owner_name}</strong> • Email:{' '}
                            <strong className="text-slate-800">{s.owner_email}</strong> • Hotline:{' '}
                            <strong className="text-slate-900">{s.phone_contact || s.owner_phone}</strong>
                          </div>

                          <div className="grid sm:grid-cols-2 gap-3 pt-2">
                            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 space-y-1.5 shadow-xs">
                              <div className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">
                                Thông tin Gói Cước
                              </div>
                              <div className="text-xs font-bold text-slate-900">{s.plan_name}</div>
                              <div className="text-[11px] text-slate-500">
                                Quy mô: <strong>{Number(s.max_courts) >= 999 ? 'Không giới hạn' : `${s.max_courts} sân con`}</strong> • Chu kỳ:{' '}
                                <strong className="text-indigo-700">
                                  {s.billing_cycle === 'YEARLY'
                                    ? '1 Năm (Giảm 20%)'
                                    : s.billing_cycle === '6_MONTHS'
                                    ? '6 Tháng (Giảm 10%)'
                                    : Number(s.amount_paid) === 0
                                    ? 'Dùng thử 14 ngày'
                                    : '1 Tháng'}
                                </strong>
                              </div>
                              <div className="text-emerald-700 font-black text-sm pt-0.5">
                                Số tiền: {Number(s.amount_paid).toLocaleString()} ₫
                              </div>
                              {s.transaction_code && (
                                <div className="text-[11px] font-mono text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 inline-block">
                                  Mã GD: <strong>{s.transaction_code}</strong>
                                </div>
                              )}
                              {s.payment_proof_note && (
                                <div className="text-[11px] text-slate-500 italic">
                                  "{s.payment_proof_note}"
                                </div>
                              )}
                            </div>

                            <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200/80 space-y-1.5 shadow-xs">
                              <div className="text-[10px] font-black uppercase text-amber-800 tracking-wider">
                                Tài Khoản Hoàn Tiền (Nếu từ chối)
                              </div>
                              <div className="text-xs text-slate-700">
                                Ngân hàng: <strong className="text-slate-900">{s.refund_bank_name || 'Chưa cung cấp'}</strong>
                              </div>
                              <div className="text-xs text-slate-700">
                                Số tài khoản:{' '}
                                <strong className="font-mono text-slate-900 text-sm bg-white px-2 py-0.5 rounded border border-amber-200">
                                  {s.refund_account_number || 'N/A'}
                                </strong>
                              </div>
                              <div className="text-xs text-slate-700">
                                Chủ tài khoản: <strong className="text-slate-900">{s.refund_account_name || 'N/A'}</strong>
                              </div>
                              <div className="text-[10px] text-amber-800 font-semibold pt-0.5">
                                Hoàn lại 100% ({Number(s.amount_paid).toLocaleString()} ₫) nếu không duyệt
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex sm:flex-col gap-2 w-full lg:w-auto shrink-0">
                          <button
                            type="button"
                            onClick={() => handleApproveSubscription(s)}
                            className="flex-1 lg:flex-initial bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center"
                          >
                            Phê duyệt kích hoạt
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenRejectSub(s)}
                            className="flex-1 lg:flex-initial bg-red-600 hover:bg-red-700 active:scale-95 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center"
                          >
                            Từ chối & Hoàn tiền
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: DUYỆT HỒ SƠ CHỦ SÂN */}
        {/* ========================================================= */}
        {tab === 'TENANTS' && (
          <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-900">Duyệt Hồ Sơ Đăng Ký Chủ Sân</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kiểm duyệt thông tin cụm sân mới, địa chỉ và thông tin liên hệ của chủ sở hữu
                </p>
              </div>

              <div className="w-full sm:w-72">
                <input
                  type="text"
                  placeholder="Tìm kiếm cụm sân..."
                  value={searchTenant}
                  onChange={(e) => setSearchTenant(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-slate-100 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h3 className="font-extrabold text-slate-900 text-base">
                  Danh sách Hồ sơ chờ phê duyệt ({approvals.pendingTenants.length})
                </h3>
              </div>

              {approvals.pendingTenants.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Hiện không có hồ sơ chủ sân nào đang chờ duyệt.
                </div>
              ) : (
                <div className="space-y-3">
                  {approvals.pendingTenants
                    .filter((t) => {
                      if (!searchTenant.trim()) return true;
                      const q = searchTenant.toLowerCase();
                      return (
                        t.name.toLowerCase().includes(q) ||
                        t.district.toLowerCase().includes(q) ||
                        t.owner_email?.toLowerCase().includes(q)
                      );
                    })
                    .map((t) => (
                      <div
                        key={t.id}
                        className="p-5 border border-slate-200/80 bg-slate-50/70 hover:bg-white hover:shadow-sm rounded-2xl flex flex-wrap justify-between items-center gap-4 transition"
                      >
                        <div className="text-xs space-y-1.5">
                          <div className="flex items-center gap-2">
                            <strong className="text-sm font-black text-slate-900">{t.name}</strong>
                            <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                              Quận {t.district}
                            </span>
                            <span className="bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                              Chờ phê duyệt
                            </span>
                          </div>
                          <div className="text-slate-600">
                            Chủ sở hữu: <strong>{t.owner_name}</strong> ({t.owner_email}) — Hotline:{' '}
                            <strong className="text-slate-900">{t.phone_contact}</strong>
                          </div>
                          <div className="text-slate-500 flex flex-wrap items-center gap-2">
                            <span>{t.address}</span>
                            <span>•</span>
                            <span>
                              UUID:{' '}
                              <code className="bg-white border px-1.5 py-0.5 rounded font-mono text-[11px]">
                                {t.id}
                              </code>
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openAssignModal(t.id)}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3.5 py-2 rounded-xl text-xs font-bold transition"
                          >
                            Gán gói cước phần mềm
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTenantStatus(t.id, 'ACTIVE', t.name)}
                            className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm"
                          >
                            Duyệt kích hoạt cụm sân
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTenantStatus(t.id, 'REJECTED', t.name)}
                            className="bg-red-600 hover:bg-red-700 active:scale-95 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition"
                          >
                            Từ chối
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: DUYỆT SÂN MỚI TẠO */}
        {/* ========================================================= */}
        {tab === 'COURTS' && (
          <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-900">Duyệt Sân Mới Mở Bán</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kiểm duyệt và cho phép hiển thị các sân đấu mới tạo lên sàn giao dịch
                </p>
              </div>

              <div className="w-full sm:w-72">
                <input
                  type="text"
                  placeholder="Tìm kiếm sân..."
                  value={searchCourt}
                  onChange={(e) => setSearchCourt(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-slate-100 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h3 className="font-extrabold text-slate-900 text-base">
                  Sân con đang chờ mở bán ({approvals.pendingCourts.length})
                </h3>
              </div>

              {approvals.pendingCourts.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Không có sân con nào đang chờ duyệt lên sàn.
                </div>
              ) : (
                <div className="space-y-3">
                  {approvals.pendingCourts
                    .filter((c) => {
                      if (!searchCourt.trim()) return true;
                      const q = searchCourt.toLowerCase();
                      return (
                        c.name.toLowerCase().includes(q) ||
                        c.tenant_name.toLowerCase().includes(q) ||
                        c.district.toLowerCase().includes(q)
                      );
                    })
                    .map((c) => (
                      <div
                        key={c.id}
                        className="p-5 border border-slate-200/80 bg-slate-50/70 hover:bg-white hover:shadow-sm rounded-2xl flex flex-wrap justify-between items-center gap-4 transition"
                      >
                        <div className="text-xs space-y-1">
                          <div className="flex items-center gap-2">
                            <strong className="text-sm font-black text-slate-900">{c.name}</strong>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                c.type === 'VIP'
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : 'bg-blue-100 text-blue-900 border-blue-200'
                              }`}
                            >
                              Loại: {c.type === 'VIP' ? 'Sân VIP' : 'Tiêu chuẩn'}
                            </span>
                            <span className="bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                              Chờ duyệt
                            </span>
                          </div>
                          <p className="text-slate-600 mt-1">
                            Thuộc cụm sân: <strong>{c.tenant_name}</strong> (Quận {c.district})
                          </p>
                          <p className="text-slate-400 text-[11px]">
                            Ngày gửi: {new Date(c.created_at).toLocaleDateString('vi-VN')}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleCourtStatus(c.id, 'PUBLISHED', c.name)}
                            className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm"
                          >
                            Duyệt mở bán trên sàn
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCourtStatus(c.id, 'REJECTED', c.name)}
                            className="bg-red-600 hover:bg-red-700 active:scale-95 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition"
                          >
                            Từ chối
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: DUYỆT XÁC THỰC THẺ HỌC SINH / SINH VIÊN */}
        {/* ========================================================= */}
        {tab === 'STUDENTS' && (
          <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-900">Duyệt Xác Thực Thẻ Học Sinh / Sinh Viên</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Xác minh thẻ HSSV để người dùng được áp dụng giá ưu đãi khi đặt sân
                </p>
              </div>

              <div className="w-full sm:w-72">
                <input
                  type="text"
                  placeholder="Tìm kiếm học sinh, sinh viên..."
                  value={searchStudent}
                  onChange={(e) => setSearchStudent(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-slate-100 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h3 className="font-extrabold text-slate-900 text-base">
                  Yêu cầu đang chờ duyệt ({approvals.pendingStudents.length})
                </h3>
              </div>

              {approvals.pendingStudents.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Không có yêu cầu xác thực thẻ Sinh viên nào đang chờ xử lý.
                </div>
              ) : (
                <div className="space-y-3">
                  {approvals.pendingStudents
                    .filter((st) => {
                      if (!searchStudent.trim()) return true;
                      const q = searchStudent.toLowerCase();
                      return (
                        st.full_name?.toLowerCase().includes(q) ||
                        st.email?.toLowerCase().includes(q) ||
                        st.phone?.includes(q)
                      );
                    })
                    .map((st) => (
                      <div
                        key={st.id}
                        className="p-5 border border-slate-200/80 bg-slate-50/70 hover:bg-white hover:shadow-sm rounded-2xl flex flex-wrap justify-between items-center gap-4 transition"
                      >
                        <div className="text-xs space-y-1">
                          <div className="flex items-center gap-2">
                            <strong className="text-sm font-black text-slate-900">{st.full_name}</strong>
                            <span className="bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                              Chờ thẩm định thẻ
                            </span>
                          </div>
                          <div className="text-slate-600">
                            Email: <strong>{st.email}</strong> • Hotline:{' '}
                            <strong className="text-slate-900">{st.phone || 'Chưa cập nhật'}</strong>
                          </div>
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => setStudentCardPreview(st)}
                              className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg font-bold text-xs hover:bg-emerald-100 transition"
                            >
                              Mở xem ảnh thẻ sinh viên
                            </button>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleStudentVerify(st.id, 'VERIFIED', st.full_name)}
                            className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm"
                          >
                            Xác thực sinh viên hợp lệ
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStudentVerify(st.id, 'REJECTED', st.full_name)}
                            className="bg-red-600 hover:bg-red-700 active:scale-95 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition"
                          >
                            Từ chối
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 5: THAY ĐỔI GIÁ & GÓI CƯỚC SAAS CHO CHỦ SÂN */}
        {/* ========================================================= */}
        {tab === 'PRICING' && (
          <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  Cấu Hình Bảng Giá Thuê Nền Tảng & Gói Cước SaaS
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tùy biến mức phí thuê phần mềm cho các chủ sân để được niêm yết lên website, mở rộng hạn mức và tính năng
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openAssignModal()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                >
                  <span>Ghi nhận / Gia hạn gói</span>
                </button>
                <ExpandableAddButton
                  label="Thêm gói cước mới"
                  onClick={openCreatePlanModal}
                />
              </div>
            </div>

            {/* THAM CHIẾU MÔ HÌNH ĐỊNH GIÁ THỰC TẾ (ALOBO SAAS) */}
            <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-900 text-white rounded-3xl p-6 shadow-md border border-emerald-800/40 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                    Mô Hình Nghiên Cứu Thị Trường (ALOBO)
                  </span>
                  <span className="text-xs text-slate-300 font-bold">
                    Cơ Chế Định Giá Kết Hợp: Phần Mềm Quản Lý Sân + Sàn Đặt Lịch Trực Tuyến
                  </span>
                </div>
                <span className="text-[11px] text-emerald-400 font-bold">3 Gói Cước SaaS Chuyên Nghiệp</span>
              </div>

              <div className="grid md:grid-cols-3 gap-4 pt-1 text-xs">
                <div className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/10 space-y-1">
                  <div className="font-black text-emerald-300 text-sm flex items-center gap-1.5">
                    <span>1. Phí thuê bao định kỳ (SaaS)</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    • <strong>Đăng ký gói trước khi tạo sân:</strong> Chủ sân chọn gói và được duyệt để khởi tạo sân.<br />
                    • <strong>Phí thuê bao:</strong> Dao động từ <strong>99.000 – 299.000 ₫/tháng</strong> (giảm 10% khi đóng 6 tháng, 20% khi đóng 1 năm).
                  </p>
                </div>

                <div className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/10 space-y-1">
                  <div className="font-black text-amber-300 text-sm flex items-center gap-1.5">
                    <span>2. Phí hoa hồng đặt qua App</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    • <strong>Khách đặt trực tiếp qua App:</strong> Áp dụng mức chiết khấu <strong>0% – 5%</strong> giá trị đơn đặt thành công.<br />
                    • Miễn phí 100% hoa hồng (0%) nếu chủ sân sử dụng Gói Chuỗi Sân VIP.
                  </p>
                </div>

                <div className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/10 space-y-1">
                  <div className="font-black text-cyan-300 text-sm flex items-center gap-1.5">
                    <span>3. Khách quen / Khách tại quầy</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    • <strong>0% phí giao dịch:</strong> Hoàn toàn không phát sinh phí đối với khách đặt trực tiếp tại quầy, vé sự kiện.<br />
                    • Quản lý trực tiếp trên phần mềm và POS không giới hạn.
                  </p>
                </div>
              </div>
            </div>

            {/* DANH SÁCH CÁC GÓI CƯỚC HIỆN TẠI (GRID 3 CỘT CHUYÊN NGHIỆP) */}
            <div className="grid md:grid-cols-3 gap-6">
              {plans.map((p) => {
                const planFeatures = Array.isArray(p.features)
                  ? p.features
                  : typeof p.features === 'string'
                  ? JSON.parse(p.features)
                  : [];

                return (
                  <div
                    key={p.id}
                    className={`bg-white rounded-3xl p-6 border ${
                      p.is_featured
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-lg'
                        : 'border-slate-200/80 shadow-sm'
                    } flex flex-col justify-between relative overflow-hidden transition hover:shadow-md`}
                  >
                    {p.is_featured && (
                      <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[10px] font-black px-3.5 py-1 rounded-bl-xl uppercase tracking-wider">
                        Được chọn nhiều nhất
                      </div>
                    )}

                    <div>
                      {/* Huy hiệu gói */}
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {p.badge || 'Gói Dịch Vụ'}
                        </span>
                        {!p.is_active && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            Tạm ẩn
                          </span>
                        )}
                      </div>

                      {/* Tên gói & Giá */}
                      <h3 className="text-base font-black text-slate-900 mt-2">{p.name}</h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{p.description}</p>

                      <div className="mt-4 pb-4 border-b border-slate-100">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black text-slate-900">
                            {Number(p.price_per_month).toLocaleString()} ₫
                          </span>
                          <span className="text-xs text-slate-400 font-bold">
                            / tháng
                          </span>
                        </div>

                        <div className="text-[11px] text-emerald-600 font-bold mt-1.5 flex items-center gap-2">
                          <span>Giảm 10% (6 tháng)</span>
                          <span>•</span>
                          <span>Giảm 20% (1 năm)</span>
                        </div>
                      </div>

                      {/* Giới hạn & Tính năng */}
                      <div className="mt-4 space-y-2.5 text-xs">
                        <div className="flex items-center justify-between text-slate-700 font-semibold">
                          <span>Quy mô quản lý tối đa:</span>
                          <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                            {p.max_courts >= 999 ? 'Không giới hạn' : `${p.max_courts} sân`}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-700 font-semibold">
                          <span>Hoa hồng đặt qua App:</span>
                          <span className="font-black text-emerald-700">
                            {Number(p.commission_rate || 0) === 0 ? '0% (Miễn phí)' : `${p.commission_rate}%`}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-700 font-semibold">
                          <span>Đơn đặt tại quầy:</span>
                          <span className="font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                            0% (Miễn phí)
                          </span>
                        </div>

                        <div className="pt-2 font-bold text-slate-900 text-[11px] uppercase tracking-wider text-slate-400">
                          Tính năng nổi bật:
                        </div>
                        <ul className="space-y-1.5 text-xs text-slate-600">
                          {planFeatures.map((f, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-emerald-600 font-bold">•</span>
                              <span className="leading-snug">{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* NÚT THAO TÁC */}
                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditPlanModal(p)}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 py-2 rounded-xl text-xs font-bold transition"
                      >
                        Sửa gói
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePlan(p)}
                        className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-xl text-xs font-bold transition"
                        title="Xóa hoặc Tạm ẩn gói"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 6: DOANH THU & BIỂU ĐỒ TRỰC QUAN */}
        {/* ========================================================= */}
        {tab === 'REVENUE' && (
          <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  Báo Cáo Doanh Thu Nền Tảng & Biểu Đồ Trực Quan
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Phân tích dòng tiền thu phí SaaS, cơ cấu gói cước và hợp đồng thuê phần mềm
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isExportingSaas}
                  onClick={handleExportSaasExcel}
                  className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                  title="Xuất sổ cái hợp đồng & tài chính SaaS ra file Excel (.xlsx)"
                >
                  <span>{isExportingSaas ? 'Đang trích xuất...' : 'Xuất Báo Cáo Excel'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => openAssignModal()}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                >
                  <span>+</span>
                  <span>Ghi nhận Doanh thu SaaS</span>
                </button>
              </div>
            </div>

            {/* RENDER BIỂU ĐỒ TRỰC QUAN CHUYÊN BIỆT */}
            <SaasRevenueCharts dashboardData={dashboard} />
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 7: QUẢN LÝ TẤT CẢ CỤM SÂN */}
        {/* ========================================================= */}
        {tab === 'ALL_TENANTS' && (
          <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-900">Danh Sách Cụm Sân Toàn Mạng Lưới</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tra cứu tình trạng vận hành, gói cước phần mềm và hạn sử dụng của từng cụm sân
                </p>
              </div>

              <div className="w-full sm:w-72">
                <input
                  type="text"
                  placeholder="Tìm kiếm cụm sân..."
                  value={searchTenant}
                  onChange={(e) => setSearchTenant(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-slate-100">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] font-extrabold">
                      <th className="pb-3">Cụm sân</th>
                      <th className="pb-3">Chủ sở hữu & Liên hệ</th>
                      <th className="pb-3">Số lượng sân</th>
                      <th className="pb-3">Gói Dịch Vụ hiện tại</th>
                      <th className="pb-3">Trạng thái</th>
                      <th className="pb-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allTenants
                      .filter((t) => {
                        if (!searchTenant.trim()) return true;
                        const q = searchTenant.toLowerCase();
                        return t.name.toLowerCase().includes(q) || t.district.toLowerCase().includes(q);
                      })
                      .map((t) => {
                        const sub = t.current_subscription || {};
                        return (
                          <tr key={t.id} className="hover:bg-slate-50/60 transition">
                            <td className="py-3.5 font-extrabold text-slate-900">
                              <div>{t.name}</div>
                              <div className="text-[10px] text-slate-400 font-normal">
                                Quận {t.district} • UUID: <code className="font-mono">{t.id.slice(0, 8)}...</code>
                              </div>
                            </td>
                            <td className="py-3.5 text-slate-600">
                              <div className="font-bold text-slate-900">{t.owner_name}</div>
                              <div className="text-[11px] text-slate-500">
                                {t.owner_email} • {t.phone_contact}
                              </div>
                            </td>
                            <td className="py-3.5 font-black text-slate-900">
                              {t.court_count} <span className="font-normal text-slate-400">sân</span>
                            </td>
                            <td className="py-3.5">
                              {sub.plan_name ? (
                                <div>
                                  <span className="font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg text-[11px]">
                                    {sub.plan_name}
                                  </span>
                                  {sub.end_date && (
                                    <div className="text-[10px] text-slate-400 mt-1">
                                      Hạn: {new Date(sub.end_date).toLocaleDateString('vi-VN')}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">Chưa đăng ký gói</span>
                              )}
                            </td>
                            <td className="py-3.5">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  t.status === 'ACTIVE'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : t.status === 'LOCKED'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {t.status === 'ACTIVE'
                                  ? 'Hoạt động'
                                  : t.status === 'LOCKED'
                                  ? 'Đang khóa'
                                  : 'Chờ duyệt'}
                              </span>
                            </td>
                            <td className="py-3.5 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => openAssignModal(t.id)}
                                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition"
                              >
                                Gia hạn SaaS
                              </button>
                              {t.status === 'ACTIVE' ? (
                                <button
                                  type="button"
                                  onClick={() => handleTenantStatus(t.id, 'LOCKED', t.name)}
                                  className="bg-red-50 hover:bg-red-100 text-red-600 px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition"
                                >
                                  Khóa
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleTenantStatus(t.id, 'ACTIVE', t.name)}
                                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition"
                                >
                                  Mở lại
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: XEM TRƯỚC ẢNH THẺ SINH VIÊN */}
      {/* ========================================================= */}
      {studentCardPreview && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">
                Thẩm Định Thẻ Học Sinh / Sinh Viên
              </h3>
              <button
                type="button"
                onClick={() => setStudentCardPreview(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-black"
              >
                ✕
              </button>
            </div>

            <div className="text-xs space-y-1">
              <p>
                <strong>Họ và tên:</strong> {studentCardPreview.full_name}
              </p>
              <p>
                <strong>Email:</strong> {studentCardPreview.email}
              </p>
              <p>
                <strong>Số điện thoại:</strong> {studentCardPreview.phone || 'Chưa cập nhật'}
              </p>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-100 max-h-72 flex items-center justify-center">
              {studentCardPreview.student_card_url ? (
                <img
                  src={studentCardPreview.student_card_url}
                  alt="Thẻ sinh viên"
                  className="w-full h-auto object-contain max-h-72"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://placehold.co/600x400?text=The+Sinh+Vien';
                  }}
                />
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Người dùng chưa đăng tải ảnh thẻ.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStudentCardPreview(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  handleStudentVerify(studentCardPreview.id, 'REJECTED', studentCardPreview.full_name);
                  setStudentCardPreview(null);
                }}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition"
              >
                Từ chối thẻ
              </button>
              <button
                type="button"
                onClick={() => {
                  handleStudentVerify(studentCardPreview.id, 'VERIFIED', studentCardPreview.full_name);
                  setStudentCardPreview(null);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm"
              >
                Duyệt Xác Thực Thẻ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: TÙY BIẾN / TẠO / SỬA GÓI CƯỚC SAAS */}
      {/* ========================================================= */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">
                {editingPlan ? 'Chỉnh Sửa Gói Cước SaaS' : 'Tạo Gói Cước SaaS Mới'}
              </h3>
              <button
                type="button"
                onClick={() => setShowPlanModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-black"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tên gói cước (*)</label>
                <input
                  type="text"
                  required
                  placeholder="Tên gói cước"
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Giá thuê / tháng (VNĐ) (*)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={50000}
                    value={planForm.pricePerMonth}
                    onChange={(e) => setPlanForm({ ...planForm, pricePerMonth: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Số sân tối đa cho phép</label>
                  <input
                    type="number"
                    min={1}
                    value={planForm.maxCourts}
                    onChange={(e) => setPlanForm({ ...planForm, maxCourts: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Huy hiệu hiển thị</label>
                  <input
                    type="text"
                    placeholder="Huy hiệu (VD: Phổ biến, Tiết kiệm)"
                    value={planForm.badge}
                    onChange={(e) => setPlanForm({ ...planForm, badge: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phí hoa hồng nền tảng (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={planForm.commissionRate}
                    onChange={(e) => setPlanForm({ ...planForm, commissionRate: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mô tả ngắn về gói</label>
                <textarea
                  rows={2}
                  placeholder="Mô tả ngắn về gói cước..."
                  value={planForm.description}
                  onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              {/* TÙY BIẾN TÍNH NĂNG CỦA GÓI */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Danh sách tính năng đi kèm gói ({planForm.features.length})
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Nhập tính năng mới..."
                    value={planForm.featureInput}
                    onChange={(e) => setPlanForm({ ...planForm, featureInput: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addFeatureToPlan();
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={addFeatureToPlan}
                    className="bg-emerald-600 text-white px-3.5 py-2 rounded-xl font-bold hover:bg-emerald-700 transition"
                  >
                    + Thêm
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-36 overflow-y-auto">
                  {planForm.features.map((feat, idx) => (
                    <span
                      key={idx}
                      className="bg-white border border-slate-200 text-slate-800 px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-medium"
                    >
                      <span>• {feat}</span>
                      <button
                        type="button"
                        onClick={() => removeFeatureFromPlan(idx)}
                        className="text-red-500 hover:text-red-700 font-black ml-1"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isFeatured"
                  checked={planForm.isFeatured}
                  onChange={(e) => setPlanForm({ ...planForm, isFeatured: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <label htmlFor="isFeatured" className="font-bold text-slate-700 cursor-pointer">
                  Đặt làm gói Nổi bật (Gợi ý khuyên dùng trên trang đăng ký)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-bold transition shadow-sm"
                >
                  {editingPlan ? 'Cập Nhật Gói' : 'Tạo Gói Ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: GHI NHẬN / GIA HẠN GÓI CƯỚC SAAS CHO CHỦ SÂN */}
      {/* ========================================================= */}
      {showSubModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">
                Kích Hoạt / Gia Hạn Hợp Đồng Thuê SaaS
              </h3>
              <button
                type="button"
                onClick={() => setShowSubModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-black"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordSubscription} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Chọn Cụm Sân Đối Tác (*)
                </label>
                <select
                  required
                  value={subForm.tenantId}
                  onChange={(e) => setSubForm({ ...subForm, tenantId: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-white"
                >
                  <option value="">-- Chọn cụm sân từ danh sách --</option>
                  {allTenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} (Quận {t.district}) — {t.owner_name}
                    </option>
                  ))}
                </select>
                <div className="mt-1">
                  <input
                    type="text"
                    placeholder="Nhập mã cụm sân (UUID)..."
                    value={subForm.tenantId}
                    onChange={(e) => setSubForm({ ...subForm, tenantId: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-[11px] font-mono mt-1 text-slate-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Gói cước phần mềm áp dụng</label>
                <select
                  value={subForm.planId}
                  onChange={(e) => {
                    const selId = e.target.value;
                    const chosen = plans.find((p) => p.id === selId);
                    setSubForm({
                      ...subForm,
                      planId: selId,
                      pricePerMonth: chosen ? Number(chosen.price_per_month) : subForm.pricePerMonth,
                    });
                  }}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-white"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {Number(p.price_per_month).toLocaleString()} ₫/tháng
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Thời hạn thuê</label>
                  <select
                    value={subForm.durationMonths}
                    onChange={(e) => {
                      const m = Number(e.target.value);
                      let disc = 0;
                      if (m >= 12) disc = 20;
                      else if (m >= 6) disc = 10;
                      setSubForm({ ...subForm, durationMonths: m, discountPercent: disc });
                    }}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-white font-bold"
                  >
                    <option value={1}>1 Tháng (Tiêu chuẩn)</option>
                    <option value={3}>3 Tháng</option>
                    <option value={6}>6 Tháng (Giảm 10%)</option>
                    <option value={12}>12 Tháng / 1 Năm (Giảm 20%)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Chiết khấu (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={subForm.discountPercent}
                    onChange={(e) => setSubForm({ ...subForm, discountPercent: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              {/* TÍNH TOÁN TỔNG TIỀN TỰ ĐỘNG */}
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-1">
                <div className="flex justify-between items-center text-xs text-emerald-900">
                  <span>Giá niêm yết:</span>
                  <span>
                    {(Number(subForm.pricePerMonth) * Number(subForm.durationMonths)).toLocaleString()} ₫
                  </span>
                </div>
                {Number(subForm.discountPercent) > 0 && (
                  <div className="flex justify-between items-center text-xs text-emerald-700 font-medium">
                    <span>Ưu đãi chiết khấu ({subForm.discountPercent}%):</span>
                    <span>
                      -
                      {Math.round(
                        (Number(subForm.pricePerMonth) *
                          Number(subForm.durationMonths) *
                          Number(subForm.discountPercent)) /
                          100
                      ).toLocaleString()}{' '}
                      ₫
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-emerald-200/80 text-sm font-black text-emerald-950">
                  <span>Tổng tiền thu:</span>
                  <span className="text-base text-emerald-700">
                    {Math.round(
                      Number(subForm.pricePerMonth) *
                        Number(subForm.durationMonths) *
                        (1 - Number(subForm.discountPercent) / 100)
                    ).toLocaleString()}{' '}
                    ₫
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowSubModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-bold transition shadow-sm"
                >
                  Xác Nhận & Kích Hoạt SaaS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: TỪ CHỐI & HOÀN TIỀN GÓI CƯỚC SAAS */}
      {/* ========================================================= */}
      {rejectSubModal.isOpen && rejectSubModal.sub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-scale-up">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Từ Chối & Hoàn Tiền Gói Cước</h3>
                <p className="text-xs text-slate-500">Xác nhận hoàn tiền 100% về tài khoản của chủ sân</p>
              </div>
            </div>

            <div className="bg-red-50/70 border border-red-200/80 rounded-2xl p-4 text-xs space-y-2 text-slate-700">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Cụm sân:</span>
                <strong className="text-slate-900">{rejectSubModal.sub.tenant_name}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Gói cước đăng ký:</span>
                <strong className="text-slate-900">{rejectSubModal.sub.plan_name}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Số tiền cần hoàn lại:</span>
                <strong className="text-red-700 text-sm font-black">
                  {Number(rejectSubModal.sub.amount_paid).toLocaleString()} ₫
                </strong>
              </div>
              <div className="pt-2 border-t border-red-200/60 space-y-1">
                <div className="text-[11px] font-bold text-red-900 uppercase">Tài khoản nhận hoàn tiền của Chủ sân:</div>
                <div>Ngân hàng: <strong>{rejectSubModal.sub.refund_bank_name || 'Chưa cung cấp'}</strong></div>
                <div>Số tài khoản: <strong className="font-mono text-slate-900 text-sm bg-white px-2 py-0.5 rounded border border-red-200">{rejectSubModal.sub.refund_account_number || 'N/A'}</strong></div>
                <div>Tên thụ hưởng: <strong>{rejectSubModal.sub.refund_account_name || 'N/A'}</strong></div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Lý do từ chối (Chủ sân sẽ xem được lý do này):</label>
              <textarea
                rows={3}
                value={rejectSubModal.reason}
                onChange={(e) => setRejectSubModal({ ...rejectSubModal, reason: e.target.value })}
                placeholder="Lý do từ chối..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRejectSubModal({ isOpen: false, sub: null, reason: '' })}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmRejectSub}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition shadow-md active:scale-95"
              >
                Xác nhận Từ chối & Đã hoàn tiền
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: POPUP XÁC NHẬN HIỆN ĐẠI (THAY THẾ WINDOW.CONFIRM) */}
      {/* ========================================================= */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-scale-up space-y-4">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                confirmModal.confirmColor === 'red'
                  ? 'bg-red-100 text-red-600'
                  : confirmModal.confirmColor === 'amber'
                  ? 'bg-amber-100 text-amber-600'
                  : 'bg-emerald-100 text-emerald-600'
              }`}>
                {confirmModal.confirmColor === 'red' ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">{confirmModal.title}</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {confirmModal.message}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                {confirmModal.cancelText}
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className={`px-5 py-2 rounded-xl text-xs font-black text-white transition shadow-sm ${
                  confirmModal.confirmColor === 'red'
                    ? 'bg-red-600 hover:bg-red-700'
                    : confirmModal.confirmColor === 'amber'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}