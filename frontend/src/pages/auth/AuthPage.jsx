import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState(() => {
    return searchParams.get('mode') === 'register' ? 'REGISTER_USER' : 'LOGIN';
  });
  const [showRegisterPopup, setShowRegisterPopup] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const { user, login } = useAuth();
  const navigate = useNavigate();

  // Bộ đếm ngược 60 giây cho việc gửi lại mã OTP
  useEffect(() => {
    let timer;
    if (otpCountdown > 0) {
      timer = setInterval(() => {
        setOtpCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [otpCountdown]);

  // Bắt tham số URL nếu phiên đăng nhập hết hạn (từ axios interceptor)
  useEffect(() => {
    if (searchParams.get('expired') === '1') {
      setMessage({
        type: 'error',
        text: 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.',
      });
    }
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      if (user.role === 'SUPER_ADMIN') navigate('/super-admin');
      else if (user.role === 'TENANT_ADMIN') navigate('/tenant');
      else if (user.role === 'STAFF') navigate('/staff');
      else navigate('/');
    }
  }, [user, navigate]);

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    otpCode: '',
    isStudent: false,
    studentCardImage: '',
    studentCardFileName: '',
    bankName: '',
    bankAccountNumber: '',
    bankAccountName: '',
    tenantName: '',
    district: 'Cầu Giấy',
    address: '',
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // Xử lý chọn file ảnh trực tiếp từ thiết bị
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      return setMessage({ type: 'error', text: 'Vui lòng chọn tệp định dạng hình ảnh (JPG, PNG, WEBP).' });
    }
    if (file.size > 5 * 1024 * 1024) {
      return setMessage({ type: 'error', text: 'Kích thước ảnh tối đa là 5MB.' });
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setForm((prev) => ({
        ...prev,
        studentCardImage: reader.result,
        studentCardFileName: file.name,
      }));
    };
    reader.readAsDataURL(file);
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setShowRegisterPopup(false);
    setOtpSent(false);
    setOtpCountdown(0);
    setMessage({ type: '', text: '' });
    setForm((prev) => ({
      ...prev,
      password: '',
      confirmPassword: '',
      otpCode: '',
    }));
  };

  // Gửi OTP (Dùng cho cả Đăng ký và Quên mật khẩu - duy nhất 1 email tài khoản)
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!form.email || !form.email.trim()) {
      return setMessage({ type: 'error', text: 'Vui lòng nhập địa chỉ Email để nhận mã OTP.' });
    }
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const purpose = mode === 'FORGOT_PASSWORD' ? 'RESET_PASSWORD' : 'REGISTER';
      const res = await axiosClient.post('/auth/send-otp', {
        email: form.email.trim(),
        purpose,
      });
      setOtpSent(true);
      setOtpCountdown(60); // Bắt đầu đếm ngược 60s
      setMessage({ type: 'success', text: res.data.message });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Không thể gửi OTP. Vui lòng kiểm tra lại.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Đăng ký tài khoản (Kiểm tra khớp mật khẩu & ảnh tải lên)
  const handleRegister = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) {
      return setMessage({ type: 'error', text: 'Mật khẩu phải có tối thiểu 6 ký tự.' });
    }
    if (form.password !== form.confirmPassword) {
      return setMessage({ type: 'error', text: 'Mật khẩu nhập lại không khớp. Vui lòng kiểm tra lại!' });
    }
    if (mode === 'REGISTER_USER' && form.isStudent && !form.studentCardImage) {
      return setMessage({ type: 'error', text: 'Vui lòng tải lên ảnh chụp Thẻ Học sinh / Sinh viên.' });
    }

    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const payload = {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        password: form.password,
        otpCode: form.otpCode,
        isTenantRegister: mode === 'REGISTER_TENANT',
        tenantName: form.tenantName,
        district: form.district,
        address: form.address,
        isStudent: mode === 'REGISTER_USER' ? form.isStudent : false,
        studentCardImage: form.studentCardImage,
        bankName: form.bankName || undefined,
        bankAccountNumber: form.bankAccountNumber || undefined,
        bankAccountName: form.bankAccountName || undefined,
      };

      const res = await axiosClient.post('/auth/register', payload);
      setMessage({ type: 'success', text: res.data.message });
      setOtpSent(false);
      setMode('LOGIN');
      setForm((prev) => ({ ...prev, password: '', confirmPassword: '', otpCode: '' }));
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Đăng ký thất bại.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Đặt lại mật khẩu bằng OTP
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) {
      return setMessage({ type: 'error', text: 'Mật khẩu mới phải có tối thiểu 6 ký tự.' });
    }
    if (form.password !== form.confirmPassword) {
      return setMessage({ type: 'error', text: 'Mật khẩu nhập lại không khớp!' });
    }

    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await axiosClient.post('/auth/reset-password', {
        email: form.email,
        otpCode: form.otpCode,
        newPassword: form.password,
      });
      setMessage({ type: 'success', text: res.data.message });
      setOtpSent(false);
      setMode('LOGIN');
      setForm((prev) => ({ ...prev, password: '', confirmPassword: '', otpCode: '' }));
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Không thể đặt lại mật khẩu.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Đăng nhập
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await axiosClient.post('/auth/login', {
        email: form.email,
        password: form.password,
      });

      const { token, user } = res.data;
      login(user, token);

      if (user.role === 'SUPER_ADMIN') navigate('/super-admin');
      else if (user.role === 'TENANT_ADMIN') navigate('/tenant');
      else if (user.role === 'STAFF') navigate('/staff');
      else navigate('/');
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Đăng nhập thất bại.',
      });
    } finally {
      setLoading(false);
    }
  };

  const isRegisterMode = mode === 'REGISTER_USER' || mode === 'REGISTER_TENANT';
  const passwordMismatch =
    form.confirmPassword.length > 0 && form.password !== form.confirmPassword;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900 flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden">
      {/* Hiệu ứng quầng sáng ambient background */}
      <div className="absolute top-1/4 -left-24 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-24 w-96 h-96 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* CARD TRUNG TÂM PHONG CÁCH GLASSMORPHISM CAO CẤP */}
      <div className="bg-white/95 backdrop-blur-2xl w-full max-w-xl rounded-3xl shadow-[0_25px_70px_-15px_rgba(0,0,0,0.4)] border border-white/50 p-6 sm:p-10 relative z-10">
        
        {/* NÚT QUAY LẠI TRANG CHỦ & BADGE THƯƠNG HIỆU */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-700 transition group"
          >
            <span className="group-hover:-translate-x-0.5 transition-transform font-mono">←</span>
            <span>Khám phá Sân</span>
          </button>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full">
            <span>🏸</span>
            <span>Badminton SaaS Portal</span>
          </span>
        </div>

        {/* TIÊU ĐỀ */}
        <div className="mb-6">
          <h2 className="text-2xl font-extrabold text-slate-900">
            {mode === 'LOGIN' && 'Chào mừng trở lại!'}
            {mode === 'REGISTER_USER' && 'Đăng ký Tài khoản Người chơi'}
            {mode === 'REGISTER_TENANT' && 'Đăng ký Đối tác Quản lý sân'}
            {mode === 'FORGOT_PASSWORD' && 'Khôi phục mật khẩu'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {mode === 'LOGIN' && 'Đăng nhập để vào bảng điều khiển tương ứng với vai trò của bạn.'}
            {mode === 'REGISTER_USER' && 'Xác thực email bằng OTP để đặt lịch sân và nhận ưu đãi Học sinh / Sinh viên.'}
            {mode === 'REGISTER_TENANT' && 'Đưa cụm sân cầu lông của bạn lên nền tảng và quản lý vận hành tự động.'}
            {mode === 'FORGOT_PASSWORD' && 'Nhập email của bạn để nhận mã OTP 6 số và thiết lập lại mật khẩu mới.'}
          </p>
        </div>

        {/* THANH CHUYỂN ĐỔI 2 CỘT: ĐĂNG NHẬP & ĐĂNG KÝ (CÓ POP-UP KHI DI CHUỘT) */}
        <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1.5 rounded-2xl mb-6 text-xs font-bold relative">
          {/* CỘT 1: ĐĂNG NHẬP */}
          <button
            type="button"
            onClick={() => switchMode('LOGIN')}
            className={`py-2.5 rounded-xl transition-all ${
              mode === 'LOGIN'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đăng nhập
          </button>

          {/* CỘT 2: ĐĂNG KÝ + HOVER POP-UP NHƯ ẢNH 5 */}
          <div
            className="relative"
            onMouseEnter={() => setShowRegisterPopup(true)}
            onMouseLeave={() => setShowRegisterPopup(false)}
          >
            <button
              type="button"
              onClick={() => setShowRegisterPopup((prev) => !prev)}
              className={`w-full py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                isRegisterMode
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>
                {mode === 'REGISTER_USER'
                  ? 'Đăng ký: Người chơi'
                  : mode === 'REGISTER_TENANT'
                  ? 'Đăng ký: Đối tác sân'
                  : 'Đăng ký'}
              </span>
              <svg
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  showRegisterPopup ? 'rotate-180' : ''
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* POP-UP MENU XỔ XUỐNG */}
            {showRegisterPopup && (
              <div className="absolute right-0 left-0 top-full pt-2 z-30">
                <div className="bg-white rounded-2xl shadow-[0_15px_40px_-10px_rgba(0,0,0,0.15)] border border-slate-100 p-2 space-y-1">
                  <button
                    type="button"
                    onClick={() => switchMode('REGISTER_USER')}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl transition flex items-start gap-3 ${
                      mode === 'REGISTER_USER'
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="text-base mt-0.5">🏸</span>
                    <div>
                      <div className="font-bold text-xs text-slate-900">Dành cho Người chơi</div>
                      <div className="text-[11px] font-normal text-slate-500">
                        Tìm kiếm & đặt lịch sân cầu lông
                      </div>
                    </div>
                  </button>

                  <div className="border-t border-slate-100 my-1"></div>

                  <button
                    type="button"
                    onClick={() => switchMode('REGISTER_TENANT')}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl transition flex items-start gap-3 ${
                      mode === 'REGISTER_TENANT'
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="text-base mt-0.5">🏟️</span>
                    <div>
                      <div className="font-bold text-xs text-slate-900">Đối tác Quản lý sân</div>
                      <div className="text-[11px] font-normal text-slate-500">
                        Đăng ký đưa cụm sân lên nền tảng
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* THÔNG BÁO LỖI / THÀNH CÔNG */}
        {message.text && (
          <div
            className={`p-3.5 rounded-2xl text-xs mb-5 font-semibold flex items-center gap-2.5 ${
              message.type === 'error'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            }`}
          >
            <span className="text-base">{message.type === 'error' ? '⚠️' : '✅'}</span>
            <span>{message.text}</span>
          </div>
        )}

        {/* ================= 1. FORM ĐĂNG NHẬP ================= */}
        {mode === 'LOGIN' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Địa chỉ Email</label>
              <input
                type="email"
                name="email"
                required
                value={form.email}
                onChange={handleChange}
                placeholder="nhap@email.com"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-slate-700">Mật khẩu</label>
                <button
                  type="button"
                  onClick={() => switchMode('FORGOT_PASSWORD')}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
                >
                  Quên mật khẩu?
                </button>
              </div>
              <input
                type="password"
                name="password"
                required
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:bg-slate-300 text-white font-bold py-3.5 rounded-xl text-sm transition shadow-[0_4px_16px_0_rgba(5,150,105,0.35)] active:scale-[0.99]"
            >
              {loading ? 'Đang xác thực...' : 'Đăng nhập vào hệ thống →'}
            </button>
          </form>
        )}

        {/* ================= 2. FORM ĐĂNG KÝ (NGƯỜI CHƠI & ĐỐI TÁC SÂN) ================= */}
        {isRegisterMode && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Họ và tên đầy đủ</label>
              <input
                type="text"
                name="fullName"
                required
                value={form.fullName}
                onChange={handleChange}
                placeholder="Nguyễn Văn A"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email (Nhận mã OTP)</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  placeholder="email@gmail.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Số điện thoại</label>
                <input
                  type="text"
                  name="phone"
                  required
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="0987654321"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* MẬT KHẨU KHỞI TẠO & NHẬP LẠI MẬT KHẨU */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mật khẩu khởi tạo</label>
                <input
                  type="password"
                  name="password"
                  required
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Tối thiểu 6 ký tự"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nhập lại mật khẩu</label>
                <input
                  type="password"
                  name="confirmPassword"
                  required
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="Nhập lại mật khẩu"
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 ${
                    passwordMismatch
                      ? 'border-red-400 focus:ring-red-500'
                      : 'border-slate-200 focus:ring-emerald-500'
                  }`}
                />
              </div>
            </div>
            {passwordMismatch && (
              <p className="text-[11px] text-red-600 font-semibold -mt-2">
                ⚠️ Mật khẩu nhập lại chưa khớp với mật khẩu khởi tạo.
              </p>
            )}

            {/* TÙY CHỌN THẺ SINH VIÊN: TẢI ẢNH TRỰC TIẾP TỪ MÁY */}
            {mode === 'REGISTER_USER' && (
              <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/80 space-y-3">
                <label className="flex items-center gap-2.5 text-xs font-bold text-emerald-950 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    name="isStudent"
                    checked={form.isStudent}
                    onChange={handleChange}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>🎓 Tôi là Học sinh / Sinh viên (Nhận ưu đãi giảm giá tự động)</span>
                </label>

                {form.isStudent && (
                  <div className="pt-1 space-y-2">
                    <label className="block text-[11px] font-semibold text-emerald-800">
                      Tải lên ảnh chụp Thẻ Học sinh / Sinh viên để Super Admin duyệt:
                    </label>

                    <label className="flex flex-col items-center justify-center w-full p-4 bg-white border-2 border-dashed border-emerald-300 rounded-xl cursor-pointer hover:bg-emerald-50/40 transition">
                      {form.studentCardImage ? (
                        <div className="text-center space-y-2">
                          <img
                            src={form.studentCardImage}
                            alt="Xem trước thẻ sinh viên"
                            className="max-h-36 mx-auto rounded-lg border border-slate-200 object-contain"
                          />
                          <p className="text-[11px] font-bold text-emerald-700">
                            ✓ {form.studentCardFileName} (Bấm để đổi ảnh khác)
                          </p>
                        </div>
                      ) : (
                        <div className="text-center py-2">
                          <span className="text-2xl">📷</span>
                          <p className="text-xs font-bold text-emerald-800 mt-1">
                            Bấm để chọn ảnh thẻ từ thiết bị
                          </p>
                          <p className="text-[11px] text-slate-400">Hỗ trợ PNG, JPG, WEBP (Tối đa 5MB)</p>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* THÔNG TIN TÀI KHOẢN NGÂN HÀNG (CHO KHÁCH HÀNG NHẬN HOÀN TIỀN 100%) */}
            {mode === 'REGISTER_USER' && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800">
                    <span>🏦</span>
                    <span>Tài khoản Ngân hàng nhận tiền hoàn (Tùy chọn)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Hệ thống sẽ chuyển tiền hoàn 100% về tài khoản này nếu bạn hủy lịch trước 24 tiếng.
                  </p>
                </div>

                <div className="grid sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Ngân hàng</label>
                    <input
                      type="text"
                      name="bankName"
                      value={form.bankName}
                      onChange={handleChange}
                      placeholder="VD: MB Bank, Techcombank..."
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Số tài khoản</label>
                    <input
                      type="text"
                      name="bankAccountNumber"
                      value={form.bankAccountNumber}
                      onChange={handleChange}
                      placeholder="VD: 19034889928282"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Chủ tài khoản</label>
                    <input
                      type="text"
                      name="bankAccountName"
                      value={form.bankAccountName}
                      onChange={handleChange}
                      placeholder="VD: NGUYEN VAN A"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs uppercase font-bold focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* THÔNG TIN ĐỐI TÁC QUẢN LÝ SÂN */}
            {mode === 'REGISTER_TENANT' && (
              <div className="bg-amber-50/80 p-4 rounded-2xl border border-amber-200 space-y-3">
                <div className="flex items-center gap-2 text-xs font-extrabold text-amber-900">
                  <span>🏟️</span>
                  <span>Thông tin Cụm sân đăng ký đối tác (Chờ Super Admin duyệt)</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Tên Cụm sân</label>
                    <input
                      type="text"
                      name="tenantName"
                      required
                      value={form.tenantName}
                      onChange={handleChange}
                      placeholder="VD: Sân Cầu Lông Đông Đô"
                      className="w-full px-3 py-2 border border-amber-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Quận / Khu vực</label>
                    <select
                      name="district"
                      value={form.district}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-amber-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="Cầu Giấy">Quận Cầu Giấy</option>
                      <option value="Đống Đa">Quận Đống Đa</option>
                      <option value="Thanh Xuân">Quận Thanh Xuân</option>
                      <option value="Hai Bà Trưng">Quận Hai Bà Trưng</option>
                      <option value="Hoàng Mai">Quận Hoàng Mai</option>
                      <option value="Nam Từ Liêm">Quận Nam Từ Liêm</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Địa chỉ chi tiết</label>
                  <input
                    type="text"
                    name="address"
                    required
                    value={form.address}
                    onChange={handleChange}
                    placeholder="Số 102 Chùa Láng, Hà Nội"
                    className="w-full px-3 py-2 border border-amber-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            )}

            {/* XÁC THỰC OTP */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Mã xác thực Email (OTP)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  name="otpCode"
                  required
                  value={form.otpCode}
                  onChange={handleChange}
                  placeholder="Nhập mã OTP 6 số..."
                  className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono tracking-widest focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading || otpCountdown > 0}
                  className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center justify-center min-w-[110px]"
                >
                  {loading
                    ? 'Đang gửi...'
                    : otpCountdown > 0
                    ? `Gửi lại (${otpCountdown}s)`
                    : otpSent
                    ? 'Gửi lại mã OTP'
                    : 'Nhận mã OTP'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !otpSent || passwordMismatch}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3.5 rounded-xl text-sm transition shadow-sm"
            >
              {loading ? 'Đang xử lý...' : 'Xác nhận OTP & Hoàn tất Đăng ký'}
            </button>
          </form>
        )}

        {/* ================= 3. FORM QUÊN MẬT KHẨU (RESET QUA OTP GMAIL) ================= */}
        {mode === 'FORGOT_PASSWORD' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Email tài khoản đã đăng ký
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  placeholder="nhap@gmail.com"
                  className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading || otpCountdown > 0}
                  className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center justify-center min-w-[110px]"
                >
                  {loading
                    ? 'Đang gửi...'
                    : otpCountdown > 0
                    ? `Gửi lại (${otpCountdown}s)`
                    : otpSent
                    ? 'Gửi lại mã OTP'
                    : 'Gửi mã OTP'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Mã xác thực OTP (Gửi về Gmail)
              </label>
              <input
                type="text"
                name="otpCode"
                required
                value={form.otpCode}
                onChange={handleChange}
                placeholder="Nhập 6 chữ số OTP..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono tracking-widest focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mật khẩu mới</label>
                <input
                  type="password"
                  name="password"
                  required
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Tối thiểu 6 ký tự"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nhập lại mật khẩu mới</label>
                <input
                  type="password"
                  name="confirmPassword"
                  required
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="Xác nhận mật khẩu"
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 ${
                    passwordMismatch
                      ? 'border-red-400 focus:ring-red-500'
                      : 'border-slate-200 focus:ring-emerald-500'
                  }`}
                />
              </div>
            </div>
            {passwordMismatch && (
              <p className="text-[11px] text-red-600 font-semibold -mt-2">
                ⚠️ Mật khẩu nhập lại chưa khớp.
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !otpSent || passwordMismatch}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3.5 rounded-xl text-sm transition shadow-sm"
            >
              {loading ? 'Đang cập nhật...' : 'Xác nhận Đặt lại Mật khẩu'}
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => switchMode('LOGIN')}
                className="text-xs font-bold text-slate-500 hover:text-slate-800"
              >
                ← Quay lại màn hình Đăng nhập
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}