import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';

export default function TenantPendingPage() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [tenantInfo, setTenantInfo] = useState(() => user?.tenantInfo || null);
  const [status, setStatus] = useState(() => user?.tenantStatus || 'PENDING');
  const [timeRemaining, setTimeRemaining] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
    percentElapsed: 0,
  });

  // Tính toán thời gian đếm ngược 7 ngày
  const updateCountdown = useCallback((createdAtStr) => {
    if (!createdAtStr) return;
    const createdTime = new Date(createdAtStr).getTime();
    const expireTime = createdTime + 7 * 24 * 60 * 60 * 1000;
    const totalDuration = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const diff = expireTime - now;

    if (diff <= 0) {
      setTimeRemaining({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: true,
        percentElapsed: 100,
      });
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const elapsed = now - createdTime;
    const percent = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

    setTimeRemaining({
      days,
      hours,
      minutes,
      seconds,
      isExpired: false,
      percentElapsed: percent,
    });
  }, []);

  // Gọi API kiểm tra trạng thái phê duyệt thực tế
  const checkStatus = useCallback(
    async (silent = false) => {
      if (!silent) setChecking(true);
      try {
        const res = await axiosClient.get('/tenant/pending-status');
        const data = res.data;

        if (data.tenant) {
          setTenantInfo(data.tenant);
          updateCountdown(data.tenant.createdAt);
        }

        if (data.status === 'ACTIVE') {
          setStatus('ACTIVE');
          updateUser({ tenantStatus: 'ACTIVE' });
          toast.success('🎉 Chúc mừng! Cụm sân của bạn đã được Super Admin phê duyệt!', {
            duration: 5000,
          });
          setTimeout(() => navigate('/tenant'), 1500);
          return;
        }

        if (data.status === 'REJECTED') {
          setStatus('REJECTED');
          if (!silent) {
            toast.error('Hồ sơ đăng ký cụm sân của bạn đã bị từ chối phê duyệt.', {
              duration: 5000,
            });
          }
          return;
        }

        if (data.status === 'EXPIRED') {
          setStatus('EXPIRED');
          toast.error('Hồ sơ đã quá hạn 7 ngày chưa được duyệt và đã tự động bị xóa.');
          setTimeout(() => {
            logout();
            navigate('/login');
          }, 3000);
          return;
        }

        if (!silent) {
          toast('Hồ sơ vẫn đang chờ Super Admin phê duyệt. Vui lòng kiên nhẫn!', {
            icon: '⏳',
          });
        }
      } catch (err) {
        if (err.response?.status === 403) {
          toast.error(err.response.data?.message || 'Hồ sơ đã hết hạn hoặc bị từ chối.');
        }
      } finally {
        setLoading(false);
        if (!silent) setChecking(false);
      }
    },
    [navigate, updateUser, logout, updateCountdown]
  );

  // Lần đầu tải trang: Lấy dữ liệu mới nhất
  useEffect(() => {
    checkStatus(true);
  }, [checkStatus]);

  // Cập nhật đồng hồ đếm ngược mỗi giây
  useEffect(() => {
    if (!tenantInfo?.createdAt) return;
    updateCountdown(tenantInfo.createdAt);

    const interval = setInterval(() => {
      updateCountdown(tenantInfo.createdAt);
    }, 1000);

    return () => clearInterval(interval);
  }, [tenantInfo?.createdAt, updateCountdown]);

  // Tự động kiểm tra trạng thái định kỳ mỗi 30 giây
  useEffect(() => {
    const pollInterval = setInterval(() => {
      checkStatus(true);
    }, 30000);

    return () => clearInterval(pollInterval);
  }, [checkStatus]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '--/--/----';
    const d = new Date(dateStr);
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const expireDateStr = tenantInfo?.createdAt
    ? new Date(new Date(tenantInfo.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleString(
        'vi-VN',
        {
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }
      )
    : '--/--/----';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900 flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden text-slate-100">
      {/* Hiệu ứng quầng sáng ambient background */}
      <div className="absolute top-1/4 -left-28 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-28 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* HEADER: THƯƠNG HIỆU & NÚT ĐĂNG XUẤT */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between pb-6 border-b border-white/10 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-xl shadow-lg shadow-emerald-500/20">
            🏸
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-wide text-white">BADMINTON SAAS</h1>
            <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
              Cổng Quản Trị Đối Tác Quản Lý Sân
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <div className="text-xs font-bold text-white">{user?.fullName || 'Chủ sân'}</div>
            <div className="text-[11px] text-slate-400">{user?.email}</div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-slate-200 hover:text-white transition active:scale-95 flex items-center gap-1.5"
          >
            <span>🚪</span>
            <span>Đăng xuất</span>
          </button>
        </div>
      </header>

      {/* CARD CHÍNH: GIAO DIỆN CHỜ DUYỆT */}
      <main className="max-w-3xl w-full mx-auto my-8 relative z-10">
        <div className="bg-white/[0.08] backdrop-blur-2xl rounded-3xl border border-white/15 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.6)] p-6 sm:p-10 relative overflow-hidden">
          
          {/* BADGE TRẠNG THÁI */}
          <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-black tracking-wide uppercase">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              <span>HỒ SƠ ĐANG CHỜ PHÊ DUYỆT</span>
            </div>

            <span className="text-xs text-slate-400 font-mono">
              Mã hồ sơ: #{tenantInfo?.id ? tenantInfo.id.slice(0, 8).toUpperCase() : 'PENDING'}
            </span>
          </div>

          {/* TIÊU ĐỀ */}
          <div className="mb-6">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Cụm sân <span className="text-emerald-400">{tenantInfo?.name || 'Của bạn'}</span> đang chờ duyệt
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
              Hồ sơ đăng ký đối tác quản lý sân của bạn đã được gửi thành công. Super Admin đang xem xét và xác minh thông tin địa điểm trước khi kích hoạt bảng điều khiển quản lý sân chính thức.
            </p>
          </div>

          {/* ĐỒNG HỒ ĐẾM NGƯỢC 7 NGÀY */}
          <div className="bg-slate-900/80 rounded-2xl border border-white/10 p-5 sm:p-6 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                <span className="text-base">⏳</span>
                <span>THỜI HẠN XÉT DUYỆT TỐI ĐA (7 NGÀY)</span>
              </div>
              <span className="text-[11px] text-slate-400">
                Hạn chót: <strong className="text-slate-200">{expireDateStr}</strong>
              </span>
            </div>

            {/* CÁC Ô ĐẾM NGƯỢC */}
            <div className="grid grid-cols-4 gap-2 sm:gap-3 text-center my-4">
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="font-mono text-2xl sm:text-3xl font-black text-emerald-400">
                  {String(timeRemaining.days).padStart(2, '0')}
                </div>
                <div className="text-[10px] sm:text-xs uppercase text-slate-400 font-bold mt-1">Ngày</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="font-mono text-2xl sm:text-3xl font-black text-emerald-400">
                  {String(timeRemaining.hours).padStart(2, '0')}
                </div>
                <div className="text-[10px] sm:text-xs uppercase text-slate-400 font-bold mt-1">Giờ</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="font-mono text-2xl sm:text-3xl font-black text-emerald-400">
                  {String(timeRemaining.minutes).padStart(2, '0')}
                </div>
                <div className="text-[10px] sm:text-xs uppercase text-slate-400 font-bold mt-1">Phút</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="font-mono text-2xl sm:text-3xl font-black text-emerald-400">
                  {String(timeRemaining.seconds).padStart(2, '0')}
                </div>
                <div className="text-[10px] sm:text-xs uppercase text-slate-400 font-bold mt-1">Giây</div>
              </div>
            </div>

            {/* THANH TIẾN ĐỘ THỜI GIAN */}
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                <span>Ngày gửi: {formatDate(tenantInfo?.createdAt)}</span>
                <span>{Math.round(timeRemaining.percentElapsed)}% thời hạn đã trôi qua</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden border border-white/10">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 transition-all duration-500"
                  style={{ width: `${timeRemaining.percentElapsed}%` }}
                />
              </div>
            </div>

            {/* CẢNH BÁO QUY ĐỊNH 7 NGÀY */}
            <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs flex items-start gap-2.5">
              <span className="text-base leading-none">⚠️</span>
              <p className="leading-relaxed">
                <strong>Quy định tự động xóa:</strong> Nếu sau <strong>7 ngày</strong> kể từ khi gửi hồ sơ mà chưa được Super Admin phê duyệt, tài khoản và thông tin cụm sân sẽ <strong>tự động bị hủy và xóa khỏi hệ thống</strong> để giải phóng dữ liệu.
              </p>
            </div>
          </div>

          {/* CHI TIẾT THÔNG TIN HỒ SƠ ĐÃ GỬI */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-5 mb-6">
            <h3 className="text-xs font-black uppercase text-emerald-400 tracking-wider mb-3 flex items-center gap-1.5">
              <span>📋</span>
              <span>Thông tin cụm sân đã đăng ký</span>
            </h3>

            <div className="grid sm:grid-cols-2 gap-3.5 text-xs">
              <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                <span className="text-slate-400 block text-[11px] mb-0.5">Tên Cụm sân:</span>
                <span className="font-bold text-white text-sm">{tenantInfo?.name || '---'}</span>
              </div>

              <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                <span className="text-slate-400 block text-[11px] mb-0.5">Quận / Khu vực:</span>
                <span className="font-bold text-white">{tenantInfo?.district || '---'}</span>
              </div>

              <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                <span className="text-slate-400 block text-[11px] mb-0.5">Địa chỉ chi tiết:</span>
                <span className="font-bold text-white">{tenantInfo?.address || '---'}</span>
              </div>

              <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                <span className="text-slate-400 block text-[11px] mb-0.5">Người đại diện & SĐT:</span>
                <span className="font-bold text-white">
                  {user?.fullName} ({tenantInfo?.phoneContact || user?.phone || '---'})
                </span>
              </div>
            </div>
          </div>

          {/* HÀNG NÚT THAO TÁC */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => checkStatus(false)}
              disabled={checking}
              className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60 text-white font-bold py-3.5 px-6 rounded-xl text-sm transition shadow-[0_4px_20px_rgba(16,185,129,0.35)] active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <span className={`text-base ${checking ? 'animate-spin' : ''}`}>🔄</span>
              <span>{checking ? 'Đang kiểm tra kết quả...' : 'Kiểm tra lại trạng thái duyệt'}</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="px-6 py-3.5 bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl text-sm font-bold text-slate-300 hover:text-white transition active:scale-[0.99]"
            >
              Đăng xuất
            </button>
          </div>

          {/* TRƯỜNG HỢP BỊ TỪ CHỐI */}
          {status === 'REJECTED' && (
            <div className="mt-5 p-4 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs space-y-2">
              <div className="font-bold text-sm flex items-center gap-2 text-red-300">
                <span>❌</span>
                <span>Hồ sơ đăng ký đã bị từ chối phê duyệt!</span>
              </div>
              <p>
                Rất tiếc, hồ sơ cụm sân của bạn không đạt yêu cầu xét duyệt của Super Admin. Vui lòng liên hệ bộ phận hỗ trợ hoặc đăng ký lại cụm sân mới.
              </p>
            </div>
          )}
        </div>

        {/* THÔNG TIN HỖ TRỢ / HOTLINE SUPER ADMIN */}
        <div className="mt-6 bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/10 p-4 text-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-300">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📞</span>
            <div>
              <span className="font-bold text-white">Cần duyệt hồ sơ gấp?</span>
              <span className="text-slate-400 block text-[11px]">
                Liên hệ Super Admin trong giờ làm việc (08:00 - 22:00)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono font-bold">
            <span className="text-emerald-400">Hotline: 0988.888.888</span>
            <span className="text-slate-500">|</span>
            <span className="text-emerald-400">admin@badminton-saas.com</span>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="max-w-4xl w-full mx-auto text-center pt-6 border-t border-white/10 text-[11px] text-slate-400 relative z-10">
        © 2026 Badminton SaaS Platform. Nền tảng Quản trị & Đặt lịch Cầu lông Đa cụm sân.
      </footer>
    </div>
  );
}
