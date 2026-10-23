import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';
import RevenueCharts from '../../components/tenant/RevenueCharts';

// Danh mục phân loại mặt hàng POS (100% Tiếng Việt)
export const POS_CATEGORIES = [
  { value: 'DRINK', label: 'Nước uống', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'SHUTTLECOCK', label: 'Cầu lông', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'RACKET_RENTAL', label: 'Thuê vợt', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'GRIP', label: 'Quấn cán', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { value: 'STRING', label: 'Cước vợt', color: 'bg-pink-100 text-pink-800 border-pink-200' },
  { value: 'PROTECTION', label: 'Băng gối / Bảo hộ', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { value: 'MEDICAL', label: 'Salonpas / Y tế', color: 'bg-red-100 text-red-800 border-red-200' },
  { value: 'ACCESSORY', label: 'Phụ kiện khác', color: 'bg-slate-100 text-slate-800 border-slate-200' },
];

export default function TenantDashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  // Mặc định đăng nhập vào sẽ mở HUB / BẢNG ĐIỀU KHIỂN TRUNG TÂM (như Ảnh 2)
  const [tab, setTab] = useState('HUB');

  const [tenant, setTenant] = useState(null);
  const [courts, setCourts] = useState([]);
  const [pricingRules, setPricingRules] = useState([]);
  const [products, setProducts] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [reviewsData, setReviewsData] = useState({ reviews: [], stats: {} });

  // Form states cho Thêm mới
  const [newCourt, setNewCourt] = useState({ name: '', type: 'STANDARD' });
  const [newRule, setNewRule] = useState({
    courtType: 'STANDARD',
    startTime: '17:00',
    endTime: '22:00',
    pricePerHour: 120000,
  });
  const [newProduct, setNewProduct] = useState({
    name: '',
    category: 'DRINK',
    price: 15000,
    stockQuantity: 50,
  });
  const [newStaff, setNewStaff] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  // Modal Sửa (Edit Modals)
  const [editingCourt, setEditingCourt] = useState(null);
  const [editingRule, setEditingRule] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingStaff, setEditingStaff] = useState(null);

  // Modal Lên lịch Bảo trì Sân
  const [maintenanceModalCourt, setMaintenanceModalCourt] = useState(null);
  const [maintScheduleMode, setMaintScheduleMode] = useState('NOW'); // 'NOW' hoặc 'SCHEDULE'
  const [maintStartTime, setMaintStartTime] = useState('');
  const [maintNote, setMaintNote] = useState('Bảo trì định kỳ mặt sân');

  // Quản lý Điều khoản & Hình ảnh sân
  const [venueImages, setVenueImages] = useState([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [venueRules, setVenueRules] = useState([]);
  const [newRuleText, setNewRuleText] = useState('');
  const [venueDescription, setVenueDescription] = useState('');

  const fetchTenantData = async () => {
    try {
      const [setRes, courtRes, ruleRes, staffRes, anaRes, revRes] = await Promise.all([
        axiosClient.get('/tenant/my-settings'),
        axiosClient.get('/tenant/courts'),
        axiosClient.get('/tenant/pricing-rules'),
        axiosClient.get('/tenant/staff'),
        axiosClient.get('/pos/analytics'),
        axiosClient.get('/tenant/reviews').catch(() => ({ data: { reviews: [], stats: {} } })),
      ]);

      setTenant(setRes.data.tenant);
      setCourts(courtRes.data.courts);
      setPricingRules(ruleRes.data.pricingRules);
      setStaffList(staffRes.data.staffList);
      setAnalytics(anaRes.data);
      setReviewsData(revRes.data);

      setVenueImages(setRes.data.tenant.images || [
        'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1521537634581-0dced2fee2ef?auto=format&fit=crop&w=900&q=80'
      ]);
      setVenueRules(setRes.data.tenant.rules || [
        'Vui lòng mang giày thể thao chuyên dụng hoặc không để lại vết đen trên mặt thảm.',
        'Có mặt trước giờ đặt 5–10 phút để làm thủ tục Check-in tại quầy Lễ tân.',
        'Quy định Hủy lịch & Hoàn tiền: Hoàn lại 100% tiền sân khi thao tác hủy trước giờ chơi ít nhất 24 tiếng.',
        'Không hút thuốc lá và xả rác trong khu vực thảm thi đấu.'
      ]);
      setVenueDescription(setRes.data.tenant.description || '');

      if (setRes.data.tenant.enable_pos_module) {
        const prodRes = await axiosClient.get('/pos/products');
        setProducts(prodRes.data.products);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTenantData();
  }, []);

  // --- 1. XỬ LÝ CẤU HÌNH & TÍNH NĂNG ---
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      const res = await axiosClient.put('/tenant/my-settings', {
        name: tenant.name,
        district: tenant.district,
        address: tenant.address,
        phoneContact: tenant.phone_contact,
        enableVipCourts: tenant.enable_vip_courts,
        enablePosModule: tenant.enable_pos_module,
        enableAdvancedAnalytics: tenant.enable_advanced_analytics,
        studentDiscountType: tenant.student_discount_type,
        studentDiscountValue: tenant.student_discount_value,
        qrBankName: tenant.qr_bank_name,
        qrAccountNumber: tenant.qr_account_number,
        qrAccountName: tenant.qr_account_name,
      });
      toast.success(res.data.message);
      fetchTenantData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi lưu cấu hình.');
    }
  };

  // --- 2. XỬ LÝ SÂN (CRUD & BẢO TRÌ) ---
  const handleCreateCourt = async (e) => {
    e.preventDefault();
    try {
      const res = await axiosClient.post('/tenant/courts', newCourt);
      toast.success(res.data.message);
      setNewCourt({ name: '', type: 'STANDARD' });
      fetchTenantData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi tạo sân.');
    }
  };

  const handleUpdateCourt = async (e) => {
    e.preventDefault();
    if (!editingCourt) return;
    try {
      const res = await axiosClient.put(`/tenant/courts/${editingCourt.id}`, {
        name: editingCourt.name,
        type: editingCourt.type,
      });
      toast.success(res.data.message);
      setEditingCourt(null);
      fetchTenantData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi cập nhật sân.');
    }
  };

  const handleDeleteCourt = async (courtId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa sân này khỏi danh sách?')) return;
    try {
      const res = await axiosClient.delete(`/tenant/courts/${courtId}`);
      toast.success(res.data.message);
      fetchTenantData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi xóa sân.');
    }
  };

  const openMaintenanceModal = (court) => {
    setMaintenanceModalCourt(court);
    setMaintScheduleMode('NOW');
    // Mặc định thời gian là giờ hiện tại
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setMaintStartTime(now.toISOString().slice(0, 16));
    setMaintNote('Bảo trì định kỳ mặt sân & hệ thống đèn');
  };

  const handleSaveMaintenance = async (e) => {
    e.preventDefault();
    if (!maintenanceModalCourt) return;

    try {
      const payload = {
        isUnderMaintenance: true,
        maintenanceStart: maintScheduleMode === 'SCHEDULE' ? maintStartTime : new Date().toISOString(),
        maintenanceNote: maintNote,
      };

      const res = await axiosClient.put(
        `/tenant/courts/${maintenanceModalCourt.id}/maintenance`,
        payload
      );
      toast.success(res.data.message);
      setMaintenanceModalCourt(null);
      fetchTenantData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi lên lịch bảo trì.');
    }
  };

  const handleEndMaintenance = async (court) => {
    try {
      const res = await axiosClient.put(`/tenant/courts/${court.id}/maintenance`, {
        isUnderMaintenance: false,
      });
      toast.success(res.data.message);
      fetchTenantData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi kết thúc bảo trì.');
    }
  };

  // --- 3. XỬ LÝ KHUNG GIÁ ĐỘNG (CRUD) ---
  const handleCreatePricingRule = async (e) => {
    e.preventDefault();
    try {
      await axiosClient.post('/tenant/pricing-rules', {
        ...newRule,
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      });
      toast.success('Đã thêm khung giá động thành công!');
      fetchTenantData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi thêm giá động.');
    }
  };

  const handleUpdatePricingRule = async (e) => {
    e.preventDefault();
    if (!editingRule) return;
    try {
      await axiosClient.put(`/tenant/pricing-rules/${editingRule.id}`, {
        courtType: editingRule.court_type,
        startTime: editingRule.start_time,
        endTime: editingRule.end_time,
        pricePerHour: editingRule.price_per_hour,
        daysOfWeek: editingRule.days_of_week || [1, 2, 3, 4, 5, 6, 7],
      });
      toast.success('Đã cập nhật khung giá thành công!');
      setEditingRule(null);
      fetchTenantData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi cập nhật khung giá.');
    }
  };

  const handleDeletePricingRule = async (ruleId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa khung giá này?')) return;
    try {
      await axiosClient.delete(`/tenant/pricing-rules/${ruleId}`);
      toast.success('Đã xóa khung giá.');
      fetchTenantData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi xóa khung giá.');
    }
  };

  // --- 4. XỬ LÝ KHO HÀNG POS (CRUD) ---
  const handleCreateProduct = async (e) => {
    e.preventDefault();
    try {
      await axiosClient.post('/pos/products', newProduct);
      toast.success('Đã thêm sản phẩm vào kho POS!');
      setNewProduct({ name: '', category: 'DRINK', price: 15000, stockQuantity: 50 });
      fetchTenantData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi thêm sản phẩm.');
    }
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;
    try {
      await axiosClient.put(`/pos/products/${editingProduct.id}`, {
        name: editingProduct.name,
        category: editingProduct.category,
        price: Number(editingProduct.price),
        stockQuantity: Number(editingProduct.stock_quantity),
      });
      toast.success('Đã cập nhật sản phẩm thành công!');
      setEditingProduct(null);
      fetchTenantData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi cập nhật sản phẩm.');
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa mặt hàng này khỏi kho?')) return;
    try {
      const res = await axiosClient.delete(`/pos/products/${productId}`);
      toast.success(res.data.message);
      fetchTenantData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi xóa sản phẩm.');
    }
  };

  // --- 5. XỬ LÝ TÀI KHOẢN LỄ TÂN (CRUD VỚI XÁC NHẬN MẬT KHẨU) ---
  const handleCreateStaff = async (e) => {
    e.preventDefault();
    if (newStaff.password !== newStaff.confirmPassword) {
      toast.error('Mật khẩu và xác nhận mật khẩu không khớp!');
      return;
    }
    if (newStaff.password.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }

    try {
      const res = await axiosClient.post('/tenant/staff', {
        fullName: newStaff.fullName,
        email: newStaff.email,
        phone: newStaff.phone,
        password: newStaff.password,
      });
      toast.success(res.data.message);
      setNewStaff({ fullName: '', email: '', phone: '', password: '', confirmPassword: '' });
      fetchTenantData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi tạo nhân viên.');
    }
  };

  const handleUpdateStaff = async (e) => {
    e.preventDefault();
    if (!editingStaff) return;

    if (editingStaff.newPassword) {
      if (editingStaff.newPassword !== editingStaff.confirmNewPassword) {
        toast.error('Mật khẩu mới và xác nhận mật khẩu không khớp!');
        return;
      }
      if (editingStaff.newPassword.length < 6) {
        toast.error('Mật khẩu mới phải có ít nhất 6 ký tự.');
        return;
      }
    }

    try {
      const res = await axiosClient.put(`/tenant/staff/${editingStaff.id}`, {
        fullName: editingStaff.full_name,
        phone: editingStaff.phone,
        password: editingStaff.newPassword || undefined,
        isActive: editingStaff.is_active,
      });
      toast.success(res.data.message);
      setEditingStaff(null);
      fetchTenantData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi cập nhật nhân viên.');
    }
  };

  const handleDeleteStaff = async (staffId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa hoặc vô hiệu hóa tài khoản lễ tân này?')) return;
    try {
      const res = await axiosClient.delete(`/tenant/staff/${staffId}`);
      toast.success(res.data.message);
      fetchTenantData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi xóa nhân viên.');
    }
  };

  // --- 6. XỬ LÝ ĐIỀU KHOẢN, QUY ĐỊNH & ẢNH SÂN ---
  const handleAddImage = () => {
    if (!newImageUrl.trim()) return;
    setVenueImages([...venueImages, newImageUrl.trim()]);
    setNewImageUrl('');
  };

  const handleRemoveImage = (index) => {
    setVenueImages(venueImages.filter((_, i) => i !== index));
  };

  const handleAddRule = () => {
    if (!newRuleText.trim()) return;
    setVenueRules([...venueRules, newRuleText.trim()]);
    setNewRuleText('');
  };

  const handleRemoveRule = (index) => {
    setVenueRules(venueRules.filter((_, i) => i !== index));
  };

  const handleSaveVenueDetails = async (e) => {
    e.preventDefault();
    try {
      const res = await axiosClient.put('/tenant/venue-details', {
        name: tenant.name,
        district: tenant.district,
        address: tenant.address,
        phoneContact: tenant.phone_contact,
        description: venueDescription,
        images: venueImages,
        rules: venueRules,
      });
      toast.success(res.data.message);
      fetchTenantData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi lưu điều khoản và hình ảnh.');
    }
  };

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Danh sách các Menu Tabs
  const TAB_ITEMS = [
    { id: 'HUB', label: '🏠 Bảng điều khiển (Hub)', show: true },
    { id: 'COURTS', label: '🏸 Quản lý Sân & Bảo trì', show: true },
    { id: 'PRICING_RULES', label: '💰 Bảng Giá Động', show: true },
    { id: 'POS_INVENTORY', label: '📦 Kho hàng POS', show: tenant.enable_pos_module },
    { id: 'STAFF', label: '👥 Tài khoản Lễ tân', show: true },
    { id: 'REVIEWS', label: '⭐ Đánh giá của Khách', show: true },
    { id: 'VENUE_DETAILS', label: '🖼️ Hình ảnh & Điều khoản', show: true },
    { id: 'ANALYTICS', label: '📊 Báo cáo Doanh thu', show: true },
    { id: 'SETTINGS', label: '⚙️ Cấu hình Cụm sân & VietQR', show: true },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      {/* HEADER CHỦ SÂN */}
      <header className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-slate-900 text-white px-6 py-4 shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            {tab !== 'HUB' && (
              <button
                onClick={() => setTab('HUB')}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-emerald-200 text-xs font-extrabold px-3 py-2 rounded-xl transition"
              >
                <span>‹</span>
                <span>Bảng điều khiển</span>
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                  Tenant Admin
                </span>
                <span className="text-xs text-emerald-200/80">Quận {tenant.district}</span>
              </div>
              <h1 className="text-xl font-black tracking-tight mt-0.5">{tenant.name}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/staff')}
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs transition shadow-sm active:scale-95 flex items-center gap-1.5"
            >
              <span>⚡</span>
              <span>Mở Quầy Lễ Tân & POS →</span>
            </button>
            <button
              onClick={() => {
                logout();
                navigate('/');
              }}
              className="bg-white/10 hover:bg-white/20 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold transition"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        {/* SUB-NAVIGATOR (CHO PHÉP CHUYỂN TAB TIỆN LỢI KHI KHÔNG Ở HUB) */}
        {tab !== 'HUB' && (
          <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-100 mb-6 overflow-x-auto text-xs font-bold">
            {TAB_ITEMS.filter((t) => t.show).map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`px-3.5 py-2 rounded-xl whitespace-nowrap transition ${
                  tab === item.id
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100/70'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 1: HUB / BẢNG ĐIỀU KHIỂN TRUNG TÂM (LẤY CẢM HỨNG TỪ ẢNH 2) */}
        {/* ========================================================= */}
        {tab === 'HUB' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
              <div className="relative z-10 max-w-2xl">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-300 bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-400/20">
                  Trung tâm Vận hành Sân cầu lông
                </span>
                <h2 className="text-2xl sm:text-3xl font-black mt-3">
                  Chào mừng trở lại, {tenant.name}!
                </h2>
                <p className="text-xs sm:text-sm text-emerald-100/80 mt-1.5 leading-relaxed">
                  Lựa chọn một chức năng dưới đây để quản lý sân bãi, theo dõi doanh thu, cấu hình giá động hoặc quản lý nhân sự quầy lễ tân.
                </p>
              </div>
              <div className="absolute right-4 bottom-4 opacity-10 text-9xl select-none pointer-events-none">
                🏸
              </div>
            </div>

            {/* LƯỚI CARD CHỨC NĂNG (GRID NỔI BẬT NHƯ ẢNH 2) */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {/* CARD 1: QUẢN LÝ SÂN & BẢO TRÌ */}
              <div
                onClick={() => setTab('COURTS')}
                className="group cursor-pointer rounded-3xl p-6 bg-gradient-to-br from-rose-500 via-rose-600 to-orange-500 text-white shadow-md hover:shadow-xl hover:-translate-y-1 transition duration-300 flex flex-col justify-between h-48"
              >
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl shadow-inner">
                    🏸
                  </div>
                  <span className="text-[11px] font-black bg-white/25 px-2.5 py-1 rounded-full">
                    {courts.length} Sân
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">Trạng thái & Quản lý Sân</h3>
                  <p className="text-[11px] text-white/85 mt-1 line-clamp-2">
                    {courts.filter((c) => c.is_under_maintenance).length > 0
                      ? `Có ${courts.filter((c) => c.is_under_maintenance).length} sân đang bảo trì`
                      : 'Tất cả các sân đang hoạt động tốt'} • Lên lịch bảo trì trước
                  </p>
                </div>
              </div>

              {/* CARD 2: BÁN HÀNG TẠI QUẦY & POS */}
              <div
                onClick={() => navigate('/staff')}
                className="group cursor-pointer rounded-3xl p-6 bg-gradient-to-br from-amber-500 via-amber-600 to-yellow-500 text-white shadow-md hover:shadow-xl hover:-translate-y-1 transition duration-300 flex flex-col justify-between h-48"
              >
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl shadow-inner">
                    ⚡
                  </div>
                  <span className="text-[11px] font-black bg-slate-950/30 px-2.5 py-1 rounded-full text-amber-200">
                    Trực tiếp
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">Quầy Lễ Tân & Bán Hàng</h3>
                  <p className="text-[11px] text-white/85 mt-1 line-clamp-2">
                    Check-in mã QR, tạo vé vãng lai & xuất hóa đơn đồ uống, cầu lông tại quầy
                  </p>
                </div>
              </div>

              {/* CARD 3: QUẢN LÝ KHO POS */}
              <div
                onClick={() => setTab('POS_INVENTORY')}
                className="group cursor-pointer rounded-3xl p-6 bg-gradient-to-br from-pink-600 via-rose-600 to-red-600 text-white shadow-md hover:shadow-xl hover:-translate-y-1 transition duration-300 flex flex-col justify-between h-48"
              >
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl shadow-inner">
                    📦
                  </div>
                  <span className="text-[11px] font-black bg-white/25 px-2.5 py-1 rounded-full">
                    {products.length} Mặt hàng
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">Kho hàng & Dịch vụ</h3>
                  <p className="text-[11px] text-white/85 mt-1 line-clamp-2">
                    Nước uống, Cầu lông, Quấn cán, Cước, Băng gối, Salonpas & Thuê vợt
                  </p>
                </div>
              </div>

              {/* CARD 4: DOANH THU & BÁO CÁO */}
              <div
                onClick={() => setTab('ANALYTICS')}
                className="group cursor-pointer rounded-3xl p-6 bg-gradient-to-br from-purple-600 via-indigo-600 to-violet-700 text-white shadow-md hover:shadow-xl hover:-translate-y-1 transition duration-300 flex flex-col justify-between h-48"
              >
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl shadow-inner">
                    📊
                  </div>
                  <span className="text-[11px] font-black bg-white/25 px-2.5 py-1 rounded-full">
                    Trực quan
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">Doanh thu & Lợi nhuận</h3>
                  <p className="text-[11px] text-white/85 mt-1 line-clamp-2">
                    Biểu đồ doanh thu tiền sân, F&B và thống kê khung giờ vàng
                  </p>
                </div>
              </div>

              {/* CARD 5: TÀI KHOẢN LỄ TÂN */}
              <div
                onClick={() => setTab('STAFF')}
                className="group cursor-pointer rounded-3xl p-6 bg-gradient-to-br from-cyan-600 via-teal-600 to-emerald-600 text-white shadow-md hover:shadow-xl hover:-translate-y-1 transition duration-300 flex flex-col justify-between h-48"
              >
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl shadow-inner">
                    👥
                  </div>
                  <span className="text-[11px] font-black bg-white/25 px-2.5 py-1 rounded-full">
                    {staffList.length} Nhân viên
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">Quản lý Lễ tân</h3>
                  <p className="text-[11px] text-white/85 mt-1 line-clamp-2">
                    Thêm, sửa, xóa tài khoản lễ tân & cấp lại mật khẩu bảo mật
                  </p>
                </div>
              </div>

              {/* CARD 6: CẤU HÌNH GIÁ ĐỘNG */}
              <div
                onClick={() => setTab('PRICING_RULES')}
                className="group cursor-pointer rounded-3xl p-6 bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-700 text-white shadow-md hover:shadow-xl hover:-translate-y-1 transition duration-300 flex flex-col justify-between h-48"
              >
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl shadow-inner">
                    💰
                  </div>
                  <span className="text-[11px] font-black bg-white/25 px-2.5 py-1 rounded-full">
                    {pricingRules.length} Khung giờ
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">Bảng giá Động</h3>
                  <p className="text-[11px] text-white/85 mt-1 line-clamp-2">
                    Cấu hình giá giờ cao điểm, giờ thấp điểm theo từng loại sân
                  </p>
                </div>
              </div>

              {/* CARD 7: ĐÁNH GIÁ & NHẬN XÉT CỦA KHÁCH */}
              <div
                onClick={() => setTab('REVIEWS')}
                className="group cursor-pointer rounded-3xl p-6 bg-gradient-to-br from-amber-600 via-orange-600 to-red-600 text-white shadow-md hover:shadow-xl hover:-translate-y-1 transition duration-300 flex flex-col justify-between h-48"
              >
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl shadow-inner">
                    ⭐
                  </div>
                  <span className="text-[11px] font-black bg-white/25 px-2.5 py-1 rounded-full">
                    {reviewsData.stats?.avg_rating || 5} ★ ({reviewsData.stats?.total_reviews || 0})
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">Đánh giá & Nhận xét</h3>
                  <p className="text-[11px] text-white/85 mt-1 line-clamp-2">
                    Xem phản hồi thực tế của khách hàng sau khi hoàn tất đặt sân
                  </p>
                </div>
              </div>

              {/* CARD 8: QUẢN LÝ ẢNH & ĐIỀU KHOẢN */}
              <div
                onClick={() => setTab('VENUE_DETAILS')}
                className="group cursor-pointer rounded-3xl p-6 bg-gradient-to-br from-teal-700 via-cyan-800 to-slate-800 text-white shadow-md hover:shadow-xl hover:-translate-y-1 transition duration-300 flex flex-col justify-between h-48"
              >
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl shadow-inner">
                    🖼️
                  </div>
                  <span className="text-[11px] font-black bg-white/25 px-2.5 py-1 rounded-full">
                    {venueImages.length} Hình ảnh
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">Hình ảnh & Điều khoản</h3>
                  <p className="text-[11px] text-white/85 mt-1 line-clamp-2">
                    Thêm bớt ảnh sân, quy định hủy hoàn tiền & nội quy sân đấu
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: QUẢN LÝ SÂN & BẢO TRÌ (CRUD & LÊN LỊCH BẢO TRÌ) */}
        {/* ========================================================= */}
        {tab === 'COURTS' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-slate-900">Quản lý Sân & Trạng thái Bảo trì</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tạo sân mới, cập nhật phân loại, xóa sân và lên lịch bảo trì trước để chặn khách đặt.
                </p>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* FORM TẠO SÂN MỚI */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4 h-fit">
                <h3 className="font-extrabold text-slate-900 text-base">Thêm Sân mới</h3>
                <form onSubmit={handleCreateCourt} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tên sân</label>
                    <input
                      type="text"
                      required
                      placeholder="VD: Sân Tiêu Chuẩn 03, Sân VIP 02"
                      value={newCourt.name}
                      onChange={(e) => setNewCourt({ ...newCourt, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Phân loại sân</label>
                    <select
                      value={newCourt.type}
                      onChange={(e) => setNewCourt({ ...newCourt, type: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                    >
                      <option value="STANDARD">Sân STANDARD (Tiêu chuẩn)</option>
                      {tenant.enable_vip_courts && <option value="VIP">Sân VIP (Cao cấp)</option>}
                    </select>
                    {!tenant.enable_vip_courts && (
                      <p className="text-[11px] text-amber-600 mt-1">
                        * Cần bật công tắc "Sử dụng Sân VIP" trong phần Cài đặt để tạo sân VIP.
                      </p>
                    )}
                  </div>
                  <button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl text-xs font-bold transition shadow-sm">
                    + Thêm Sân vào Cụm
                  </button>
                </form>
              </div>

              {/* DANH SÁCH SÂN */}
              <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                <h3 className="font-extrabold text-slate-900 text-base">Danh sách Sân ({courts.length})</h3>

                <div className="space-y-3">
                  {courts.map((c) => (
                    <div
                      key={c.id}
                      className="p-4 border border-slate-200/80 bg-slate-50/70 rounded-2xl flex flex-wrap justify-between items-center gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <strong className="text-slate-900 text-sm">{c.name}</strong>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            c.type === 'VIP' ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-blue-100 text-blue-900 border-blue-200'
                          }`}>
                            {c.type}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              c.status === 'PUBLISHED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {c.status}
                          </span>
                        </div>

                        {c.is_under_maintenance && (
                          <div className="text-[11px] text-red-600 font-bold flex items-center gap-1">
                            <span>🔧 Đang bảo trì</span>
                            {c.maintenance_start && (
                              <span>từ {new Date(c.maintenance_start).toLocaleString('vi-VN')}</span>
                            )}
                            {c.maintenance_note && (
                              <span className="text-slate-500 font-normal">({c.maintenance_note})</span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* NÚT BẢO TRÌ */}
                        {c.is_under_maintenance ? (
                          <button
                            type="button"
                            onClick={() => handleEndMaintenance(c)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl transition text-[11px] shadow-sm"
                          >
                            ✓ Hoàn tất bảo trì (Mở sân)
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openMaintenanceModal(c)}
                            className="bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold px-3 py-1.5 rounded-xl transition text-[11px]"
                          >
                            🔧 Đặt lịch bảo trì
                          </button>
                        )}

                        {/* NÚT SỬA SÂN */}
                        <button
                          type="button"
                          onClick={() => setEditingCourt(c)}
                          className="bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold px-3 py-1.5 rounded-xl transition text-[11px]"
                        >
                          ✏️ Sửa
                        </button>

                        {/* NÚT XÓA SÂN */}
                        <button
                          type="button"
                          onClick={() => handleDeleteCourt(c.id)}
                          className="text-red-500 hover:bg-red-50 p-1.5 rounded-xl transition font-bold"
                          title="Xóa sân"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                  {courts.length === 0 && (
                    <p className="text-xs text-slate-400 py-6 text-center">Chưa có sân nào.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: BẢNG GIÁ ĐỘNG (CRUD ĐẦY ĐỦ) */}
        {/* ========================================================= */}
        {tab === 'PRICING_RULES' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-slate-900">Cấu hình Bảng giá Động</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Thiết lập mức giá theo từng khung giờ và loại sân (Sân Tiêu Chuẩn hoặc Sân VIP).
              </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* FORM THÊM KHUNG GIÁ */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4 h-fit">
                <h3 className="font-extrabold text-slate-900 text-base">Thêm Khung Giá Mới</h3>
                <form onSubmit={handleCreatePricingRule} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Loại sân áp dụng</label>
                    <select
                      value={newRule.courtType}
                      onChange={(e) => setNewRule({ ...newRule, courtType: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                    >
                      <option value="STANDARD">Sân STANDARD</option>
                      <option value="VIP">Sân VIP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Đơn giá thuê mỗi giờ (VNĐ/h)</label>
                    <input
                      type="number"
                      required
                      placeholder="VD: 120000"
                      value={newRule.pricePerHour}
                      onChange={(e) => setNewRule({ ...newRule, pricePerHour: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Từ giờ</label>
                      <input
                        type="time"
                        value={newRule.startTime}
                        onChange={(e) => setNewRule({ ...newRule, startTime: e.target.value })}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Đến giờ</label>
                      <input
                        type="time"
                        value={newRule.endTime}
                        onChange={(e) => setNewRule({ ...newRule, endTime: e.target.value })}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>
                  <button className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-bold transition shadow-sm">
                    + Thêm Khung Giá Động
                  </button>
                </form>
              </div>

              {/* DANH SÁCH KHUNG GIÁ */}
              <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                <h3 className="font-extrabold text-slate-900 text-base">
                  Khung giá đang áp dụng ({pricingRules.length})
                </h3>

                <div className="space-y-2.5">
                  {pricingRules.map((r) => (
                    <div
                      key={r.id}
                      className="p-4 border border-slate-200/80 rounded-2xl flex justify-between items-center text-xs bg-slate-50"
                    >
                      <div className="space-y-1">
                        <span className="font-bold text-slate-800">
                          Sân <strong className="text-emerald-700">{r.court_type}</strong>: {r.start_time} → {r.end_time}
                        </span>
                        <div className="text-[11px] text-slate-400">Áp dụng tất cả các ngày trong tuần</div>
                      </div>

                      <div className="flex items-center gap-3">
                        <strong className="text-emerald-700 text-sm">
                          {Number(r.price_per_hour).toLocaleString()} ₫/h
                        </strong>
                        <button
                          type="button"
                          onClick={() => setEditingRule(r)}
                          className="bg-white border px-2.5 py-1 rounded-lg text-slate-700 hover:bg-slate-100 font-bold"
                        >
                          ✏️ Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePricingRule(r.id)}
                          className="text-red-500 hover:bg-red-50 p-1 rounded-lg font-bold"
                          title="Xóa khung giá"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                  {pricingRules.length === 0 && (
                    <p className="text-xs text-slate-400 py-6 text-center">Chưa có khung giá nào được cài đặt.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: KHO HÀNG POS (CRUD ĐẦY ĐỦ + MỞ RỘNG PHÂN LOẠI TIẾNG VIỆT) */}
        {/* ========================================================= */}
        {tab === 'POS_INVENTORY' && tenant.enable_pos_module && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-slate-900">Quản lý Kho hàng POS & Dịch vụ</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Nhập kho, chỉnh sửa giá bán, theo dõi số lượng tồn kho của nước giải khát, cầu lông, quấn cán, cước, băng gối, salonpas.
              </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* FORM THÊM SẢN PHẨM */}
              <form
                onSubmit={handleCreateProduct}
                className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4 h-fit"
              >
                <h3 className="font-extrabold text-slate-900 text-base">Nhập Hàng Mới Vào Kho</h3>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tên mặt hàng</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Nước Revive, Quấn cán Yonex, Salonpas"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phân loại hàng hóa</label>
                  <select
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  >
                    {POS_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Đơn giá bán (VNĐ)</label>
                    <input
                      type="number"
                      required
                      placeholder="15000"
                      value={newProduct.price}
                      onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Số lượng tồn kho</label>
                    <input
                      type="number"
                      required
                      placeholder="50"
                      value={newProduct.stockQuantity}
                      onChange={(e) => setNewProduct({ ...newProduct, stockQuantity: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl text-xs font-bold transition shadow-sm">
                  + Thêm Vào Kho POS
                </button>
              </form>

              {/* DANH SÁCH TỒN KHO */}
              <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                <h3 className="font-extrabold text-slate-900 text-base">
                  Danh sách Tồn kho ({products.length} mặt hàng)
                </h3>

                <div className="space-y-2.5">
                  {products.map((p) => {
                    const catObj = POS_CATEGORIES.find((c) => c.value === p.category) || {
                      label: p.category,
                      color: 'bg-slate-100 text-slate-800 border-slate-200',
                    };
                    return (
                      <div
                        key={p.id}
                        className="p-4 border border-slate-200/80 bg-slate-50/70 rounded-2xl flex flex-wrap justify-between items-center gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <strong className="text-slate-900 text-sm">{p.name}</strong>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${catObj.color}`}>
                              {catObj.label}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Giá bán: <strong className="text-emerald-700 font-bold">{Number(p.price).toLocaleString()} ₫</strong> • Tồn kho: <strong className="text-slate-900">{p.stock_quantity}</strong>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingProduct(p)}
                            className="bg-white border px-3 py-1.5 rounded-xl text-slate-700 hover:bg-slate-100 font-bold text-[11px]"
                          >
                            ✏️ Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p.id)}
                            className="text-red-500 hover:bg-red-50 p-1.5 rounded-xl font-bold transition"
                            title="Xóa mặt hàng"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {products.length === 0 && (
                    <p className="text-xs text-slate-400 py-6 text-center">Kho hàng POS hiện đang trống.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 5: TÀI KHOẢN LỄ TÂN (CRUD + XÁC NHẬN MẬT KHẨU) */}
        {/* ========================================================= */}
        {tab === 'STAFF' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-slate-900">Quản lý Tài khoản Nhân viên Lễ tân</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cấp tài khoản, cập nhật thông tin, đổi mật khẩu và vô hiệu hóa tài khoản cho nhân viên trực quầy.
              </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* FORM TẠO LỄ TÂN */}
              <form
                onSubmit={handleCreateStaff}
                className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-3.5 h-fit"
              >
                <h3 className="font-extrabold text-slate-900 text-base">Cấp Tài khoản Lễ tân Mới</h3>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Họ tên nhân viên</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Nguyễn Văn Lễ Tân"
                    value={newStaff.fullName}
                    onChange={(e) => setNewStaff({ ...newStaff, fullName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email đăng nhập</label>
                  <input
                    type="email"
                    required
                    placeholder="letan@gmail.com"
                    value={newStaff.email}
                    onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Số điện thoại</label>
                  <input
                    type="text"
                    required
                    placeholder="0903000001"
                    value={newStaff.phone}
                    onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mật khẩu khởi tạo</label>
                  <input
                    type="password"
                    required
                    placeholder="Tối thiểu 6 ký tự"
                    value={newStaff.password}
                    onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nhập lại mật khẩu để xác nhận
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Xác nhận lại mật khẩu trên"
                    value={newStaff.confirmPassword}
                    onChange={(e) => setNewStaff({ ...newStaff, confirmPassword: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>

                <button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl text-xs font-bold transition shadow-sm">
                  + Cấp Tài khoản Lễ tân
                </button>
              </form>

              {/* DANH SÁCH LỄ TÂN */}
              <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                <h3 className="font-extrabold text-slate-900 text-base">
                  Danh sách Lễ tân ({staffList.length})
                </h3>

                <div className="space-y-3">
                  {staffList.map((st) => (
                    <div
                      key={st.id}
                      className="p-4 border border-slate-200/80 bg-slate-50/70 rounded-2xl flex flex-wrap justify-between items-center gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <strong className="text-slate-900 text-sm">{st.full_name}</strong>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              st.is_active !== false
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {st.is_active !== false ? 'Đang hoạt động' : 'Đã khóa'}
                          </span>
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          Email: <strong className="text-slate-800">{st.email}</strong> • SĐT: <strong className="text-slate-800">{st.phone}</strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingStaff({
                              ...st,
                              newPassword: '',
                              confirmNewPassword: '',
                            })
                          }
                          className="bg-white border px-3 py-1.5 rounded-xl text-slate-700 hover:bg-slate-100 font-bold text-[11px]"
                        >
                          ✏️ Sửa & Đổi MK
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStaff(st.id)}
                          className="text-red-500 hover:bg-red-50 p-1.5 rounded-xl font-bold transition"
                          title="Xóa hoặc Vô hiệu hóa lễ tân"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                  {staffList.length === 0 && (
                    <p className="text-xs text-slate-400 py-6 text-center">Chưa có tài khoản lễ tân nào.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 6: ĐÁNH GIÁ & NHẬN XÉT CỦA SÂN (CHỦ SÂN TỰ XEM) */}
        {/* ========================================================= */}
        {tab === 'REVIEWS' && (
          <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">Đánh giá & Nhận xét từ Khách hàng</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tổng hợp phản hồi xác thực (Verified Purchase) sau mỗi ca chơi đã hoàn thành.
                </p>
              </div>

              <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl shadow-sm border border-slate-100">
                <span className="text-3xl font-black text-amber-500">
                  {reviewsData.stats?.avg_rating || 5} ★
                </span>
                <div className="text-xs text-slate-600">
                  <div>Điểm đánh giá trung bình</div>
                  <strong className="text-slate-900">{reviewsData.stats?.total_reviews || 0} lượt đánh giá</strong>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
              <h3 className="font-extrabold text-slate-900 text-base">
                Tất cả đánh giá ({reviewsData.reviews?.length || 0})
              </h3>

              <div className="space-y-3">
                {reviewsData.reviews?.map((r) => (
                  <div
                    key={r.id}
                    className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 text-xs space-y-1.5"
                  >
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <div className="flex items-center gap-2">
                        <strong className="text-slate-900 text-sm">{r.user_name}</strong>
                        <span className="text-amber-500 font-bold">
                          {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                        </span>
                        {r.court_name && (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {r.court_name}
                          </span>
                        )}
                        {r.booking_code && (
                          <span className="text-[10px] font-mono text-slate-400">#{r.booking_code}</span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(r.created_at).toLocaleDateString('vi-VN')}
                      </span>
                    </div>

                    <p className="text-slate-700 leading-relaxed font-medium">
                      "{r.comment || 'Khách hàng không để lại nhận xét văn bản.'}"
                    </p>
                  </div>
                ))}
                {(!reviewsData.reviews || reviewsData.reviews.length === 0) && (
                  <p className="text-xs text-slate-400 py-8 text-center">
                    Cụm sân chưa nhận được đánh giá nào từ khách hàng.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 7: ĐIỀU KHOẢN, QUY ĐỊNH & THƯ VIỆN HÌNH ẢNH SÂN */}
        {/* ========================================================= */}
        {tab === 'VENUE_DETAILS' && (
          <form onSubmit={handleSaveVenueDetails} className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-slate-900">Hình ảnh, Điều khoản & Giới thiệu sân</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Chỉnh sửa hình ảnh thư viện hiển thị trên sàn, cập nhật mô tả giới thiệu và danh sách nội quy sân.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* QUẢN LÝ THƯ VIỆN ẢNH SÂN */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                <h3 className="font-extrabold text-slate-900 text-base">Thư viện Hình ảnh Sân ({venueImages.length})</h3>

                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="Dán link ảnh (https://...)"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddImage}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm"
                  >
                    + Thêm ảnh
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto p-1">
                  {venueImages.map((imgUrl, i) => (
                    <div key={i} className="relative group rounded-2xl overflow-hidden border border-slate-200 h-32 bg-slate-100 shadow-sm">
                      <img
                        src={imgUrl}
                        alt={`Ảnh sân ${i + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=900&q=80';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(i)}
                        className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shadow-md opacity-0 group-hover:opacity-100 transition"
                        title="Xóa ảnh này"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* QUẢN LÝ ĐIỀU KHOẢN & NỘI QUY */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                <h3 className="font-extrabold text-slate-900 text-base">Nội quy & Điều khoản sân</h3>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mô tả giới thiệu cụm sân</label>
                  <textarea
                    rows={3}
                    value={venueDescription}
                    onChange={(e) => setVenueDescription(e.target.value)}
                    placeholder="Giới thiệu về cơ sở vật chất, hệ thống thảm, quạt làm mát..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Thêm điều khoản / nội quy mới</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="VD: Không mang đồ ăn có mùi vào khu vực thảm"
                      value={newRuleText}
                      onChange={(e) => setNewRuleText(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddRule}
                      className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm"
                    >
                      + Thêm
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {venueRules.map((r, i) => (
                    <div
                      key={i}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center gap-2"
                    >
                      <span className="text-slate-700 font-medium">{r}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveRule(i)}
                        className="text-red-500 hover:text-red-700 font-bold"
                        title="Xóa quy định này"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-xl text-sm transition shadow-sm"
            >
              💾 Lưu Thay Đổi Điều Khoản, Nội Quy & Thư Viện Ảnh Sân
            </button>
          </form>
        )}

        {/* ========================================================= */}
        {/* TAB 8: BÁO CÁO DOANH THU & BIỂU ĐỒ TRỰC QUAN */}
        {/* ========================================================= */}
        {tab === 'ANALYTICS' && analytics && (
          <div className="space-y-6">
            <RevenueCharts analytics={analytics} />
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 9: CẤU HÌNH TÍNH NĂNG, HSSV & VIETQR */}
        {/* ========================================================= */}
        {tab === 'SETTINGS' && (
          <form onSubmit={handleSaveSettings} className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
              <h2 className="font-extrabold text-slate-900 text-base">Công tắc Bật/Tắt Module (Feature Toggles)</h2>

              {[
                {
                  key: 'enable_vip_courts',
                  title: 'Sử dụng Sân VIP',
                  desc: 'Cho phép tạo và cấu hình giá riêng cho sân tiêu chuẩn VIP',
                },
                {
                  key: 'enable_pos_module',
                  title: 'Module Bán hàng POS tại quầy',
                  desc: 'Quản lý tồn kho nước uống, cầu lông và tạo hóa đơn tại quầy lễ tân',
                },
                {
                  key: 'enable_advanced_analytics',
                  title: 'Báo cáo Thống kê Chuyên sâu',
                  desc: 'Phân tích chi tiết doanh thu theo từng sân và top mặt hàng bán chạy',
                },
              ].map((toggle) => (
                <label
                  key={toggle.key}
                  className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/70 rounded-2xl border border-slate-200/70 cursor-pointer transition"
                >
                  <div className="pr-4">
                    <div className="text-xs font-extrabold text-slate-800">{toggle.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{toggle.desc}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(tenant[toggle.key])}
                    onChange={(e) => setTenant({ ...tenant, [toggle.key]: e.target.checked })}
                    className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                </label>
              ))}

              <div className="pt-4 border-t border-slate-100 space-y-3">
                <h2 className="font-extrabold text-slate-900 text-base">Chính sách Ưu đãi Học sinh / Sinh viên</h2>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Chế độ chiết khấu tự động</label>
                  <select
                    value={tenant.student_discount_type}
                    onChange={(e) => setTenant({ ...tenant, student_discount_type: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold"
                  >
                    <option value="NONE">Không áp dụng ưu đãi</option>
                    <option value="SYSTEM_DEFAULT_20">Giảm theo mặc định hệ thống (20%)</option>
                    <option value="CUSTOM_FIXED_OFF">Trừ thẳng số tiền cố định trên mỗi ca (VNĐ)</option>
                    <option value="CUSTOM_FLAT_RATE">Đồng giá ưu đãi theo giờ (VNĐ/giờ)</option>
                  </select>
                </div>
                {['CUSTOM_FIXED_OFF', 'CUSTOM_FLAT_RATE'].includes(tenant.student_discount_type) && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Mức tiền áp dụng (VNĐ)</label>
                    <input
                      type="number"
                      value={tenant.student_discount_value}
                      onChange={(e) => setTenant({ ...tenant, student_discount_value: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                <h2 className="font-extrabold text-slate-900 text-base">Tài khoản Ngân hàng nhận tiền 100% (VietQR)</h2>
                <p className="text-xs text-slate-500">
                  Hệ thống tự động sinh mã QR chuyển khoản dựa trên thông tin dưới đây khi khách đặt sân.
                </p>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mã Ngân hàng (VD: MB, VCB, TCB, ACB)</label>
                  <input
                    type="text"
                    value={tenant.qr_bank_name || ''}
                    onChange={(e) => setTenant({ ...tenant, qr_bank_name: e.target.value })}
                    placeholder="MB"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Số tài khoản nhận tiền</label>
                  <input
                    type="text"
                    value={tenant.qr_account_number || ''}
                    onChange={(e) => setTenant({ ...tenant, qr_account_number: e.target.value })}
                    placeholder="0987654321"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tên chủ tài khoản</label>
                  <input
                    type="text"
                    value={tenant.qr_account_name || ''}
                    onChange={(e) => setTenant({ ...tenant, qr_account_name: e.target.value })}
                    placeholder="NGUYEN VAN A"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm uppercase"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl text-sm transition shadow-sm"
              >
                💾 Lưu Toàn Bộ Cấu Hình Cụm Sân
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: LÊN LỊCH BẢO TRÌ SÂN (CHỐNG KHÁCH ĐẶT TRƯỚC) */}
      {/* ========================================================= */}
      {maintenanceModalCourt && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setMaintenanceModalCourt(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center text-sm transition"
            >
              ✕
            </button>

            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <span>🔧</span>
              <span>Lên Lịch Bảo Trì - {maintenanceModalCourt.name}</span>
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Khi kích hoạt bảo trì, tài khoản khách hàng sẽ không thể chọn đặt sân trong thời gian bảo trì. Hệ thống sẽ tự động kiểm tra nếu có khách đã đặt trước sẽ cảnh báo.
            </p>

            <form onSubmit={handleSaveMaintenance} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Thời điểm bắt đầu bảo trì</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMaintScheduleMode('NOW')}
                    className={`py-2 rounded-xl font-bold border transition ${
                      maintScheduleMode === 'NOW'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Bảo trì ngay bây giờ
                  </button>
                  <button
                    type="button"
                    onClick={() => setMaintScheduleMode('SCHEDULE')}
                    className={`py-2 rounded-xl font-bold border transition ${
                      maintScheduleMode === 'SCHEDULE'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Lên lịch từ ngày/giờ
                  </button>
                </div>
              </div>

              {maintScheduleMode === 'SCHEDULE' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Chọn ngày và giờ bắt đầu</label>
                  <input
                    type="datetime-local"
                    required
                    value={maintStartTime}
                    onChange={(e) => setMaintStartTime(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    * Chỉ cần chọn giờ bắt đầu. Khi bảo trì xong, bạn chỉ cần bấm "Hoàn tất bảo trì" để mở lại sân.
                  </p>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Lý do / Ghi chú bảo trì</label>
                <input
                  type="text"
                  required
                  value={maintNote}
                  onChange={(e) => setMaintNote(e.target.value)}
                  placeholder="VD: Thay mặt thảm, sửa hệ thống đèn"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMaintenanceModalCourt(null)}
                  className="flex-1 py-2.5 border rounded-xl font-bold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-bold transition shadow-sm"
                >
                  Xác nhận Bảo trì
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: SỬA THÔNG TIN SÂN */}
      {/* ========================================================= */}
      {editingCourt && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setEditingCourt(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center text-sm"
            >
              ✕
            </button>
            <h3 className="text-base font-black text-slate-900">Chỉnh sửa Sân</h3>
            <form onSubmit={handleUpdateCourt} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tên sân</label>
                <input
                  type="text"
                  required
                  value={editingCourt.name}
                  onChange={(e) => setEditingCourt({ ...editingCourt, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Phân loại sân</label>
                <select
                  value={editingCourt.type}
                  onChange={(e) => setEditingCourt({ ...editingCourt, type: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                >
                  <option value="STANDARD">Sân STANDARD</option>
                  {tenant.enable_vip_courts && <option value="VIP">Sân VIP</option>}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCourt(null)}
                  className="flex-1 py-2.5 border rounded-xl font-bold text-slate-600"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold transition shadow-sm"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: SỬA KHUNG GIÁ ĐỘNG */}
      {/* ========================================================= */}
      {editingRule && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setEditingRule(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center text-sm"
            >
              ✕
            </button>
            <h3 className="text-base font-black text-slate-900">Chỉnh sửa Khung Giá</h3>
            <form onSubmit={handleUpdatePricingRule} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Loại sân</label>
                <select
                  value={editingRule.court_type}
                  onChange={(e) => setEditingRule({ ...editingRule, court_type: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                >
                  <option value="STANDARD">Sân STANDARD</option>
                  <option value="VIP">Sân VIP</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Đơn giá (VNĐ/h)</label>
                <input
                  type="number"
                  required
                  value={editingRule.price_per_hour}
                  onChange={(e) => setEditingRule({ ...editingRule, price_per_hour: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Từ giờ</label>
                  <input
                    type="time"
                    value={editingRule.start_time}
                    onChange={(e) => setEditingRule({ ...editingRule, start_time: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Đến giờ</label>
                  <input
                    type="time"
                    value={editingRule.end_time}
                    onChange={(e) => setEditingRule({ ...editingRule, end_time: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRule(null)}
                  className="flex-1 py-2.5 border rounded-xl font-bold text-slate-600"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold transition shadow-sm"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: SỬA MẶT HÀNG KHO POS */}
      {/* ========================================================= */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setEditingProduct(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center text-sm"
            >
              ✕
            </button>
            <h3 className="text-base font-black text-slate-900">Chỉnh sửa Mặt hàng POS</h3>
            <form onSubmit={handleUpdateProduct} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tên sản phẩm</label>
                <input
                  type="text"
                  required
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Phân loại hàng hóa</label>
                <select
                  value={editingProduct.category}
                  onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                >
                  {POS_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Đơn giá (VNĐ)</label>
                  <input
                    type="number"
                    required
                    value={editingProduct.price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tồn kho</label>
                  <input
                    type="number"
                    required
                    value={editingProduct.stock_quantity}
                    onChange={(e) => setEditingProduct({ ...editingProduct, stock_quantity: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="flex-1 py-2.5 border rounded-xl font-bold text-slate-600"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold transition shadow-sm"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: SỬA LỄ TÂN & ĐỔI MẬT KHẨU (CÓ XÁC NHẬN MẬT KHẨU) */}
      {/* ========================================================= */}
      {editingStaff && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setEditingStaff(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center text-sm"
            >
              ✕
            </button>
            <h3 className="text-base font-black text-slate-900">Chỉnh sửa Tài khoản Lễ tân</h3>
            <form onSubmit={handleUpdateStaff} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Họ tên nhân viên</label>
                <input
                  type="text"
                  required
                  value={editingStaff.full_name}
                  onChange={(e) => setEditingStaff({ ...editingStaff, full_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Số điện thoại</label>
                <input
                  type="text"
                  required
                  value={editingStaff.phone}
                  onChange={(e) => setEditingStaff({ ...editingStaff, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 space-y-2">
                <span className="text-[11px] font-bold text-amber-900 block">
                  Đổi mật khẩu mới (Bỏ trống nếu không muốn đổi):
                </span>
                <div>
                  <input
                    type="password"
                    placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                    value={editingStaff.newPassword}
                    onChange={(e) => setEditingStaff({ ...editingStaff, newPassword: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs"
                  />
                </div>
                {editingStaff.newPassword && (
                  <div>
                    <input
                      type="password"
                      required
                      placeholder="Nhập lại mật khẩu mới để xác nhận"
                      value={editingStaff.confirmNewPassword}
                      onChange={(e) => setEditingStaff({ ...editingStaff, confirmNewPassword: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={editingStaff.is_active !== false}
                    onChange={(e) => setEditingStaff({ ...editingStaff, is_active: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Tài khoản đang hoạt động (Cho phép đăng nhập)</span>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="flex-1 py-2.5 border rounded-xl font-bold text-slate-600"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold transition shadow-sm"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}