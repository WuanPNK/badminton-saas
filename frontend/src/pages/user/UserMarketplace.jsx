/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';

// Bộ ảnh minh họa thực tế cho các cụm sân cầu lông
const COURT_GALLERY = [
  'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1521537634581-0dced2fee2ef?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1599474924187-334a4ae5bd3c?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=900&q=80',
];

export default function UserMarketplace() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  // Điều hướng chính: 'MARKETPLACE' | 'MY_BOOKINGS' | 'ACCOUNT'
  const [activeTab, setActiveTab] = useState('MARKETPLACE');
  // Menu con trong trang Tài khoản (Hình 9): 'PROFILE' | 'PASSWORD' | 'BOOKINGS' | 'TERMS'
  const [accountSection, setAccountSection] = useState('PROFILE');

  const [tenants, setTenants] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [bookingFilter, setBookingFilter] = useState('ALL');
  const [district, setDistrict] = useState('');
  const [search, setSearch] = useState('');

  // State cho Modal Xem Chi Tiết Cụm Sân (Khi bấm vào thẻ sân - Hình 3, 4, 5, 6)
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [venueDetailTab, setVenueDetailTab] = useState('PRICING'); // 'INFO' | 'PRICING' | 'IMAGES' | 'RULES' | 'REVIEWS'
  const [loadingVenue, setLoadingVenue] = useState(false);

  // State cho Modal Hủy sân hoàn tiền 100%
  const [cancelModalBooking, setCancelModalBooking] = useState(null);
  const [refundBank, setRefundBank] = useState({
    refundBankName: 'MB Bank',
    refundAccountNumber: '',
    refundAccountName: '',
  });

  // State cho Modal Đánh giá sân
  const [reviewModalBooking, setReviewModalBooking] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });

  // State cho Form Cập nhật Hồ sơ & Đổi mật khẩu trong trang Tài khoản
  const [profileForm, setProfileForm] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    studentCardImage: '',
    studentCardFileName: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [accountMsg, setAccountMsg] = useState({ type: '', text: '' });
  const [savingAccount, setSavingAccount] = useState(false);

  const fetchMarketplace = async () => {
    try {
      const res = await axiosClient.get('/tenant/marketplace', {
        params: { district, search },
      });
      setTenants(res.data.tenants || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMyBookings = async () => {
    try {
      const res = await axiosClient.get('/bookings/my-bookings');
      setMyBookings(res.data.bookings || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMarketplace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [district]);

  useEffect(() => {
    if (activeTab === 'MY_BOOKINGS' || (activeTab === 'ACCOUNT' && accountSection === 'BOOKINGS')) {
      fetchMyBookings();
    }
  }, [activeTab, accountSection]);

  // Mở Modal Xem chi tiết Cụm sân (Bảng giá, Hình ảnh, Quy định, Đánh giá)
  const handleOpenVenueDetail = async (tenantId, defaultTab = 'PRICING') => {
    setLoadingVenue(true);
    setVenueDetailTab(defaultTab);
    try {
      const res = await axiosClient.get(`/tenant/marketplace/${tenantId}`);
      setSelectedVenue(res.data.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể tải thông tin chi tiết cụm sân.');
    } finally {
      setLoadingVenue(false);
    }
  };

  // Gửi yêu cầu Hủy sân (Trước 24h) -> PENDING_REFUND
  const handleConfirmCancel = async (e) => {
    e.preventDefault();
    try {
      const res = await axiosClient.put(
        `/payments/${cancelModalBooking.id}/cancel-refund`,
        refundBank
      );
      alert(res.data.message);
      setCancelModalBooking(null);
      fetchMyBookings();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi hủy sân.');
    }
  };

  // Gửi đánh giá cho đơn COMPLETED
  const handleSubmitReview = async (e) => {
    e.preventDefault();
    try {
      const res = await axiosClient.post('/reviews', {
        bookingId: reviewModalBooking.id,
        rating: reviewForm.rating,
        comment: reviewForm.comment,
      });
      alert(res.data.message);
      setReviewModalBooking(null);
      fetchMyBookings();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi gửi đánh giá.');
    }
  };

  // Xử lý chọn ảnh thẻ sinh viên trong trang Tài khoản
  const handleStudentCardUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      return setAccountMsg({ type: 'error', text: 'Vui lòng chọn tệp hình ảnh hợp lệ.' });
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileForm((prev) => ({
        ...prev,
        studentCardImage: reader.result,
        studentCardFileName: file.name,
      }));
    };
    reader.readAsDataURL(file);
  };

  // Lưu thông tin hồ sơ cá nhân
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingAccount(true);
    setAccountMsg({ type: '', text: '' });
    try {
      const res = await axiosClient.put('/auth/profile', profileForm);
      updateUser(res.data.user);
      setAccountMsg({ type: 'success', text: res.data.message });
    } catch (err) {
      setAccountMsg({
        type: 'error',
        text: err.response?.data?.message || 'Lỗi khi cập nhật hồ sơ.',
      });
    } finally {
      setSavingAccount(false);
    }
  };

  // Đổi mật khẩu tài khoản
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword.length < 6) {
      return setAccountMsg({ type: 'error', text: 'Mật khẩu mới phải có tối thiểu 6 ký tự.' });
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return setAccountMsg({ type: 'error', text: 'Mật khẩu xác nhận không khớp!' });
    }

    setSavingAccount(true);
    setAccountMsg({ type: '', text: '' });
    try {
      const res = await axiosClient.put('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setAccountMsg({ type: 'success', text: res.data.message });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setAccountMsg({
        type: 'error',
        text: err.response?.data?.message || 'Không thể đổi mật khẩu.',
      });
    } finally {
      setSavingAccount(false);
    }
  };

  const renderStudentBadge = () => {
    if (user?.studentStatus === 'VERIFIED') {
      return (
        <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-full text-xs font-bold">
          🎓 Học sinh / Sinh viên (Đã xác thực)
        </span>
      );
    }
    if (user?.studentStatus === 'PENDING_APPROVAL') {
      return (
        <span className="bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1 rounded-full text-xs font-semibold">
          ⏳ Thẻ HSSV đang chờ duyệt
        </span>
      );
    }
    return (
      <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-medium">
        Khách hàng tiêu chuẩn
      </span>
    );
  };

  const renderDiscountLabel = (type, value) => {
    if (type === 'SYSTEM_DEFAULT_20') return 'Ưu đãi HSSV: Giảm tự động 20%';
    if (type === 'CUSTOM_FIXED_OFF') return `Ưu đãi HSSV: Giảm thẳng ${Number(value).toLocaleString()}đ/ca`;
    if (type === 'CUSTOM_FLAT_RATE') return `Ưu đãi HSSV: Đồng giá ${Number(value).toLocaleString()}đ/giờ`;
    return 'Không áp dụng ưu đãi HSSV';
  };

  // Tính giá sau ưu đãi HSSV để hiển thị trong Bảng giá chi tiết sân (Hình 3)
  const calcStudentHourlyPreview = (pricePerHour, tenant) => {
    const base = Number(pricePerHour);
    if (!tenant || tenant.student_discount_type === 'NONE') return `${base.toLocaleString()} ₫`;
    if (tenant.student_discount_type === 'SYSTEM_DEFAULT_20') {
      return `${Math.round(base * 0.8).toLocaleString()} ₫ (-20%)`;
    }
    if (tenant.student_discount_type === 'CUSTOM_FLAT_RATE') {
      return `${Number(tenant.student_discount_value).toLocaleString()} ₫/h`;
    }
    if (tenant.student_discount_type === 'CUSTOM_FIXED_OFF') {
      return `Giảm ${Number(tenant.student_discount_value).toLocaleString()} ₫/ca`;
    }
    return `${base.toLocaleString()} ₫`;
  };

  const formatDaysOfWeek = (daysArr) => {
    if (!Array.isArray(daysArr)) return 'T2 - CN';
    const sorted = [...daysArr].sort((a, b) => a - b);
    if (sorted.length === 7) return 'T2 - CN';
    if (sorted.join(',') === '1,2,3,4,5') return 'T2 - T6';
    if (sorted.join(',') === '6,7') return 'T7 - CN';
    return sorted.map((d) => (d === 7 ? 'CN' : `T${d + 1}`)).join(', ');
  };

  const filteredBookings = myBookings.filter((b) => {
    if (bookingFilter === 'ALL') return true;
    return b.status === bookingFilter;
  });

  return (
    <div className="min-h-screen bg-[#F4F7F6] pb-20">
      {/* HEADER CHÍNH */}
      <header className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white px-4 sm:px-8 py-4 shadow-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div
            onClick={() => setActiveTab('MARKETPLACE')}
            className="flex items-center gap-3 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center text-xl shadow-inner">
              🏸
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">
                Badminton SaaS Marketplace
              </h1>
              <p className="text-xs text-emerald-200">
                Xin chào, <strong className="text-white">{user?.fullName}</strong>
              </p>
            </div>
          </div>

          {/* THANH ĐIỀU HƯỚNG TRÊN CÙNG */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setActiveTab('MARKETPLACE')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'MARKETPLACE'
                  ? 'bg-white text-emerald-900 shadow-sm'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <span>🏟️</span>
              <span>Khám phá Cụm sân</span>
            </button>

            <button
              onClick={() => setActiveTab('MY_BOOKINGS')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'MY_BOOKINGS'
                  ? 'bg-white text-emerald-900 shadow-sm'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <span>📅</span>
              <span>Sân đã đặt ({myBookings.length})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('ACCOUNT');
                setAccountMsg({ type: '', text: '' });
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'ACCOUNT'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <span>👤</span>
              <span>Tài khoản</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-6">
        {/* ===================================================================== */}
        {/* TAB 1: MARKETPLACE - DANH SÁCH CỤM SÂN (HÌNH 2)                       */}
        {/* ===================================================================== */}
        {activeTab === 'MARKETPLACE' && (
          <div>
            {/* THANH TÌM KIẾM & LỌC KHU VỰC */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 flex flex-wrap items-center gap-3 mb-6">
              <div className="flex-1 min-w-[240px] relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchMarketplace()}
                  placeholder="Tìm theo tên cụm sân hoặc địa chỉ đường..."
                  className="w-full pl-4 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">📍 Tất cả Quận / Khu vực</option>
                <option value="Cầu Giấy">Quận Cầu Giấy</option>
                <option value="Đống Đa">Quận Đống Đa</option>
                <option value="Thanh Xuân">Quận Thanh Xuân</option>
                <option value="Hai Bà Trưng">Quận Hai Bà Trưng</option>
                <option value="Hoàng Mai">Quận Hoàng Mai</option>
                <option value="Nam Từ Liêm">Quận Nam Từ Liêm</option>
              </select>

              <button
                onClick={fetchMarketplace}
                className="bg-emerald-700 hover:bg-emerald-800 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition shadow-sm"
              >
                Tìm kiếm
              </button>
            </div>

            {/* LƯỚI THẺ CỤM SÂN PHONG CÁCH MỚI (HÌNH 2) */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tenants.map((t, index) => {
                const coverImg = COURT_GALLERY[index % COURT_GALLERY.length];
                return (
                  <div
                    key={t.id}
                    onClick={() => handleOpenVenueDetail(t.id, 'PRICING')}
                    className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl border border-slate-200/80 transition-all duration-200 cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      {/* ẢNH BÌA SÂN & TAGS */}
                      <div className="relative h-44 overflow-hidden bg-slate-900">
                        <img
                          src={coverImg}
                          alt={t.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />

                        {/* NHÃN GÓC TRÊN TRÁI */}
                        <div className="absolute top-3 left-3 flex items-center gap-1.5">
                          <span className="bg-white/95 text-amber-600 text-xs font-extrabold px-2.5 py-1 rounded-full shadow flex items-center gap-1">
                            ★ {Number(t.avg_rating) > 0 ? t.avg_rating : 'Mới'} ({t.total_reviews})
                          </span>
                          <span className="bg-emerald-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow">
                            Đơn ngày
                          </span>
                          <span className="bg-purple-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow">
                            Sự kiện
                          </span>
                        </div>

                        {/* QUẬN GÓC TRÊN PHẢI */}
                        <span className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
                          Quận {t.district}
                        </span>

                        {/* GIỜ MỞ CỬA & SỐ SÂN Ở ĐÁY ẢNH */}
                        <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center text-white text-xs">
                          <span className="font-semibold">🕒 05:00 - 22:00</span>
                          <span className="bg-emerald-600/90 px-2.5 py-0.5 rounded-md font-bold">
                            {t.total_courts} sân tiêu chuẩn
                          </span>
                        </div>
                      </div>

                      {/* NỘI DUNG THẺ SÂN */}
                      <div className="p-5">
                        <h3 className="text-base font-extrabold text-slate-900 group-hover:text-emerald-700 transition line-clamp-1">
                          {t.name}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-1">📍 {t.address}</p>
                        <p className="text-xs text-slate-600 mt-1">
                          📞 Hotline: <strong className="text-slate-800">{t.phone_contact}</strong>
                        </p>

                        <div className="mt-3 bg-emerald-50/90 border border-emerald-200 text-emerald-800 text-xs px-3 py-2 rounded-xl font-semibold">
                          🎓 {renderDiscountLabel(t.student_discount_type, t.student_discount_value)}
                        </div>
                      </div>
                    </div>

                    {/* 2 NÚT THAO TÁC RÕ RÀNG: XEM CHI TIẾT (BẢNG GIÁ/ĐÁNH GIÁ) & ĐẶT LỊCH */}
                    <div className="px-5 pb-5 pt-2 flex items-center gap-2.5 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenVenueDetail(t.id, 'PRICING');
                        }}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 rounded-xl text-xs transition"
                      >
                        Bảng giá & Đánh giá
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/marketplace/${t.id}`);
                        }}
                        className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold py-2.5 rounded-xl text-xs transition shadow-sm"
                      >
                        ĐẶT LỊCH →
                      </button>
                    </div>
                  </div>
                );
              })}

              {tenants.length === 0 && (
                <div className="col-span-3 bg-white rounded-2xl p-12 text-center border border-slate-200">
                  <p className="text-sm text-slate-500">
                    Không tìm thấy cụm sân nào phù hợp với bộ lọc hiện tại.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 2: LỊCH SỬ ĐẶT SÂN, HOÀN TIỀN & ĐÁNH GIÁ                          */}
        {/* ===================================================================== */}
        {activeTab === 'MY_BOOKINGS' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap justify-between items-center gap-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Danh sách Lịch đã đặt, Hoàn tiền & Đánh giá
                </h2>
                <p className="text-xs text-slate-500">
                  Hủy lịch trước giờ chơi tối thiểu 24h để được hoàn tiền 100% qua ngân hàng
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5 text-xs font-bold">
                {[
                  { id: 'ALL', label: 'Tất cả' },
                  { id: 'CONFIRMED', label: 'Đã xác nhận' },
                  { id: 'COMPLETED', label: 'Đã hoàn tất (Đánh giá)' },
                  { id: 'PENDING_REFUND', label: 'Chờ hoàn tiền' },
                  { id: 'REFUNDED', label: 'Đã hoàn tiền' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setBookingFilter(f.id)}
                    className={`px-3 py-1.5 rounded-xl transition ${
                      bookingFilter === f.id
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredBookings.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-sm text-slate-400">
                Bạn chưa có lịch đặt nào trong mục này.
              </div>
            ) : (
              filteredBookings.map((b) => (
                <div
                  key={b.id}
                  className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-slate-900">{b.tenant_name}</span>
                      <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold">
                        {b.court_name} ({b.court_type})
                      </span>
                      <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                        #{b.booking_code}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      🕒 Thời gian: <strong>{new Date(b.start_time).toLocaleString('vi-VN')}</strong> →{' '}
                      <strong>{new Date(b.end_time).toLocaleTimeString('vi-VN')}</strong>
                    </p>
                    <p className="text-sm font-extrabold text-emerald-700">
                      Tổng thanh toán: {Number(b.final_price).toLocaleString()} ₫
                      {b.is_student_applied && (
                        <span className="ml-2 text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold">
                          🎓 Đã giảm HSSV (-{Number(b.discount_applied).toLocaleString()} ₫)
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        b.status === 'CONFIRMED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : b.status === 'COMPLETED'
                          ? 'bg-blue-100 text-blue-800'
                          : b.status === 'PENDING_REFUND'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {b.status}
                    </span>

                    {b.status === 'CONFIRMED' && (
                      <button
                        onClick={() => setCancelModalBooking(b)}
                        className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3.5 py-2 rounded-xl text-xs font-bold transition"
                      >
                        Hủy sân & Nhận hoàn tiền 100%
                      </button>
                    )}

                    {b.status === 'COMPLETED' && !b.has_reviewed && (
                      <button
                        onClick={() => setReviewModalBooking(b)}
                        className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-3.5 py-2 rounded-xl text-xs font-extrabold transition shadow-sm"
                      >
                        ★ Viết đánh giá sân
                      </button>
                    )}

                    {b.has_reviewed && (
                      <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-3 py-1.5 rounded-xl">
                        ✓ Đã đánh giá
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 3: TRUNG TÂM TÀI KHOẢN & ĐỔI MẬT KHẨU (THAM KHẢO HÌNH 9)          */}
        {/* ===================================================================== */}
        {activeTab === 'ACCOUNT' && (
          <div className="grid lg:grid-cols-12 gap-6 items-start">
            {/* CỘT TRÁI: MENU TÀI KHOẢN & HỆ THỐNG (HÌNH 9) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200/80 space-y-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-700 text-white flex items-center justify-center text-xl font-black shadow">
                    {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">{user?.fullName}</h3>
                    <p className="text-xs text-slate-500">{user?.email}</p>
                    <div className="mt-1.5">{renderStudentBadge()}</div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200/80 space-y-4 text-xs">
                <div>
                  <p className="px-3 text-[11px] font-extrabold uppercase text-emerald-800 mb-2">
                    Tài khoản & Bảo mật
                  </p>
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        setAccountSection('PROFILE');
                        setAccountMsg({ type: '', text: '' });
                      }}
                      className={`w-full flex justify-between items-center px-3.5 py-3 rounded-2xl font-bold transition ${
                        accountSection === 'PROFILE'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span>👤 Thông tin cá nhân & Thẻ HSSV</span>
                      <span>›</span>
                    </button>

                    <button
                      onClick={() => {
                        setAccountSection('PASSWORD');
                        setAccountMsg({ type: '', text: '' });
                      }}
                      className={`w-full flex justify-between items-center px-3.5 py-3 rounded-2xl font-bold transition ${
                        accountSection === 'PASSWORD'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span>🔒 Đổi mật khẩu tài khoản</span>
                      <span>›</span>
                    </button>
                  </div>
                </div>

                <div>
                  <p className="px-3 text-[11px] font-extrabold uppercase text-emerald-800 mb-2">
                    Hoạt động
                  </p>
                  <button
                    onClick={() => setAccountSection('BOOKINGS')}
                    className={`w-full flex justify-between items-center px-3.5 py-3 rounded-2xl font-bold transition ${
                      accountSection === 'BOOKINGS'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span>📅 Danh sách lịch đã đặt</span>
                    <span>›</span>
                  </button>
                </div>

                <div>
                  <p className="px-3 text-[11px] font-extrabold uppercase text-emerald-800 mb-2">
                    Hệ thống
                  </p>
                  <div className="space-y-1">
                    <button
                      onClick={() => setAccountSection('TERMS')}
                      className={`w-full flex justify-between items-center px-3.5 py-3 rounded-2xl font-bold transition ${
                        accountSection === 'TERMS'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span>🛡️ Điều khoản và chính sách</span>
                      <span>›</span>
                    </button>

                    <div className="flex justify-between items-center px-3.5 py-2.5 text-slate-500">
                      <span>ℹ️ Thông tin phiên bản</span>
                      <span className="font-mono font-semibold text-slate-700">v2.1.0 SaaS</span>
                    </div>

                    <div className="flex justify-between items-center px-3.5 py-2.5 text-slate-500">
                      <span>🌐 Ngôn ngữ</span>
                      <span className="font-semibold text-slate-700">Tiếng Việt</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <button
                    onClick={() => {
                      logout();
                      navigate('/');
                    }}
                    className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-extrabold py-3 rounded-2xl transition"
                  >
                    Đăng xuất khỏi hệ thống
                  </button>
                </div>
              </div>
            </div>

            {/* CỘT PHẢI: NỘI DUNG TƯƠNG ỨNG */}
            <div className="lg:col-span-8 bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200/80">
              {accountMsg.text && (
                <div
                  className={`p-3.5 rounded-2xl text-xs mb-5 font-bold flex items-center gap-2 ${
                    accountMsg.type === 'error'
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  <span>{accountMsg.type === 'error' ? '⚠️' : '✅'}</span>
                  <span>{accountMsg.text}</span>
                </div>
              )}

              {/* 1. THÔNG TIN CÁ NHÂN & CẬP NHẬT THẺ SINH VIÊN */}
              {accountSection === 'PROFILE' && (
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="border-b border-slate-100 pb-3">
                    <h2 className="text-lg font-extrabold text-slate-900">
                      Thông tin cá nhân & Ưu đãi Học sinh / Sinh viên
                    </h2>
                    <p className="text-xs text-slate-500">
                      Quản lý họ tên, số điện thoại liên hệ và hồ sơ xác thực thẻ sinh viên
                    </p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Họ và tên
                      </label>
                      <input
                        type="text"
                        required
                        value={profileForm.fullName}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, fullName: e.target.value })
                        }
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Số điện thoại
                      </label>
                      <input
                        type="text"
                        required
                        value={profileForm.phone}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, phone: e.target.value })
                        }
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Địa chỉ Email (Không thể thay đổi)
                    </label>
                    <input
                      type="email"
                      disabled
                      value={user?.email || ''}
                      className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500"
                    />
                  </div>

                  {/* KHỐI XÁC THỰC THẺ SINH VIÊN */}
                  <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-extrabold text-emerald-950">
                        🎓 Trạng thái Ưu đãi Học sinh / Sinh viên
                      </span>
                      {renderStudentBadge()}
                    </div>

                    {user?.studentStatus !== 'VERIFIED' && (
                      <div className="space-y-2">
                        <p className="text-xs text-emerald-800">
                          Tải lên ảnh chụp Thẻ Học sinh / Sinh viên để Super Admin phê duyệt giảm giá tự động khi đặt sân:
                        </p>
                        <label className="flex flex-col items-center justify-center w-full p-4 bg-white border-2 border-dashed border-emerald-300 rounded-xl cursor-pointer hover:bg-emerald-50/40 transition">
                          {profileForm.studentCardImage ? (
                            <div className="text-center space-y-2">
                              <img
                                src={profileForm.studentCardImage}
                                alt="Preview"
                                className="max-h-32 mx-auto rounded-lg border"
                              />
                              <p className="text-xs font-bold text-emerald-700">
                                ✓ {profileForm.studentCardFileName}
                              </p>
                            </div>
                          ) : (
                            <div className="text-center py-1">
                              <span className="text-xl">📷</span>
                              <p className="text-xs font-bold text-emerald-800 mt-1">
                                Bấm để chọn ảnh Thẻ Sinh viên từ máy
                              </p>
                            </div>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleStudentCardUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={savingAccount}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl text-xs transition shadow-sm"
                  >
                    {savingAccount ? 'Đang lưu...' : '💾 Lưu thay đổi hồ sơ'}
                  </button>
                </form>
              )}

              {/* 2. ĐỔI MẬT KHẨU TÀI KHOẢN */}
              {accountSection === 'PASSWORD' && (
                <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                  <div className="border-b border-slate-100 pb-3">
                    <h2 className="text-lg font-extrabold text-slate-900">Đổi mật khẩu tài khoản</h2>
                    <p className="text-xs text-slate-500">
                      Vui lòng nhập mật khẩu hiện tại và xác nhận mật khẩu mới
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Mật khẩu hiện tại
                    </label>
                    <input
                      type="password"
                      required
                      value={passwordForm.currentPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                      }
                      placeholder="Nhập mật khẩu đang sử dụng"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Mật khẩu mới (Tối thiểu 6 ký tự)
                    </label>
                    <input
                      type="password"
                      required
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                      }
                      placeholder="Nhập mật khẩu mới"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nhập lại mật khẩu mới
                    </label>
                    <input
                      type="password"
                      required
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                      }
                      placeholder="Xác nhận lại mật khẩu mới"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    />
                  </div>

                  {passwordForm.confirmPassword &&
                    passwordForm.newPassword !== passwordForm.confirmPassword && (
                      <p className="text-xs text-red-600 font-semibold">
                        ⚠️ Mật khẩu nhập lại không khớp!
                      </p>
                    )}

                  <button
                    type="submit"
                    disabled={savingAccount}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl text-xs transition shadow-sm"
                  >
                    {savingAccount ? 'Đang cập nhật...' : '🔒 Cập nhật mật khẩu mới'}
                  </button>
                </form>
              )}

              {/* 3. DANH SÁCH LỊCH ĐÃ ĐẶT TRONG TRANG TÀI KHOẢN (HÌNH 9) */}
              {accountSection === 'BOOKINGS' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <h2 className="text-lg font-extrabold text-slate-900">Danh sách đặt lịch</h2>
                    <button
                      onClick={() => setActiveTab('MY_BOOKINGS')}
                      className="text-xs font-bold text-emerald-700 hover:underline"
                    >
                      Mở chế độ toàn màn hình →
                    </button>
                  </div>

                  {myBookings.length === 0 ? (
                    <div className="py-16 text-center text-sm text-slate-400">
                      Bạn chưa có lịch đặt
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {myBookings.map((b) => (
                        <div
                          key={b.id}
                          className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 flex flex-wrap justify-between items-center gap-3 text-xs"
                        >
                          <div>
                            <div className="font-extrabold text-slate-900 text-sm">
                              {b.tenant_name} — {b.court_name}
                            </div>
                            <div className="text-slate-600 mt-0.5">
                              {new Date(b.start_time).toLocaleString('vi-VN')} • Mã: #{b.booking_code}
                            </div>
                            <div className="font-bold text-emerald-700 mt-1">
                              {Number(b.final_price).toLocaleString()} ₫ ({b.status})
                            </div>
                          </div>

                          <div className="flex gap-2">
                            {b.status === 'CONFIRMED' && (
                              <button
                                onClick={() => setCancelModalBooking(b)}
                                className="bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 rounded-xl font-bold"
                              >
                                Hủy & Hoàn tiền
                              </button>
                            )}
                            {b.status === 'COMPLETED' && !b.has_reviewed && (
                              <button
                                onClick={() => setReviewModalBooking(b)}
                                className="bg-amber-500 text-slate-950 px-3 py-1.5 rounded-xl font-bold"
                              >
                                ★ Đánh giá
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 4. ĐIỀU KHOẢN & CHÍNH SÁCH */}
              {accountSection === 'TERMS' && (
                <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
                  <h2 className="text-lg font-extrabold text-slate-900 mb-2">
                    Điều khoản và Chính sách Đặt lịch
                  </h2>
                  <p>
                    <strong>1. Quy định đặt lịch theo block 30 phút:</strong> Mọi lượt đặt sân trực quan đều được tính theo bội số 30 phút (tối thiểu 60 phút/ca) và tự động tính giá động theo khung giờ của từng cụm sân.
                  </p>
                  <p>
                    <strong>2. Chính sách hoàn tiền 100%:</strong> Khách hàng hủy lịch đặt trước giờ bắt đầu chơi tối thiểu <strong>24 giờ</strong> sẽ được hoàn lại 100% số tiền đã thanh toán vào tài khoản ngân hàng cung cấp.
                  </p>
                  <p>
                    <strong>3. Chính sách Học sinh / Sinh viên:</strong> Tài khoản có thẻ HSSV ở trạng thái <code>VERIFIED</code> được hệ thống tự động khấu trừ ưu đãi trên mọi khung giờ theo cấu hình của chủ sân.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL XEM CHI TIẾT CỤM SÂN 4 TAB (HÌNH 3, 4, 5, 6)                        */}
      {/* ========================================================================= */}
      {(selectedVenue || loadingVenue) && (
        <div
          onClick={() => setSelectedVenue(null)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 z-50"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
          >
            {loadingVenue || !selectedVenue ? (
              <div className="p-16 text-center text-sm text-slate-500">
                Đang tải thông tin cụm sân...
              </div>
            ) : (
              <>
                {/* BANNER & HEADER CỤM SÂN (NHƯ HÌNH 3, 4, 5, 6) */}
                <div className="relative bg-gradient-to-r from-emerald-900 via-emerald-800 to-slate-900 text-white p-6">
                  <div className="flex flex-wrap justify-between items-start gap-4">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setSelectedVenue(null)}
                        className="w-10 h-10 rounded-full bg-white text-emerald-900 font-black flex items-center justify-center shadow hover:bg-slate-100"
                      >
                        ←
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                            🏸 Cầu lông • Quận {selectedVenue.tenant.district}
                          </span>
                          <span className="bg-amber-400 text-slate-950 text-xs font-extrabold px-2.5 py-0.5 rounded-full">
                            ★ {Number(selectedVenue.tenant.avg_rating) > 0 ? selectedVenue.tenant.avg_rating : 'Mới'} ({selectedVenue.reviews.length} đánh giá)
                          </span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black mt-1">
                          {selectedVenue.tenant.name}
                        </h2>
                        <p className="text-xs text-emerald-100 mt-0.5">
                          📍 {selectedVenue.tenant.address} • 🕒 Mở cửa: 05:00 - 22:00 • 📞 {selectedVenue.tenant.phone_contact}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        const id = selectedVenue.tenant.id;
                        setSelectedVenue(null);
                        navigate(`/marketplace/${id}`);
                      }}
                      className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black px-6 py-3 rounded-2xl text-sm shadow-lg transition"
                    >
                      Đặt lịch ngay →
                    </button>
                  </div>
                </div>

                {/* THANH TABS CHI TIẾT SÂN (DỊCH VỤ & BẢNG GIÁ / HÌNH ẢNH / QUY ĐỊNH / ĐÁNH GIÁ) */}
                <div className="flex border-b border-slate-200 bg-slate-50 px-6 overflow-x-auto text-xs font-extrabold">
                  {[
                    { id: 'PRICING', label: '💰 Bảng giá & Dịch vụ' },
                    { id: 'IMAGES', label: '🖼️ Hình ảnh sân' },
                    { id: 'RULES', label: '📋 Điều khoản & Quy định' },
                    { id: 'REVIEWS', label: `⭐ Đánh giá (${selectedVenue.reviews.length})` },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setVenueDetailTab(t.id)}
                      className={`px-4 py-3.5 border-b-2 whitespace-nowrap transition ${
                        venueDetailTab === t.id
                          ? 'border-emerald-600 text-emerald-700 bg-white'
                          : 'border-transparent text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* NỘI DUNG TỪNG TAB */}
                <div className="p-6 overflow-y-auto flex-1 space-y-5">
                  {/* TAB 1: BẢNG GIÁ GIỜ CHƠI & THÔNG TIN SÂN (HÌNH 3) */}
                  {venueDetailTab === 'PRICING' && (
                    <div className="space-y-5">
                      <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex flex-wrap justify-between items-center gap-2 text-xs">
                        <div>
                          <span className="font-extrabold text-emerald-950">
                            🎓 Chính sách Học sinh / Sinh viên tại sân:{' '}
                          </span>
                          <span className="text-emerald-800 font-semibold">
                            {renderDiscountLabel(
                              selectedVenue.tenant.student_discount_type,
                              selectedVenue.tenant.student_discount_value
                            )}
                          </span>
                        </div>
                        <span className="text-[11px] text-emerald-700 font-bold">
                          Hệ thống tự động áp dụng khi chọn giờ
                        </span>
                      </div>

                      {/* BẢNG GIÁ KẺ Ô THEO THỨ & KHUNG GIỜ (NHƯ HÌNH 3) */}
                      <div className="border border-slate-200 rounded-2xl overflow-hidden">
                        <div className="bg-emerald-800 text-white text-center py-2.5 font-extrabold text-sm">
                          BẢNG GIÁ THUÊ SÂN CẦU LÔNG
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-center border-collapse">
                            <thead>
                              <tr className="bg-slate-100 text-slate-800 font-extrabold border-b border-slate-200">
                                <th className="p-3 border-r border-slate-200">Loại sân</th>
                                <th className="p-3 border-r border-slate-200">Thứ</th>
                                <th className="p-3 border-r border-slate-200">Khung giờ</th>
                                <th className="p-3 border-r border-slate-200">Giá tiêu chuẩn</th>
                                <th className="p-3 text-emerald-700">Giá Học sinh / Sinh viên</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedVenue.pricingRules.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="p-6 text-slate-500">
                                    Đồng giá mặc định: <strong>80.000 ₫ / giờ</strong> cho tất cả các khung giờ.
                                  </td>
                                </tr>
                              ) : (
                                selectedVenue.pricingRules.map((rule) => (
                                  <tr
                                    key={rule.id}
                                    className="border-b border-slate-200 hover:bg-slate-50"
                                  >
                                    <td className="p-3 font-extrabold text-slate-900 border-r border-slate-200">
                                      Sân {rule.court_type}
                                    </td>
                                    <td className="p-3 font-semibold text-slate-700 border-r border-slate-200">
                                      {formatDaysOfWeek(rule.days_of_week)}
                                    </td>
                                    <td className="p-3 font-semibold text-emerald-800 border-r border-slate-200">
                                      {rule.start_time.slice(0, 5)} - {rule.end_time.slice(0, 5)}
                                    </td>
                                    <td className="p-3 font-extrabold text-slate-900 border-r border-slate-200">
                                      {Number(rule.price_per_hour).toLocaleString()} ₫/h
                                    </td>
                                    <td className="p-3 font-extrabold text-emerald-700 bg-emerald-50/40">
                                      {calcStudentHourlyPreview(
                                        rule.price_per_hour,
                                        selectedVenue.tenant
                                      )}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* DANH SÁCH SÂN CON HIỆN CÓ */}
                      <div>
                        <h4 className="text-xs font-extrabold uppercase text-slate-500 mb-2.5">
                          Danh sách sân đang mở phục vụ ({selectedVenue.courts.length} sân)
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {selectedVenue.courts.map((c) => (
                            <div
                              key={c.id}
                              className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex justify-between items-center text-xs"
                            >
                              <span className="font-extrabold text-slate-800">{c.name}</span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  c.is_under_maintenance
                                    ? 'bg-red-100 text-red-700'
                                    : c.type === 'VIP'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {c.is_under_maintenance ? 'Bảo trì' : c.type}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: HÌNH ẢNH SÂN (HÌNH 4) */}
                  {venueDetailTab === 'IMAGES' && (
                    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {COURT_GALLERY.map((imgUrl, i) => (
                        <div
                          key={i}
                          className="rounded-2xl overflow-hidden border border-slate-200 h-48 bg-slate-100"
                        >
                          <img
                            src={imgUrl}
                            alt={`Hình ảnh sân ${i + 1}`}
                            className="w-full h-full object-cover hover:scale-105 transition duration-300"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* TAB 3: ĐIỀU KHOẢN & QUY ĐỊNH (HÌNH 5) */}
                  {venueDetailTab === 'RULES' && (
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3 text-xs text-slate-700 leading-relaxed">
                      <h4 className="font-extrabold text-sm text-slate-900">
                        Nội quy & Quy định tại {selectedVenue.tenant.name}
                      </h4>
                      {selectedVenue.tenant.description && (
                        <p className="p-3 bg-white rounded-xl border border-slate-200">
                          {selectedVenue.tenant.description}
                        </p>
                      )}
                      <ul className="list-disc pl-5 space-y-2">
                        <li>
                          Vui lòng mang giày thể thao đế kếp chuyên dụng hoặc giày không để lại vết đen trên mặt thảm sân.
                        </li>
                        <li>
                          Có mặt trước giờ đặt 5–10 phút để làm thủ tục Check-in tại quầy Lễ tân.
                        </li>
                        <li>
                          <strong>Quy định Hủy lịch & Hoàn tiền:</strong> Hệ thống hỗ trợ hủy lịch và hoàn lại <strong>100% tiền sân</strong> khi quý khách thao tác hủy trước giờ bắt đầu chơi ít nhất <strong>24 tiếng</strong>.
                        </li>
                        <li>
                          Không hút thuốc lá và xả rác trong khu vực thảm thi đấu.
                        </li>
                      </ul>
                    </div>
                  )}

                  {/* TAB 4: ĐÁNH GIÁ TỪ NGƯỜI CHƠI (HÌNH 6) */}
                  {venueDetailTab === 'REVIEWS' && (
                    <div className="space-y-4">
                      {selectedVenue.reviews.length === 0 ? (
                        <div className="text-center py-12 text-xs text-slate-400">
                          Chưa có đánh giá nào cho cụm sân này. Hãy là người đầu tiên trải nghiệm và đánh giá!
                        </div>
                      ) : (
                        selectedVenue.reviews.map((r) => (
                          <div
                            key={r.id}
                            className="flex items-start gap-3.5 p-4 rounded-2xl border border-slate-100 bg-slate-50/70"
                          >
                            <div className="w-10 h-10 rounded-full bg-emerald-700 text-white font-extrabold flex items-center justify-center text-sm shrink-0">
                              {r.user_name?.charAt(0)?.toUpperCase() || 'K'}
                            </div>
                            <div className="flex-1 text-xs">
                              <div className="flex flex-wrap justify-between items-center gap-2">
                                <span className="font-extrabold text-slate-900 text-sm">
                                  {r.user_name}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  {new Date(r.created_at).toLocaleDateString('vi-VN')}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-amber-500 font-bold tracking-wider">
                                  {r.rating} {'★'.repeat(r.rating)}
                                  {'☆'.repeat(5 - r.rating)}
                                </span>
                                {r.court_name && (
                                  <span className="text-[10px] bg-white border px-2 py-0.5 rounded-full text-slate-600 font-semibold">
                                    Đã chơi tại: {r.court_name}
                                  </span>
                                )}
                              </div>
                              <p className="text-slate-700 mt-2">{r.comment}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL HỦY SÂN & HOÀN 100% TIỀN */}
      {cancelModalBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleConfirmCancel}
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4"
          >
            <h3 className="text-lg font-extrabold text-slate-900">
              Yêu cầu Hủy sân & Hoàn 100% tiền
            </h3>
            <p className="text-xs text-slate-600">
              Đơn sẽ chuyển sang trạng thái <strong>PENDING_REFUND</strong> để Lễ tân chuyển khoản hoàn lại{' '}
              <strong className="text-emerald-700">
                {Number(cancelModalBooking.final_price).toLocaleString()} ₫
              </strong>{' '}
              cho bạn (áp dụng khi hủy trước giờ chơi 24h).
            </p>
            <div>
              <label className="block text-xs font-bold mb-1">Tên Ngân hàng nhận hoàn tiền</label>
              <input
                type="text"
                required
                value={refundBank.refundBankName}
                onChange={(e) => setRefundBank({ ...refundBank, refundBankName: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Số tài khoản nhận tiền</label>
              <input
                type="text"
                required
                value={refundBank.refundAccountNumber}
                onChange={(e) =>
                  setRefundBank({ ...refundBank, refundAccountNumber: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Tên chủ tài khoản</label>
              <input
                type="text"
                required
                value={refundBank.refundAccountName}
                onChange={(e) =>
                  setRefundBank({ ...refundBank, refundAccountName: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-xl text-sm uppercase"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalBooking(null)}
                className="px-4 py-2 border rounded-xl text-xs font-bold"
              >
                Đóng
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold"
              >
                Xác nhận Hủy sân
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL ĐÁNH GIÁ SÂN */}
      {reviewModalBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleSubmitReview}
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4"
          >
            <h3 className="text-lg font-extrabold text-slate-900">
              Đánh giá {reviewModalBooking.tenant_name}
            </h3>
            <div>
              <label className="block text-xs font-bold mb-1">Số sao (1 - 5)</label>
              <select
                value={reviewForm.rating}
                onChange={(e) => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-xl text-sm font-semibold"
              >
                <option value={5}>★★★★★ (5 Sao - Tuyệt vời)</option>
                <option value={4}>★★★★☆ (4 Sao - Tốt)</option>
                <option value={3}>★★★☆☆ (3 Sao - Bình thường)</option>
                <option value={2}>★★☆☆☆ (2 Sao - Tạm được)</option>
                <option value={1}>★☆☆☆☆ (1 Sao - Kém)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Nhận xét trải nghiệm mặt sân</label>
              <textarea
                rows={3}
                required
                value={reviewForm.comment}
                onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                placeholder="Thảm sân mới, ánh sáng tốt, chủ sân nhiệt tình..."
                className="w-full px-3 py-2 border rounded-xl text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReviewModalBooking(null)}
                className="px-4 py-2 border rounded-xl text-xs font-bold"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
              >
                Gửi đánh giá
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}