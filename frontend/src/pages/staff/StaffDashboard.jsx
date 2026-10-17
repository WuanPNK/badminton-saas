import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';

export default function StaffDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState('OPERATIONS'); // 'OPERATIONS' | 'REFUNDS' | 'POS'
  const [tenant, setTenant] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [timeline, setTimeline] = useState({ courts: [], bookings: [] });
  const [refundRequests, setRefundRequests] = useState([]);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);

  // Form tạo Vé Vãng lai / Vé Sự kiện
  const [staffBooking, setStaffBooking] = useState({
    courtId: '',
    bookingType: 'WALK_IN',
    guestName: '',
    guestPhone: '',
    startTime: '17:00',
    endTime: '19:00',
    customPrice: '',
  });

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
        setStaffBooking((prev) => ({ ...prev, courtId: tlRes.data.courts[0].id }));
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

// eslint-disable-next-line
  useEffect(() => {
    // eslint-disable-next-line
    loadInitial();
  // eslint-disable-next-line
  }, [selectedDate]);
  // Lễ tân tạo Vé Vãng lai (WALK_IN) hoặc Vé Sự kiện (EVENT)
  const handleCreateStaffBooking = async (e) => {
    e.preventDefault();
    try {
      const startIso = `${selectedDate}T${staffBooking.startTime}:00`;
      const endIso = `${selectedDate}T${staffBooking.endTime}:00`;

      const res = await axiosClient.post('/bookings/staff-create', {
        courtId: staffBooking.courtId,
        bookingType: staffBooking.bookingType,
        guestName: staffBooking.guestName,
        guestPhone: staffBooking.guestPhone,
        bookingDate: selectedDate,
        startTime: startIso,
        endTime: endIso,
        customPrice: staffBooking.customPrice || undefined,
      });

      alert(res.data.message);
      setStaffBooking({ ...staffBooking, guestName: '', guestPhone: '', customPrice: '' });
      loadInitial();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi tạo vé.');
    }
  };

  // Lễ tân bấm Check-in hoặc Hoàn tất ca chơi (COMPLETE -> Mở khóa đánh giá sân cho khách)
  const handleOperation = async (bookingId, action) => {
    try {
      const res = await axiosClient.put(`/bookings/${bookingId}/operation`, { action });
      alert(res.data.message);
      loadInitial();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi thao tác.');
    }
  };

  // Lễ tân bấm "Đã hoàn tiền" sau khi chuyển khoản thủ công trên điện thoại
  const handleConfirmRefunded = async (bookingId) => {
    try {
      const res = await axiosClient.put(`/payments/${bookingId}/confirm-refund`);
      alert(res.data.message);
      loadInitial();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi xác nhận hoàn tiền.');
    }
  };

  // Thêm món vào giỏ POS & Thanh toán trừ kho
  const addToCart = (prod) => {
    setCart((prev) => {
      const found = prev.find((i) => i.productId === prod.id);
      if (found) {
        return prev.map((i) => (i.productId === prod.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { productId: prod.id, name: prod.name, price: prod.price, quantity: 1 }];
    });
  };

  const handleCheckoutPos = async () => {
    try {
      const res = await axiosClient.post('/pos/orders', {
        paymentMethod: 'CASH',
        items: cart.map((c) => ({ productId: c.productId, quantity: c.quantity })),
      });
      alert(res.data.message);
      setCart([]);
      loadInitial();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi thanh toán POS.');
    }
  };

  if (!tenant) return <div className="p-8 text-center text-sm">Đang tải màn hình Lễ tân...</div>;

  return (
    <div className="min-h-screen bg-slate-100 pb-12">
      <header className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold">Quầy Lễ Tân & POS — {tenant.name}</h1>
          <p className="text-xs text-slate-300">Nhân viên trực: {user?.fullName} ({user?.role})</p>
        </div>
        <div className="flex gap-3">
          {user?.role === 'TENANT_ADMIN' && (
            <button
              onClick={() => navigate('/tenant')}
              className="bg-emerald-600 px-3 py-1.5 rounded text-xs font-bold"
            >
              ← Về Quản trị Chủ sân
            </button>
          )}
          <button
            onClick={() => { logout(); navigate('/'); }}
            className="bg-red-600 px-3 py-1.5 rounded text-xs font-bold"
          >
            Đăng xuất
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 pt-6">
        <div className="flex gap-2 border-b pb-3">
          <button
            onClick={() => setTab('OPERATIONS')}
            className={`px-4 py-2 rounded-lg text-xs font-bold ${tab === 'OPERATIONS' ? 'bg-slate-900 text-white' : 'bg-white border'}`}
          >
            1. Trực Lịch Sân & Tạo Vé Vãng Lai / Sự Kiện
          </button>
          <button
            onClick={() => setTab('REFUNDS')}
            className={`px-4 py-2 rounded-lg text-xs font-bold ${tab === 'REFUNDS' ? 'bg-red-600 text-white' : 'bg-white border'}`}
          >
            2. Yêu cầu Hoàn tiền ({refundRequests.length})
          </button>
          {tenant.enable_pos_module && (
            <button
              onClick={() => setTab('POS')}
              className={`px-4 py-2 rounded-lg text-xs font-bold ${tab === 'POS' ? 'bg-emerald-700 text-white' : 'bg-white border'}`}
            >
              3. Bán Hàng POS Tại Quầy
            </button>
          )}
        </div>

        {/* TAB 1: TRỰC SÂN & TẠO VÉ VÃNG LAI / SỰ KIỆN */}
        {tab === 'OPERATIONS' && (
          <div className="grid lg:grid-cols-3 gap-6 py-6">
            {/* CỘT TRÁI: DANH SÁCH CA ĐẶT TRONG NGÀY */}
            <div className="lg:col-span-2 bg-white p-5 rounded-xl border space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="font-bold text-slate-800">Lịch đặt sân trong ngày</h2>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs"
                />
              </div>

              <div className="space-y-3">
                {timeline.bookings.map((b) => (
                  <div
                    key={b.id}
                    className="p-3 border rounded-lg bg-slate-50 flex flex-wrap justify-between items-center gap-3 text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900">#{b.booking_code}</span> — Loại vé:{' '}
                      <strong className="text-emerald-700">{b.booking_type}</strong> — Trạng thái:{' '}
                      <strong>{b.status}</strong>
                      <p className="text-slate-600 mt-1">
                        Khung giờ: {new Date(b.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} →{' '}
                        {new Date(b.end_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        {b.walk_in_guest_name && ` | Khách: ${b.walk_in_guest_name}`}
                      </p>
                    </div>
                    {b.status === 'CONFIRMED' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOperation(b.id, 'CHECK_IN')}
                          className="bg-blue-600 text-white px-3 py-1.5 rounded font-semibold"
                        >
                          Khách Check-in
                        </button>
                        <button
                          onClick={() => handleOperation(b.id, 'COMPLETE')}
                          className="bg-emerald-600 text-white px-3 py-1.5 rounded font-semibold"
                        >
                          ✓ Hoàn tất ca chơi (COMPLETED)
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {timeline.bookings.length === 0 && (
                  <p className="text-xs text-slate-500">Chưa có ca đặt sân nào trong ngày này.</p>
                )}
              </div>
            </div>

            {/* CỘT PHẢI: FORM TẠO VÉ VÃNG LAI / SỰ KIỆN */}
            <form
              onSubmit={handleCreateStaffBooking}
              className="bg-white p-5 rounded-xl border space-y-3"
            >
              <h2 className="font-bold text-slate-800">Tạo Vé Vãng Lai / Vé Sự Kiện</h2>
              <div>
                <label className="block text-xs font-semibold mb-1">Loại vé khởi tạo</label>
                <select
                  value={staffBooking.bookingType}
                  onChange={(e) => setStaffBooking({ ...staffBooking, bookingType: e.target.value })}
                  className="w-full px-3 py-2 border rounded text-xs"
                >
                  <option value="WALK_IN">Vé Vãng Lai (WALK_IN)</option>
                  <option value="EVENT">Vé Sự Kiện / Giải Đấu (EVENT)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Chọn Sân</label>
                <select
                  value={staffBooking.courtId}
                  onChange={(e) => setStaffBooking({ ...staffBooking, courtId: e.target.value })}
                  className="w-full px-3 py-2 border rounded text-xs"
                >
                  {timeline.courts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                required
                placeholder="Tên khách / Tên giải đấu sự kiện"
                value={staffBooking.guestName}
                onChange={(e) => setStaffBooking({ ...staffBooking, guestName: e.target.value })}
                className="w-full px-3 py-2 border rounded text-xs"
              />
              <input
                type="text"
                placeholder="Số điện thoại liên hệ"
                value={staffBooking.guestPhone}
                onChange={(e) => setStaffBooking({ ...staffBooking, guestPhone: e.target.value })}
                className="w-full px-3 py-2 border rounded text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="time"
                  step="1800"
                  value={staffBooking.startTime}
                  onChange={(e) => setStaffBooking({ ...staffBooking, startTime: e.target.value })}
                  className="px-3 py-2 border rounded text-xs"
                />
                <input
                  type="time"
                  step="1800"
                  value={staffBooking.endTime}
                  onChange={(e) => setStaffBooking({ ...staffBooking, endTime: e.target.value })}
                  className="px-3 py-2 border rounded text-xs"
                />
              </div>
              <input
                type="number"
                placeholder="Giá trọn gói (Để trống nếu tính tự động)"
                value={staffBooking.customPrice}
                onChange={(e) => setStaffBooking({ ...staffBooking, customPrice: e.target.value })}
                className="w-full px-3 py-2 border rounded text-xs"
              />
              <button className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2.5 rounded text-xs">
                + Khởi tạo Lịch Vãng Lai / Sự Kiện
              </button>
            </form>
          </div>
        )}

        {/* TAB 2: XỬ LÝ YÊU CẦU HOÀN TIỀN THỦ CÔNG (PENDING_REFUND -> REFUNDED) */}
        {tab === 'REFUNDS' && (
          <div className="py-6 bg-white p-5 rounded-xl border space-y-4">
            <h2 className="font-bold text-slate-800">
              Danh sách Khách hủy trước 24h chờ Hoàn tiền 100% (PENDING_REFUND)
            </h2>
            {refundRequests.length === 0 ? (
              <p className="text-xs text-slate-500">Hiện không có yêu cầu hoàn tiền nào.</p>
            ) : (
              refundRequests.map((r) => (
                <div
                  key={r.id}
                  className="p-4 border border-red-200 bg-red-50 rounded-xl flex flex-wrap justify-between items-center gap-4 text-xs"
                >
                  <div className="space-y-1">
                    <div className="font-bold text-sm text-red-900">
                      Đơn #{r.booking_code} — Khách: {r.customer_name} ({r.customer_phone})
                    </div>
                    <div>
                      Số tiền cần hoàn 100%: <strong className="text-red-700 text-sm">{Number(r.final_price).toLocaleString()}đ</strong>
                    </div>
                    <div className="bg-white p-2 rounded border border-red-200 font-semibold text-slate-800">
                      Ngân hàng nhận hoàn: {r.refund_bank_name} | STK: {r.refund_account_number} | Chủ TK: {r.refund_account_name}
                    </div>
                  </div>
                  <button
                    onClick={() => handleConfirmRefunded(r.id)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg font-bold"
                  >
                    ✓ Đã chuyển khoản hoàn tiền (Đổi sang REFUNDED)
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 3: BÁN HÀNG POS TẠI QUẦY */}
        {tab === 'POS' && tenant.enable_pos_module && (
          <div className="py-6 grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="bg-white p-4 rounded-xl border hover:border-emerald-600 text-left flex flex-col justify-between"
                >
                  <div>
                    <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-bold">{p.category}</span>
                    <h3 className="font-bold text-sm text-slate-800 mt-1">{p.name}</h3>
                  </div>
                  <div className="mt-3 flex justify-between items-center text-xs">
                    <strong className="text-emerald-700">{Number(p.price).toLocaleString()}đ</strong>
                    <span className="text-slate-500">Kho: {p.stock_quantity}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="bg-white p-5 rounded-xl border space-y-4">
              <h2 className="font-bold text-slate-800">Hóa đơn POS tại quầy</h2>
              <div className="space-y-2 text-xs">
                {cart.map((c) => (
                  <div key={c.productId} className="flex justify-between border-b pb-1">
                    <span>{c.name} x {c.quantity}</span>
                    <strong>{(c.price * c.quantity).toLocaleString()}đ</strong>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold text-sm pt-2 border-t">
                <span>Tổng cộng:</span>
                <span className="text-emerald-700">
                  {cart.reduce((sum, i) => sum + i.price * i.quantity, 0).toLocaleString()}đ
                </span>
              </div>
              <button
                onClick={handleCheckoutPos}
                disabled={cart.length === 0}
                className="w-full bg-emerald-600 disabled:bg-slate-300 text-white font-bold py-2.5 rounded-lg text-xs"
              >
                Thanh toán & Trừ Tồn Kho
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}