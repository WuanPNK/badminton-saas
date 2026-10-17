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

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-xl shadow-lg p-6 border border-slate-200">
        <h1 className="text-2xl font-bold text-center text-slate-800 mb-1">
          Badminton SaaS Portal
        </h1>
        <p className="text-xs text-center text-slate-500 mb-6">
          Hệ thống Quản lý Đặt lịch & Bán hàng POS Đa cụm sân
        </p>

        <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg mb-6 text-xs font-semibold">
          <button
            type="button"
            onClick={() => { setMode('LOGIN'); setOtpSent(false); setMessage({ type: '', text: '' }); }}
            className={`py-2 rounded-md transition ${mode === 'LOGIN' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'}`}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => { setMode('REGISTER_USER'); setOtpSent(false); setMessage({ type: '', text: '' }); }}
            className={`py-2 rounded-md transition ${mode === 'REGISTER_USER' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'}`}
          >
            ĐK Khách hàng
          </button>
          <button
            type="button"
            onClick={() => { setMode('REGISTER_TENANT'); setOtpSent(false); setMessage({ type: '', text: '' }); }}
            className={`py-2 rounded-md transition ${mode === 'REGISTER_TENANT' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'}`}
          >
            ĐK Chủ sân
          </button>
        </div>

        {message.text && (
          <div
            className={`p-3 rounded-lg text-xs mb-4 font-medium ${
              message.type === 'error'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {mode === 'LOGIN' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                name="email"
                required
                value={form.email}
                onChange={handleChange}
                placeholder="nhap@email.com"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mật khẩu</label>
              <input
                type="password"
                name="password"
                required
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg text-sm transition"
            >
              {loading ? 'Đang xử lý...' : 'Đăng nhập vào hệ thống'}
            </button>
          </form>
        )}

        {mode !== 'LOGIN' && (
          <form onSubmit={handleRegister} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Họ và tên đầy đủ</label>
              <input
                type="text"
                name="fullName"
                required
                value={form.fullName}
                onChange={handleChange}
                placeholder="Nguyễn Văn A"
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email (Nhận OTP)</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  placeholder="email@gmail.com"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Số điện thoại</label>
                <input
                  type="text"
                  name="phone"
                  required
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="0987654321"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mật khẩu</label>
              <input
                type="password"
                name="password"
                required
                value={form.password}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>

            {mode === 'REGISTER_USER' && (
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isStudent"
                    checked={form.isStudent}
                    onChange={handleChange}
                    className="rounded text-emerald-600"
                  />
                  <span>Tôi là Học sinh / Sinh viên (Nhận ưu đãi giảm giá tự động)</span>
                </label>

                {form.isStudent && (
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">
                      Link ảnh chụp Thẻ Học sinh / Sinh viên để Super Admin duyệt:
                    </label>
                    <input
                      type="text"
                      name="studentCardUrl"
                      required
                      value={form.studentCardUrl}
                      onChange={handleChange}
                      placeholder="https://i.imgur.com/the-sinh-vien.jpg"
                      className="w-full px-3 py-1.5 border rounded text-xs"
                    />
                  </div>
                )}
              </div>
            )}

            {mode === 'REGISTER_TENANT' && (
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 space-y-2">
                <p className="text-xs font-bold text-amber-800">
                  Thông tin Cụm sân đăng ký đối tác (Sẽ khóa tạm thời chờ Super Admin duyệt)
                </p>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tên Cụm sân</label>
                  <input
                    type="text"
                    name="tenantName"
                    required
                    value={form.tenantName}
                    onChange={handleChange}
                    placeholder="VD: Sân Cầu Lông Đông Đô"
                    className="w-full px-3 py-1.5 border rounded text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Quận / Khu vực</label>
                  <select
                    name="district"
                    value={form.district}
                    onChange={handleChange}
                    className="w-full px-3 py-1.5 border rounded text-xs bg-white"
                  >
                    <option value="Cầu Giấy">Quận Cầu Giấy</option>
                    <option value="Đống Đa">Quận Đống Đa</option>
                    <option value="Thanh Xuân">Quận Thanh Xuân</option>
                    <option value="Hai Bà Trưng">Quận Hai Bà Trưng</option>
                    <option value="Hoàng Mai">Quận Hoàng Mai</option>
                    <option value="Nam Từ Liêm">Quận Nam Từ Liêm</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Địa chỉ chi tiết</label>
                  <input
                    type="text"
                    name="address"
                    required
                    value={form.address}
                    onChange={handleChange}
                    placeholder="Số 102 Chùa Láng, Hà Nội"
                    className="w-full px-3 py-1.5 border rounded text-xs bg-white"
                  />
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-slate-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  name="otpCode"
                  required
                  value={form.otpCode}
                  onChange={handleChange}
                  placeholder="Nhập mã OTP 6 số..."
                  className="flex-1 px-3 py-2 border rounded-lg text-sm"
                />
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap"
                >
                  {otpSent ? 'Gửi lại OTP' : 'Lấy mã OTP'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !otpSent}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold py-2.5 rounded-lg text-sm transition"
            >
              {loading ? 'Đang xử lý...' : 'Xác nhận OTP & Hoàn tất Đăng ký'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}