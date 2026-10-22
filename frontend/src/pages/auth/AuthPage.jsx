import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';

export default function AuthPage() {
  const [mode, setMode] = useState('LOGIN');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    otpCode: '',
    isStudent: false,
    studentCardUrl: '',
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

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!form.email) {
      return setMessage({ type: 'error', text: 'Vui lòng nhập Email để nhận mã OTP.' });
    }
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await axiosClient.post('/auth/send-otp', {
        email: form.email,
        purpose: 'REGISTER',
      });
      setOtpSent(true);
      setMessage({ type: 'success', text: res.data.message });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Không thể gửi OTP. Kiểm tra cấu hình Gmail Backend.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
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
        studentCardUrl: form.studentCardUrl,
      };

      const res = await axiosClient.post('/auth/register', payload);
      setMessage({ type: 'success', text: res.data.message });
      setOtpSent(false);
      setMode('LOGIN');
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Đăng ký thất bại.',
      });
    } finally {
      setLoading(false);
    }
  };

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
      else navigate('/marketplace');
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Đăng nhập thất bại.',
      });
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setOtpSent(false);
    setMessage({ type: '', text: '' });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 md:p-8">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden grid lg:grid-cols-12">
        
        {/* CỘT TRÁI: BANNER GIỚI THIỆU HỆ THỐNG */}
        <div className="lg:col-span-5 bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900 text-white p-8 md:p-10 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-teal-400/20 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide text-emerald-300 border border-white/10 mb-6">
              <span>🏸</span> BADMINTON SAAS PLATFORM
            </div>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight">
              Đặt Sân Trực Quan & Quản Trị Đa Cụm Sân
            </h1>
            <p className="text-sm text-emerald-100/80 mt-3 leading-relaxed">
              Nền tảng kết nối người chơi cầu lông và chủ sân với hệ thống tính giá động theo khung giờ, thanh toán VietQR tự động và quản lý bán hàng POS.
            </p>
          </div>

          <div className="relative z-10 space-y-3 mt-8 pt-8 border-t border-white/10 text-xs text-emerald-100/90">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center font-bold text-emerald-300">✓</span>
              <span>Đặt lịch chẵn block 30 phút, giữ chỗ tức thì</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center font-bold text-emerald-300">🎓</span>
              <span>Tự động áp dụng chiết khấu cho Học sinh / Sinh viên</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center font-bold text-emerald-300">⚡</span>
              <span>Tích hợp POS bán hàng tại quầy & Báo cáo chuyên sâu</span>
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: FORM ĐĂNG NHẬP / ĐĂNG KÝ */}
        <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center">
          <div className="mb-6">
            <h2 className="text-2xl font-extrabold text-slate-900">
              {mode === 'LOGIN' && 'Chào mừng trở lại!'}
              {mode === 'REGISTER_USER' && 'Tạo tài khoản Người chơi'}
              {mode === 'REGISTER_TENANT' && 'Đăng ký Đối tác Chủ sân'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {mode === 'LOGIN' && 'Đăng nhập để vào bảng điều khiển tương ứng với vai trò của bạn.'}
              {mode === 'REGISTER_USER' && 'Xác thực email bằng OTP để đặt sân và nhận ưu đãi Sinh viên.'}
              {mode === 'REGISTER_TENANT' && 'Đưa cụm sân của bạn lên nền tảng và quản lý vận hành tự động.'}
            </p>
          </div>

          {/* THANH CHUYỂN CHẾ ĐỘ */}
          <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1.5 rounded-2xl mb-6 text-xs font-bold">
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
            <button
              type="button"
              onClick={() => switchMode('REGISTER_USER')}
              className={`py-2.5 rounded-xl transition-all ${
                mode === 'REGISTER_USER'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ĐK Khách hàng
            </button>
            <button
              type="button"
              onClick={() => switchMode('REGISTER_TENANT')}
              className={`py-2.5 rounded-xl transition-all ${
                mode === 'REGISTER_TENANT'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ĐK Chủ sân
            </button>
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

          {/* FORM ĐĂNG NHẬP */}
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
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Mật khẩu</label>
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
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold py-3.5 rounded-xl text-sm transition shadow-[0_4px_14px_0_rgba(5,150,105,0.35)] active:scale-[0.99]"
              >
                {loading ? 'Đang xác thực...' : 'Đăng nhập vào hệ thống →'}
              </button>
            </form>
          )}

          {/* FORM ĐĂNG KÝ (KHÁCH HÀNG HOẶC CHỦ SÂN) */}
          {mode !== 'LOGIN' && (
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

              {/* TÙY CHỌN THẺ SINH VIÊN */}
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
                    <div className="pt-1">
                      <label className="block text-[11px] font-semibold text-emerald-800 mb-1">
                        Dán link ảnh chụp Thẻ Học sinh / Sinh viên để Super Admin duyệt:
                      </label>
                      <input
                        type="text"
                        name="studentCardUrl"
                        required
                        value={form.studentCardUrl}
                        onChange={handleChange}
                        placeholder="https://i.imgur.com/the-sinh-vien.jpg"
                        className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* THÔNG TIN ĐỐI TÁC CHỦ SÂN */}
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
                    disabled={loading}
                    className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition"
                  >
                    {otpSent ? 'Gửi lại OTP' : 'Nhận mã OTP'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !otpSent}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3.5 rounded-xl text-sm transition shadow-sm"
              >
                {loading ? 'Đang xử lý...' : 'Xác nhận OTP & Hoàn tất Đăng ký'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}