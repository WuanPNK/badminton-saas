/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';

import VenueCard from '../../components/user/VenueCard';
import VenueDetailModal from '../../components/user/VenueDetailModal';
import CancelBookingModal from '../../components/user/CancelBookingModal';
import ReviewModal from '../../components/user/ReviewModal';
import AccountSettings from '../../components/user/AccountSettings';

const COURT_GALLERY = [
  'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1521537634581-0dced2fee2ef?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1599474924187-334a4ae5bd3c?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=900&q=80',
];

const POPULAR_DISTRICTS = ['Tất cả', 'Cầu Giấy', 'Đống Đa', 'Thanh Xuân', 'Nam Từ Liêm', 'Hai Bà Trưng', 'Hoàng Mai'];

export default function UserMarketplace() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('MARKETPLACE');
  const [accountSection, setAccountSection] = useState('PROFILE');

  const [tenants, setTenants] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [bookingFilter, setBookingFilter] = useState('ALL');
  const [district, setDistrict] = useState('');
  const [search, setSearch] = useState('');

  const [selectedVenue, setSelectedVenue] = useState(null);
  const [venueDetailTab, setVenueDetailTab] = useState('PRICING');
  const [loadingVenue, setLoadingVenue] = useState(false);

  const [cancelModalBooking, setCancelModalBooking] = useState(null);
  const [refundBank, setRefundBank] = useState({
    refundBankName: 'MB Bank',
    refundAccountNumber: '',
    refundAccountName: '',
  });

  const [reviewModalBooking, setReviewModalBooking] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });

  const [profileForm, setProfileForm] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    bankName: user?.bankName || '',
    bankAccountNumber: user?.bankAccountNumber || '',
    bankAccountName: user?.bankAccountName || '',
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
    if (!user) return;
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

  // Khi người dùng đăng nhập hoặc cập nhật: đồng bộ hồ sơ và thông tin hoàn tiền
  useEffect(() => {
    if (!user) {
      setActiveTab('MARKETPLACE');
      setMyBookings([]);
    } else {
      setProfileForm((prev) => ({
        ...prev,
        fullName: user.fullName || '',
        phone: user.phone || '',
        bankName: user.bankName || '',
        bankAccountNumber: user.bankAccountNumber || '',
        bankAccountName: user.bankAccountName || '',
      }));
      setRefundBank({
        refundBankName: user.bankName || 'MB Bank',
        refundAccountNumber: user.bankAccountNumber || '',
        refundAccountName: user.bankAccountName || (user.fullName ? user.fullName.toUpperCase() : ''),
      });
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    setActiveTab('MARKETPLACE');
    setMyBookings([]);
    navigate('/');
    toast.success('Đã đăng xuất.');
  };

  const handleOpenVenueDetail = async (tenantId, defaultTab = 'PRICING') => {
    setLoadingVenue(true);
    setVenueDetailTab(defaultTab);
    try {
      const res = await axiosClient.get(`/tenant/marketplace/${tenantId}`);
      setSelectedVenue(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể tải thông tin chi tiết cụm sân.');
    } finally {
      setLoadingVenue(false);
    }
  };

  const handleBookVenue = (tenantId) => {
    if (!user) {
      toast('Vui lòng đăng nhập để tiến hành đặt lịch sân.', { icon: 'ℹ️' });
      navigate('/login');
      return;
    }
    navigate(`/marketplace/${tenantId}`);
  };

  const handleConfirmCancel = async (e) => {
    e.preventDefault();
    try {
      const res = await axiosClient.put(
        `/payments/${cancelModalBooking.id}/cancel-refund`,
        refundBank
      );
      toast.success(res.data.message);
      setCancelModalBooking(null);
      fetchMyBookings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi hủy sân.');
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    try {
      const res = await axiosClient.post('/reviews', {
        bookingId: reviewModalBooking.id,
        rating: reviewForm.rating,
        comment: reviewForm.comment,
      });
      toast.success(res.data.message);
      setReviewModalBooking(null);
      fetchMyBookings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi gửi đánh giá.');
    }
  };

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
    <div className="min-h-screen bg-slate-100/70 pb-20">
      {/* NAVBAR PHONG CÁCH GLASSMORPHISM CAO CẤP */}
      <header className="bg-slate-950/90 backdrop-blur-xl text-white px-4 sm:px-8 py-3.5 shadow-xl border-b border-emerald-500/20 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div
            onClick={() => setActiveTab('MARKETPLACE')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-xl shadow-lg shadow-emerald-500/30 group-hover:scale-105 transition-transform">
              🏸
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-emerald-300 bg-clip-text text-transparent">
                  Badminton SaaS
                </h1>
                <span className="hidden sm:inline-block bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                  BWF Portal
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {user ? (
                  <>Xin chào, <strong className="text-emerald-300">{user.fullName}</strong></>
                ) : (
                  'Sàn đặt lịch sân cầu lông trực tuyến & đa cụm sân'
                )}
              </p>
            </div>
          </div>

          {/* KHU VỰC ĐIỀU HƯỚNG BÊN PHẢI */}
          <div className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <>
                <button
                  onClick={() => setActiveTab('MARKETPLACE')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'MARKETPLACE'
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-black'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  <span>🏟️</span>
                  <span>Khám phá Sân</span>
                </button>

                <button
                  onClick={() => setActiveTab('MY_BOOKINGS')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'MY_BOOKINGS'
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-black'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  <span>📅</span>
                  <span>Lịch của tôi ({myBookings.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('ACCOUNT')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'ACCOUNT'
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-black'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  <span>👤</span>
                  <span>Tài khoản</span>
                </button>

                {user.role === 'SUPER_ADMIN' && (
                  <button
                    onClick={() => navigate('/super-admin')}
                    className="px-3 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 transition shadow-sm cursor-pointer"
                  >
                    👑 Admin
                  </button>
                )}
                {user.role === 'TENANT_ADMIN' && (
                  <button
                    onClick={() => navigate('/tenant')}
                    className="px-3 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 transition shadow-sm cursor-pointer"
                  >
                    🏟️ Quản lý
                  </button>
                )}
                {user.role === 'STAFF' && (
                  <button
                    onClick={() => navigate('/staff')}
                    className="px-3 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 transition shadow-sm cursor-pointer"
                  >
                    🧑‍💼 Lễ tân
                  </button>
                )}

                <button
                  onClick={handleLogout}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
                >
                  Đăng xuất
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white hover:text-emerald-300 border border-white/25 hover:border-emerald-400/50 transition cursor-pointer"
                >
                  Đăng nhập
                </button>
                <button
                  onClick={() => navigate('/login?mode=register')}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 transition shadow-md shadow-emerald-500/25 active:scale-95 cursor-pointer"
                >
                  Đăng ký
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6">
        {activeTab === 'MARKETPLACE' && (
          <div className="space-y-6">
            {/* THANH TÌM KIẾM & BỘ LỌC KHU VỰC QUẬN */}
            <div className="bg-white p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-200/90 space-y-3.5">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex-1 min-w-[260px] relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchMarketplace()}
                    placeholder="Tìm theo tên cụm sân (Đông Đô, Thái Hà...) hoặc địa chỉ..."
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-2xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                  />
                </div>

                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
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
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl text-sm font-extrabold transition shadow-md shadow-emerald-600/25 active:scale-95 cursor-pointer"
                >
                  Tìm kiếm
                </button>
              </div>

              {/* QUICK DISTRICT PILLS (BẤM 1 CHẠM LỌC QUẬN) */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 overflow-x-auto pb-1">
                <span className="text-xs font-extrabold text-slate-400 whitespace-nowrap uppercase tracking-wider text-[11px]">
                  Khu vực nhanh:
                </span>
                <div className="flex items-center gap-1.5 flex-nowrap">
                  {POPULAR_DISTRICTS.map((d) => {
                    const isSelected = (d === 'Tất cả' && !district) || district === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDistrict(d === 'Tất cả' ? '' : d)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                        }`}
                      >
                        {d === 'Tất cả' ? '🌐 Tất cả' : `📍 ${d}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* TIÊU ĐỀ BỘ ĐẾM SÂN */}
            <div className="flex justify-between items-center px-1">
              <h3 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider">
                {district ? `Cụm sân tại Quận ${district}` : 'Tất cả cụm sân đang mở cửa'} ({tenants.length})
              </h3>
              <span className="text-xs text-slate-400">
                Cập nhật theo thời gian thực
              </span>
            </div>

            {/* DANH SÁCH THẺ SÂN */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tenants.map((t, index) => {
                const coverImg = COURT_GALLERY[index % COURT_GALLERY.length];
                return (
                  <VenueCard
                    key={t.id}
                    tenant={t}
                    coverImg={coverImg}
                    onOpenDetail={() => handleOpenVenueDetail(t.id, 'PRICING')}
                    onBook={() => handleBookVenue(t.id)}
                    renderDiscountLabel={renderDiscountLabel}
                  />
                );
              })}

              {tenants.length === 0 && (
                <div className="col-span-3 bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm space-y-3">
                  <div className="text-4xl">🏸</div>
                  <h4 className="text-base font-extrabold text-slate-800">
                    Không tìm thấy cụm sân nào phù hợp
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Hiện chưa có cụm sân nào khớp với từ khóa "{search}" hoặc khu vực bạn chọn. Vui lòng thử đổi từ khóa hoặc chọn quận khác.
                  </p>
                  <button
                    onClick={() => {
                      setDistrict('');
                      setSearch('');
                      fetchMarketplace();
                    }}
                    className="inline-block mt-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-100 transition cursor-pointer"
                  >
                    Xem tất cả cụm sân
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

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
                      🕒 Thời gian: <strong>{new Date(b.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })} → {new Date(b.end_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })} ({new Date(b.start_time).toLocaleDateString('vi-VN')})</strong>
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

        {activeTab === 'ACCOUNT' && (
          <AccountSettings
            user={user}
            accountSection={accountSection}
            setAccountSection={setAccountSection}
            profileForm={profileForm}
            setProfileForm={setProfileForm}
            passwordForm={passwordForm}
            setPasswordForm={setPasswordForm}
            accountMsg={accountMsg}
            setAccountMsg={setAccountMsg}
            savingAccount={savingAccount}
            handleSaveProfile={handleSaveProfile}
            handleChangePassword={handleChangePassword}
            handleStudentCardUpload={handleStudentCardUpload}
            renderStudentBadge={renderStudentBadge}
            myBookings={myBookings}
            setCancelModalBooking={setCancelModalBooking}
            setReviewModalBooking={setReviewModalBooking}
            setActiveTab={setActiveTab}
            onLogout={handleLogout}
          />
        )}
      </div>

      <VenueDetailModal
        selectedVenue={selectedVenue}
        loadingVenue={loadingVenue}
        venueDetailTab={venueDetailTab}
        setVenueDetailTab={setVenueDetailTab}
        onClose={() => setSelectedVenue(null)}
        onBook={() => {
          const id = selectedVenue.tenant.id;
          setSelectedVenue(null);
          handleBookVenue(id);
        }}
        renderDiscountLabel={renderDiscountLabel}
        calcStudentHourlyPreview={calcStudentHourlyPreview}
        formatDaysOfWeek={formatDaysOfWeek}
        gallery={COURT_GALLERY}
      />

      <CancelBookingModal
        booking={cancelModalBooking}
        refundBank={refundBank}
        setRefundBank={setRefundBank}
        onClose={() => setCancelModalBooking(null)}
        onConfirm={handleConfirmCancel}
      />

      <ReviewModal
        booking={reviewModalBooking}
        reviewForm={reviewForm}
        setReviewForm={setReviewForm}
        onClose={() => setReviewModalBooking(null)}
        onSubmit={handleSubmitReview}
      />
    </div>
  );
}