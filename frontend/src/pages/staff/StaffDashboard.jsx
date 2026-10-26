import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';
import TimeSelect24 from '../../components/common/TimeSelect24';
import socket from '../../config/socket';

export default function StaffDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState('OPERATIONS');
  const [tenant, setTenant] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [timeline, setTimeline] = useState({ courts: [], bookings: [] });
  const [refundRequests, setRefundRequests] = useState([]);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);

  // Modal Quét / Nhập QR Check-in Nhanh (Đề xuất 4)
  const [showQuickCheckInModal, setShowQuickCheckInModal] = useState(false);
  const [qrInputCode, setQrInputCode] = useState('');
  const [quickCheckInLoading, setQuickCheckInLoading] = useState(false);
  const [lastCheckInResult, setLastCheckInResult] = useState(null);

  const [staffBooking, setStaffBooking] = useState({
    courtId: '',
    courtIds: [],
    bookingType: 'WALK_IN',
    guestName: '',
    guestPhone: '',
    startTime: '17:00',
    endTime: '19:00',
    customPrice: '',
  });

  const [posCourtId, setPosCourtId] = useState('');
  const [posNote, setPosNote] = useState('');


  const loadInitial = async () => {
    try {
      const setRes = await axiosClient.get('/tenant/my-settings');
      const t = setRes.data.tenant;
      setTenant(t);

      const tlRes = await axiosClient.get(`/bookings/timeline/${t.id}`, {
        params: { date: selectedDate },
      });
      setTimeline(tlRes.data);
      if (tlRes.data.courts.length > 0 && !staffBooking.courtId) {
        setStaffBooking((prev) => ({
          ...prev,
          courtId: tlRes.data.courts[0].id,
          courtIds: [tlRes.data.courts[0].id],
        }));
      }

      const refRes = await axiosClient.get('/payments/refund-requests');
      setRefundRequests(refRes.data.refundRequests || []);

      if (t.enable_pos_module) {
        const prodRes = await axiosClient.get('/pos/products');
        setProducts(prodRes.data.products || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadInitial();
  }, [selectedDate]);

  // Đề xuất 3: Đồng bộ trạng thái thời gian thực bằng Socket.io cho Lễ tân
  useEffect(() => {
    if (!tenant?.id) return;

    socket.emit('join_tenant', tenant.id);

    const handleBookingUpdate = (payload) => {
      loadInitial();

      if (payload.type === 'BOOKING_CONFIRMED') {
        toast.success(`Khách vừa thanh toán vé #${payload.booking?.booking_code || ''}!`, {
          icon: '🏸',
          duration: 4000,
        });
      } else if (payload.type === 'BOOKING_CREATED') {
        toast('Có khách đang đặt giữ chỗ trên ứng dụng.', {
          icon: '⏳',
          duration: 3000,
        });
      } else if (payload.type === 'BOOKING_CANCELLED') {
        toast('Một ca đặt sân đã được hủy / giải phóng chỗ.', {
          icon: 'ℹ️',
          duration: 3000,
        });
      } else if (payload.type === 'BOOKING_CHECKED_IN') {
        toast.success(`Check-in thành công: #${payload.booking?.booking_code || ''}`, {
          duration: 3000,
        });
      }
    };

    socket.on('booking_updated', handleBookingUpdate);

    return () => {
      socket.emit('leave_tenant', tenant.id);
      socket.off('booking_updated', handleBookingUpdate);
    };
  }, [tenant?.id, selectedDate]);

  // Đề xuất 4: Xử lý Check-in nhanh 1 giây qua mã QR hoặc mã vé
  const handleQuickCheckIn = async (e) => {
    if (e) e.preventDefault();
    if (!qrInputCode.trim()) {
      toast.error('Vui lòng nhập hoặc quét mã vé!');
      return;
    }

    setQuickCheckInLoading(true);
    try {
      const res = await axiosClient.post('/bookings/quick-check-in', {
        code: qrInputCode.trim(),
      });
      toast.success(res.data.message);
      setLastCheckInResult(res.data.booking);
      setQrInputCode('');
      loadInitial();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi thực hiện check-in nhanh.');
    } finally {
      setQuickCheckInLoading(false);
    }
  };


  const handleCreateStaffBooking = async (e) => {
    e.preventDefault();
    try {
      const startIso = `${selectedDate}T${staffBooking.startTime}:00`;
      const endIso = `${selectedDate}T${staffBooking.endTime}:00`;

      if (staffBooking.bookingType === 'EVENT' && (!staffBooking.courtIds || staffBooking.courtIds.length === 0)) {
        toast.error('Vui lòng chọn ít nhất 1 sân để tổ chức sự kiện!');
        return;
      }

      const res = await axiosClient.post('/bookings/staff-create', {
        courtId: staffBooking.courtId,
        courtIds: staffBooking.bookingType === 'EVENT' ? staffBooking.courtIds : undefined,
        bookingType: staffBooking.bookingType,
        guestName: staffBooking.guestName,
        guestPhone: staffBooking.guestPhone,
        bookingDate: selectedDate,
        startTime: startIso,
        endTime: endIso,
        customPrice: staffBooking.customPrice || undefined,
      });

      toast.success(res.data.message);
      setStaffBooking((prev) => ({
        ...prev,
        guestName: '',
        guestPhone: '',
        customPrice: '',
        courtIds: timeline.courts.length > 0 ? [timeline.courts[0].id] : [],
      }));
      loadInitial();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi tạo vé.');
    }
  };

  const handleOperation = async (bookingId, action) => {
    try {
      const res = await axiosClient.put(`/bookings/${bookingId}/operation`, { action });
      toast.success(res.data.message);
      loadInitial();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi thao tác.');
    }
  };

  const handleConfirmRefunded = async (bookingId) => {
    try {
      const res = await axiosClient.put(`/payments/${bookingId}/confirm-refund`);
      toast.success(res.data.message);
      loadInitial();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi xác nhận hoàn tiền.');
    }
  };

  const addToCart = (prod) => {
    setCart((prev) => {
      const found = prev.find((i) => i.productId === prod.id);
      if (found) {
        return prev.map((i) => (i.productId === prod.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { productId: prod.id, name: prod.name, price: prod.price, quantity: 1 }];
    });
  };

  const updateCartQty = (productId, delta) => {
    setCart((prev) =>
      prev
        .map((item) => (item.productId === productId ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  const handleCheckoutPos = async () => {
    if (cart.length === 0) return;
    try {
      const res = await axiosClient.post('/pos/orders', {
        courtId: posCourtId || null,
        note: posNote || null,
        paymentMethod: 'CASH',
        items: cart.map((c) => ({ productId: c.productId, quantity: c.quantity })),
      });
      toast.success(res.data.message);
      setCart([]);
      setPosNote('');
      loadInitial();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi thanh toán POS.');
    }
  };

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16">
      {/* HEADER QUẦY LỄ TÂN */}
      <header className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-slate-900 text-white px-6 py-4 shadow-md sticky top-0 z-40 border-b border-emerald-900/60">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight">Quầy Lễ Tân & POS — {tenant.name}</h1>
              <p className="text-xs text-emerald-200/80">
                Nhân viên ca trực: <strong className="text-white">{user?.fullName}</strong> ({user?.role})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {user?.role === 'TENANT_ADMIN' && (
              <button
                onClick={() => navigate('/tenant')}
                className="bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm active:scale-95"
              >
                ← Về Quản trị Chủ sân
              </button>
            )}
            <button
              onClick={() => { logout(); navigate('/'); }}
              className="bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        {/* TABS */}
        <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-100 mb-6">
          <button
            onClick={() => setTab('OPERATIONS')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition ${
              tab === 'OPERATIONS' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            📅 1. Trực Lịch Sân & Tạo Vé Vãng Lai / Sự Kiện
          </button>
          <button
            onClick={() => setTab('REFUNDS')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              tab === 'REFUNDS' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>↩ 2. Yêu cầu Hoàn tiền</span>
            {refundRequests.length > 0 && (
              <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[10px] font-extrabold">
                {refundRequests.length}
              </span>
            )}
          </button>
          {tenant.enable_pos_module && (
            <button
              onClick={() => setTab('POS')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition ${
                tab === 'POS' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              🛒 3. Bán Hàng POS Tại Quầy
            </button>
          )}
        </div>

        {/* TAB 1: TRỰC SÂN & TẠO VÉ */}
        {tab === 'OPERATIONS' && (
          <div className="grid lg:grid-cols-12 gap-6 items-start">
            {/* DANH SÁCH CA ĐẶT */}
            <div className="lg:col-span-8 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="font-extrabold text-slate-900 text-base">Danh sách ca chơi trong ngày</h2>
                  <p className="text-xs text-slate-500">Check-in khách đến sân và xác nhận hoàn tất ca chơi</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLastCheckInResult(null);
                      setShowQuickCheckInModal(true);
                    }}
                    className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 transition cursor-pointer"
                  >
                    <span className="text-sm">📷</span>
                    <span>Quét / Nhập QR Check-in (1s)</span>
                  </button>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>


              <div className="space-y-3">
                {timeline.bookings.map((b) => {
                  const courtObj = timeline.courts.find((c) => c.id === b.court_id);
                  const now = new Date();
                  const startTime = new Date(b.start_time);
                  const endTime = new Date(b.end_time);
                  const windowStart = new Date(startTime.getTime() - 15 * 60 * 1000); // 15 phút trước giờ chơi

                  const isCheckedIn = Boolean(b.is_checked_in || b.checked_in_at);
                  const isPastEndTime = now >= endTime;
                  const isCompleted = b.status === 'COMPLETED' || isPastEndTime;
                  const isWithinWindow = now >= windowStart && now <= endTime;
                  const isTooEarly = now < windowStart;

                  return (
                    <div
                      key={b.id}
                      className="p-4 border border-slate-100 rounded-2xl bg-slate-50/70 hover:bg-white hover:shadow-sm transition flex flex-wrap justify-between items-center gap-4 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-extrabold text-slate-900 bg-white border px-2 py-0.5 rounded">
                            #{b.booking_code}
                          </span>
                          <span className="font-bold text-slate-800">
                            {courtObj ? courtObj.name : 'Sân'}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                            b.booking_type === 'EVENT'
                              ? 'bg-purple-100 text-purple-800'
                              : b.booking_type === 'WALK_IN'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {b.booking_type}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                            isCompleted
                              ? 'bg-blue-100 text-blue-800'
                              : b.status === 'CONFIRMED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}>
                            {isCompleted ? 'COMPLETED' : b.status}
                          </span>
                        </div>
                        <p className="text-slate-600 font-medium pt-0.5">
                          🕒 {startTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })} →{' '}
                          {endTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })}
                          {b.walk_in_guest_name && <span className="ml-2 text-slate-800 font-semibold">• Khách: {b.walk_in_guest_name}</span>}
                        </p>
                      </div>

                      {/* CỘT THAO TÁC CHECK-IN (NÚT CHỈ HIỆN MÀU TỪ 15 PHÚT TRƯỚC GIỜ CHƠI ĐẾN HẾT GIỜ) */}
                      <div className="flex items-center gap-2">
                        {isCheckedIn ? (
                          <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 px-3.5 py-2 rounded-xl font-black flex items-center gap-1.5 shadow-sm text-xs">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            ✓ Đã Check-in ({new Date(b.checked_in_at || b.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })})
                          </span>
                        ) : isWithinWindow ? (
                          <button
                            onClick={() => handleOperation(b.id, 'CHECK_IN')}
                            className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-4 py-2 rounded-xl font-extrabold transition shadow-md flex items-center gap-1.5 text-xs animate-pulse"
                            title="Bấm để xác nhận khách đã đến sân check-in"
                          >
                            <span>📍</span>
                            <span>Khách Check-In</span>
                          </button>
                        ) : isTooEarly ? (
                          <div className="flex flex-col items-end">
                            <button
                              disabled
                              className="bg-slate-100 text-slate-400 border border-slate-200 px-3.5 py-2 rounded-xl font-bold text-xs cursor-not-allowed flex items-center gap-1.5 opacity-80"
                              title={`Chỉ mở check-in từ 15 phút trước giờ chơi (từ ${windowStart.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })})`}
                            >
                              <span>🔒</span>
                              <span>Khách Check-In</span>
                            </button>
                            <span className="text-[10px] text-slate-400 mt-0.5 font-medium">
                              Mở lúc {windowStart.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic bg-slate-100 px-2.5 py-1 rounded-lg">
                            Không check-in (Quá giờ)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {timeline.bookings.length === 0 && (
                  <div className="text-center py-10 text-slate-400 text-xs">
                    Chưa có ca đặt sân nào trong ngày {selectedDate}.
                  </div>
                )}
              </div>
            </div>

            {/* FORM TẠO VÉ VÃNG LAI / SỰ KIỆN */}
            <form
              onSubmit={handleCreateStaffBooking}
              className="lg:col-span-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4 lg:sticky lg:top-4"
            >
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                  Dành cho Lễ tân
                </span>
                <h2 className="font-extrabold text-slate-900 text-base mt-2">Tạo Vé Vãng Lai / Sự Kiện</h2>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Loại vé khởi tạo</label>
                <select
                  value={staffBooking.bookingType}
                  onChange={(e) => setStaffBooking({ ...staffBooking, bookingType: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                >
                  <option value="WALK_IN">🤝 Vé Vãng Lai (WALK_IN - 1 Sân)</option>
                  <option value="EVENT">🏆 Vé Sự Kiện / Giải Đấu (EVENT - Chọn nhiều sân)</option>
                </select>
              </div>

              {staffBooking.bookingType === 'EVENT' ? (
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      Chọn các Sân tổ chức Sự kiện:
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const allIds = timeline.courts.map((c) => c.id);
                        setStaffBooking((prev) => ({
                          ...prev,
                          courtIds: prev.courtIds?.length === allIds.length ? [] : allIds,
                        }));
                      }}
                      className="text-[11px] text-emerald-600 hover:underline font-bold"
                    >
                      {staffBooking.courtIds?.length === timeline.courts.length ? 'Bỏ chọn' : 'Chọn tất cả'}
                    </button>
                  </div>
                  <div className="space-y-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl max-h-48 overflow-y-auto">
                    {timeline.courts.map((c) => {
                      const isChecked = staffBooking.courtIds?.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition select-none ${
                            isChecked
                              ? 'bg-purple-50 border-purple-300 text-purple-900 font-bold'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked || false}
                            onChange={() => {
                              setStaffBooking((prev) => {
                                const exists = prev.courtIds?.includes(c.id);
                                const updated = exists
                                  ? prev.courtIds.filter((id) => id !== c.id)
                                  : [...(prev.courtIds || []), c.id];
                                return { ...prev, courtIds: updated };
                              });
                            }}
                            className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                          />
                          <span className="font-semibold">{c.name}</span>
                          <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded ml-auto text-slate-600">
                            {c.type}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-purple-700 font-semibold mt-1">
                    Đã chọn {staffBooking.courtIds?.length || 0}/{timeline.courts.length} sân
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Chọn Sân</label>
                  <select
                    value={staffBooking.courtId}
                    onChange={(e) => setStaffBooking({ ...staffBooking, courtId: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    {timeline.courts.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên khách / Tên giải đấu</label>
                <input
                  type="text"
                  required
                  placeholder="Nhập tên khách hoặc sự kiện..."
                  value={staffBooking.guestName}
                  onChange={(e) => setStaffBooking({ ...staffBooking, guestName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Số điện thoại liên hệ</label>
                <input
                  type="text"
                  placeholder="09xxx..."
                  value={staffBooking.guestPhone}
                  onChange={(e) => setStaffBooking({ ...staffBooking, guestPhone: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Giờ bắt đầu (24h)</label>
                  <TimeSelect24
                    value={staffBooking.startTime}
                    onChange={(e) => setStaffBooking({ ...staffBooking, startTime: e.target.value })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Giờ kết thúc (24h)</label>
                  <TimeSelect24
                    value={staffBooking.endTime}
                    onChange={(e) => setStaffBooking({ ...staffBooking, endTime: e.target.value })}
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Giá thỏa thuận (Để trống = Tính tự động)</label>
                <input
                  type="number"
                  placeholder="VD: 200000"
                  value={staffBooking.customPrice}
                  onChange={(e) => setStaffBooking({ ...staffBooking, customPrice: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <button className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold py-3 rounded-xl text-xs transition shadow-sm">
                + Khởi tạo Lịch Trực Tiếp
              </button>
            </form>
          </div>
        )}

        {/* TAB 2: HOÀN TIỀN */}
        {tab === 'REFUNDS' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
            <div>
              <h2 className="font-extrabold text-slate-900 text-base">
                Danh sách Khách hủy trước 24h chờ Hoàn tiền 100%
              </h2>
              <p className="text-xs text-slate-500">
                Lễ tân chuyển khoản theo thông tin ngân hàng bên dưới rồi bấm xác nhận hoàn tất.
              </p>
            </div>

            {refundRequests.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-400">
                🎉 Hiện không có yêu cầu hoàn tiền nào tồn đọng.
              </div>
            ) : (
              <div className="space-y-3">
                {refundRequests.map((r) => (
                  <div
                    key={r.id}
                    className="p-5 border border-red-200/80 bg-red-50/40 rounded-2xl flex flex-wrap justify-between items-center gap-4 text-xs"
                  >
                    <div className="space-y-1.5">
                      <div className="font-extrabold text-sm text-slate-900">
                        Đơn #{r.booking_code} — Khách: {r.customer_name} ({r.customer_phone})
                      </div>
                      <div className="text-slate-600">
                        Số tiền cần hoàn 100%: <strong className="text-red-600 text-base font-black">{Number(r.final_price).toLocaleString()} ₫</strong>
                      </div>
                      <div className="bg-white px-3.5 py-2 rounded-xl border border-red-200 font-bold text-slate-800 inline-block">
                        🏦 {r.refund_bank_name} • STK: <span className="font-mono text-emerald-700 select-all">{r.refund_account_number}</span> • Chủ TK: {r.refund_account_name}
                      </div>
                    </div>
                    <button
                      onClick={() => handleConfirmRefunded(r.id)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-bold transition shadow-sm"
                    >
                      ✓ Xác nhận Đã chuyển khoản hoàn tiền
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: BÁN HÀNG POS */}
        {tab === 'POS' && tenant.enable_pos_module && (
          <div className="grid lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-4">
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={p.stock_quantity <= 0}
                  className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:border-emerald-500 disabled:opacity-50 text-left flex flex-col justify-between transition group"
                >
                  <div>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-extrabold">
                      {p.category === 'DRINK' ? '🥤 NƯỚC UỐNG' : p.category === 'SHUTTLECOCK' ? '🏸 CẦU LÔNG' : '🎾 THUÊ VỢT'}
                    </span>
                    <h3 className="font-extrabold text-sm text-slate-900 mt-2.5 group-hover:text-emerald-700 transition">
                      {p.name}
                    </h3>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                    <strong className="text-emerald-700 text-sm font-black">{Number(p.price).toLocaleString()} ₫</strong>
                    <span className="text-slate-400 font-medium">Kho: {p.stock_quantity}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="lg:col-span-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4 lg:sticky lg:top-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h2 className="font-extrabold text-slate-900 text-base">Hóa đơn POS tại quầy</h2>
                {cart.length > 0 && (
                  <button onClick={() => setCart([])} className="text-[11px] text-red-500 font-bold hover:underline">
                    Xóa giỏ
                  </button>
                )}
              </div>

              <div className="space-y-2.5 text-xs max-h-72 overflow-y-auto">
                {cart.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">Bấm vào sản phẩm bên trái để thêm vào hóa đơn.</p>
                ) : (
                  cart.map((c) => (
                    <div key={c.productId} className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl">
                      <div>
                        <p className="font-bold text-slate-800">{c.name}</p>
                        <p className="text-slate-400">{Number(c.price).toLocaleString()} ₫ / món</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateCartQty(c.productId, -1)}
                          className="w-6 h-6 rounded-lg bg-white border font-bold text-slate-600 hover:bg-slate-100"
                        >
                          -
                        </button>
                        <span className="font-extrabold w-5 text-center">{c.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(c.productId, 1)}
                          className="w-6 h-6 rounded-lg bg-white border font-bold text-slate-600 hover:bg-slate-100"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2.5 pt-1 pb-2 border-b border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    🏟️ Sân đang gọi đồ / Thanh toán:
                  </label>
                  <select
                    value={posCourtId}
                    onChange={(e) => setPosCourtId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Khách Vãng Lai / Mang Về (Không gắn sân)</option>
                    {timeline.courts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.type})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Ghi chú hóa đơn (Tên khách / SĐT)..."
                    value={posNote}
                    onChange={(e) => setPosNote(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-between items-end pt-3 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-400 uppercase">Tổng cộng</span>
                <span className="text-2xl font-black text-emerald-700">
                  {cart.reduce((sum, i) => sum + i.price * i.quantity, 0).toLocaleString()} ₫
                </span>
              </div>

              <button
                onClick={handleCheckoutPos}
                disabled={cart.length === 0}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3.5 rounded-xl text-xs transition shadow-sm"
              >
                Thanh toán & Trừ Tồn Kho
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL QUÉT / NHẬP MÃ QR CHECK-IN NHANH 1 GIÂY (ĐỀ XUẤT 4) */}
      {showQuickCheckInModal && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center text-xl shadow-lg shadow-emerald-500/25">
                  📷
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    Quét / Nhập QR Check-in Nhanh
                  </h3>
                  <p className="text-xs text-slate-500">
                    Khách giơ mã QR trong Email hoặc đọc mã vé
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickCheckInModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm transition"
              >
                ✕
              </button>
            </div>

            {/* Thông báo kết quả check-in gần nhất */}
            {lastCheckInResult && (
              <div className="p-4 bg-emerald-50 border-2 border-emerald-400 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 font-black text-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                  ✓ Check-in Thành Công!
                </div>
                <div className="text-xs text-slate-700 grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Mã vé:</span>
                    <strong className="font-mono text-slate-900">#{lastCheckInResult.booking_code}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Sân thi đấu:</span>
                    <strong className="text-emerald-700">{lastCheckInResult.court_name || 'Sân tiêu chuẩn'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Khách hàng:</span>
                    <strong className="text-slate-800">{lastCheckInResult.customer_name || 'Khách vãng lai'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Giờ vào:</span>
                    <strong className="text-slate-800">{new Date(lastCheckInResult.checked_in_at || new Date()).toLocaleTimeString('vi-VN')}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Form nhập / quét mã */}
            <form onSubmit={handleQuickCheckIn} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Mã QR Hoặc Mã Đơn Đặt Sân
                </label>
                <div className="relative">
                  <input
                    type="text"
                    autoFocus
                    placeholder="VD: DS123456 hoặc dùng máy quét QR bắn vào đây..."
                    value={qrInputCode}
                    onChange={(e) => setQrInputCode(e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 focus:border-emerald-500 focus:bg-white rounded-2xl text-sm font-mono font-bold text-slate-900 tracking-wider placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition"
                  />
                  {qrInputCode && (
                    <button
                      type="button"
                      onClick={() => setQrInputCode('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs px-2 py-1"
                    >
                      Xóa
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                  💡 Hỗ trợ: Máy quét mã vạch/QR (tự động Enter), dán mã chuỗi <code className="bg-slate-100 px-1 py-0.5 rounded text-emerald-700">CHECKIN:...</code> hoặc gõ 6 chữ số mã vé.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickCheckInModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-xs transition"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={quickCheckInLoading || !qrInputCode.trim()}
                  className="flex-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-extrabold py-3 px-5 rounded-xl text-xs shadow-md shadow-emerald-500/25 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {quickCheckInLoading ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <span>⚡</span>
                      <span>Xác nhận Check-in (1s)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}