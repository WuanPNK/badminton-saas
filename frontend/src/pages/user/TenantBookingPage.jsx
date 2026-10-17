import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';

const TIME_SLOTS = [
  '05:00', '05:30', '06:00', '06:30', '07:00', '07:30', '08:00', '08:30',
  '09:00', '09:30', '10:00', '10:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
  '20:00', '20:30', '21:00', '21:30', '22:00'
];

export default function TenantBookingPage() {
  const { id: tenantId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tenantDetail, setTenantDetail] = useState(null);
  const [bookingMode, setBookingMode] = useState('VISUAL'); // 'VISUAL' | 'WALK_IN' | 'EVENT'
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date(Date.now() + 86400000);
    return tomorrow.toISOString().split('T')[0];
  });

  const [timeline, setTimeline] = useState({ courts: [], bookings: [] });
  const [selectedCourtId, setSelectedCourtId] = useState('');
  const [startSlot, setStartSlot] = useState('17:00');
  const [endSlot, setEndSlot] = useState('18:30');
  const [pricePreview, setPricePreview] = useState(null);

  // State cho màn hình Mô phỏng Thanh toán 100% VietQR
  const [paymentData, setPaymentData] = useState(null);

  useEffect(() => {
    axiosClient.get(`/tenant/marketplace/${tenantId}`).then((res) => {
      setTenantDetail(res.data.data);
      if (res.data.data.courts.length > 0) {
        setSelectedCourtId(res.data.data.courts[0].id);
      }
    });
  }, [tenantId]);

  const fetchTimeline = async () => {
    try {
      const res = await axiosClient.get(`/bookings/timeline/${tenantId}`, {
        params: { date: selectedDate },
      });
      setTimeline(res.data);
    } catch (err) {
      console.error(err);
    }
  };
useEffect(() => {
    // eslint-disable-next-line
    fetchTimeline();
  }, [tenantId, selectedDate]);
  // Tự động tính giá ngay khi khách đổi sân hoặc đổi khung giờ 30 phút (Tự động áp giá HSSV)
  useEffect(() => {
    if (!selectedCourtId || !selectedDate || !startSlot || !endSlot) return;
    const startIso = `${selectedDate}T${startSlot}:00`;
    const endIso = `${selectedDate}T${endSlot}:00`;

    axiosClient
      .post('/bookings/preview-price', {
        tenantId,
        courtId: selectedCourtId,
        startTime: startIso,
        endTime: endIso,
      })
      .then((res) => setPricePreview(res.data))
      .catch(() => setPricePreview(null));
  }, [tenantId, selectedCourtId, selectedDate, startSlot, endSlot]);

  // Tạo đơn đặt sân trực quan & Mở màn hình VietQR
  const handleCreateVisualBooking = async () => {
    try {
      const startIso = `${selectedDate}T${startSlot}:00`;
      const endIso = `${selectedDate}T${endSlot}:00`;

      const res = await axiosClient.post('/bookings/visual', {
        tenantId,
        courtId: selectedCourtId,
        bookingDate: selectedDate,
        startTime: startIso,
        endTime: endIso,
      });

      const bookingId = res.data.booking.id;
      const qrRes = await axiosClient.get(`/payments/${bookingId}/info`);
      setPaymentData(qrRes.data.paymentData);
      fetchTimeline();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi đặt lịch.');
    }
  };

  // Bấm nút Mô phỏng Đã chuyển khoản 100%
  const handleMockConfirmPayment = async () => {
    try {
      const res = await axiosClient.put(`/payments/${paymentData.bookingId}/pay-mock`);
      alert(res.data.message);
      setPaymentData(null);
      navigate('/marketplace');
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi xác nhận thanh toán.');
    }
  };

  if (!tenantDetail) return <div className="p-8 text-center text-sm">Đang tải dữ liệu sân...</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* HEADER */}
      <div className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <div>
          <button
            onClick={() => navigate('/marketplace')}
            className="text-xs text-emerald-700 font-semibold mb-1"
          >
            ← Quay lại danh sách Cụm sân
          </button>
          <h1 className="text-xl font-bold text-slate-800">{tenantDetail.tenant.name}</h1>
          <p className="text-xs text-slate-500">{tenantDetail.tenant.address}</p>
        </div>

        <div className="text-right">
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
            {user?.studentStatus === 'VERIFIED'
              ? '🎓 Giá hiển thị đã tự động áp dụng Ưu đãi Sinh viên'
              : 'Tài khoản Khách thường'}
          </span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pt-6 space-y-6">
        {/* CHỌN LOẠI HÌNH ĐẶT VÉ: TRỰC QUAN / VÉ VÃNG LAI / VÉ SỰ KIỆN */}
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-xs font-bold text-slate-600 mb-3">
            CHỌN HÌNH THỨC ĐĂNG KÝ TẠI CỤM SÂN:
          </p>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setBookingMode('VISUAL')}
              className={`p-3 rounded-lg border text-left transition ${
                bookingMode === 'VISUAL'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                  : 'border-slate-200'
              }`}
            >
              <div className="font-bold text-sm">1. Đặt theo sân - Trực quan</div>
              <div className="text-xs text-slate-500">Chọn khung giờ 30 phút & Thanh toán 100% online</div>
            </button>

            <button
              onClick={() => setBookingMode('WALK_IN')}
              className={`p-3 rounded-lg border text-left transition ${
                bookingMode === 'WALK_IN'
                  ? 'border-amber-600 bg-amber-50 text-amber-900'
                  : 'border-slate-200'
              }`}
            >
              <div className="font-bold text-sm">2. Mua vé Vãng lai (Ghép sân)</div>
              <div className="text-xs text-slate-500">Liên hệ Lễ tân/Chủ sân tạo vé trực tiếp</div>
            </button>

            <button
              onClick={() => setBookingMode('EVENT')}
              className={`p-3 rounded-lg border text-left transition ${
                bookingMode === 'EVENT'
                  ? 'border-amber-600 bg-amber-50 text-amber-900'
                  : 'border-slate-200'
              }`}
            >
              <div className="font-bold text-sm">3. Đăng ký Vé Sự kiện / Giải đấu</div>
              <div className="text-xs text-slate-500">Liên hệ Chủ sân khóa sân & tạo sự kiện</div>
            </button>
          </div>
        </div>

        {/* NẾU KHÁCH BẤM VÀO VÉ VÃNG LAI HOẶC VÉ SỰ KIỆN */}
        {bookingMode !== 'VISUAL' && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-6 text-center space-y-2">
            <h3 className="text-base font-bold text-amber-900">
              Hướng dẫn đăng ký {bookingMode === 'WALK_IN' ? 'Vé Vãng Lai' : 'Sân Sự Kiện'}
            </h3>
            <p className="text-sm text-amber-800">
              Để đảm bảo sắp xếp trình độ ghép sân vãng lai hoặc bố trí trọng tài/sân bãi cho sự kiện,
              quý khách vui lòng gọi trực tiếp tới Hotline của cụm sân:
            </p>
            <p className="text-2xl font-extrabold text-emerald-700">
              📞 {tenantDetail.tenant.phone_contact}
            </p>
            <p className="text-xs text-slate-600">
              Chủ sân hoặc Lễ tân sẽ khởi tạo lịch {bookingMode === 'WALK_IN' ? 'Vãng lai' : 'Sự kiện'} trực tiếp trên bảng điều khiển của sân.
            </p>
          </div>
        )}

        {/* NẾU KHÁCH ĐẶT TRỰC QUAN ONLINE */}
        {bookingMode === 'VISUAL' && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* CỘT TRÁI: LƯỚI TIMELINE CÁC CA ĐÃ ĐẶT TRONG NGÀY */}
            <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="font-bold text-slate-800">Lịch trạng thái các sân trong ngày</h2>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 border rounded-lg text-sm"
                />
              </div>

              <div className="space-y-3">
                {timeline.courts.map((c) => {
                  const courtBookings = timeline.bookings.filter((b) => b.court_id === c.id);
                  return (
                    <div key={c.id} className="p-3 border rounded-lg bg-slate-50">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-sm text-slate-800">
                          {c.name} ({c.type})
                        </span>
                        {c.is_under_maintenance && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-semibold">
                            Đang bảo trì
                          </span>
                        )}
                      </div>
                      {courtBookings.length === 0 ? (
                        <p className="text-xs text-emerald-700 font-medium">
                          ✓ Trống toàn bộ các khung giờ trong ngày
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {courtBookings.map((b) => (
                            <span
                              key={b.id}
                              className="text-xs bg-red-100 text-red-800 border border-red-200 px-2.5 py-1 rounded font-semibold"
                            >
                              Đã kín: {new Date(b.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} -{' '}
                              {new Date(b.end_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ({b.booking_type})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CỘT PHẢI: CHỌN BLOCK 30 PHÚT & TỰ ĐỘNG HIỂN THỊ GIÁ ĐÃ TRỪ ƯU ĐÃI HSSV */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
              <h2 className="font-bold text-slate-800">Chọn Sân & Khung giờ (Block 30p)</h2>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Chọn Sân</label>
                <select
                  value={selectedCourtId}
                  onChange={(e) => setSelectedCourtId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  {timeline.courts.map((c) => (
                    <option key={c.id} value={c.id} disabled={c.is_under_maintenance}>
                      {c.name} - Sân {c.type} {c.is_under_maintenance ? '(Bảo trì)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Giờ bắt đầu (Chẵn 30p)
                  </label>
                  <select
                    value={startSlot}
                    onChange={(e) => setStartSlot(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    {TIME_SLOTS.map((slot) => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Giờ kết thúc (Chẵn 30p)
                  </label>
                  <select
                    value={endSlot}
                    onChange={(e) => setEndSlot(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    {TIME_SLOTS.map((slot) => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* BẢNG TÍNH TIỀN TỰ ĐỘNG */}
              {pricePreview ? (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span>Thời lượng đặt:</span>
                    <strong>{pricePreview.totalHours} giờ</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Giá gốc theo khung giờ động:</span>
                    <span>{Number(pricePreview.originalPrice).toLocaleString()}đ</span>
                  </div>
                  {pricePreview.isStudentApplied && (
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span>🎓 Tự động giảm giá Sinh viên:</span>
                      <span>-{Number(pricePreview.discountApplied).toLocaleString()}đ</span>
                    </div>
                  )}
                  <div className="border-t pt-2 flex justify-between text-sm font-bold text-slate-900">
                    <span>Thanh toán 100%:</span>
                    <span className="text-emerald-700">
                      {Number(pricePreview.finalPrice).toLocaleString()}đ
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-red-600">
                  Vui lòng chọn giờ kết thúc lớn hơn giờ bắt đầu tối thiểu 1 tiếng (2 block 30 phút).
                </p>
              )}

              <button
                onClick={handleCreateVisualBooking}
                disabled={!pricePreview}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold py-2.5 rounded-lg text-sm transition"
              >
                Chốt lịch & Thanh toán 100%
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL MÔ PHỎNG THANH TOÁN VIETQR 100% */}
      {paymentData && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center space-y-4">
            <h3 className="text-lg font-bold text-slate-800">
              Thanh toán 100% Tiền Sân qua VietQR
            </h3>
            <p className="text-xs text-slate-500">
              Mã đơn: <strong>{paymentData.bookingCode}</strong> | Sân: <strong>{paymentData.courtName}</strong>
            </p>

            <img
              src={paymentData.vietQrUrl}
              alt="VietQR Payment"
              className="w-56 h-56 mx-auto border rounded-xl p-2"
            />

            <div className="bg-slate-50 p-3 rounded-lg text-xs text-left space-y-1 border">
              <div>Ngân hàng Chủ sân: <strong>{paymentData.bankName}</strong></div>
              <div>Số tài khoản: <strong>{paymentData.accountNumber}</strong></div>
              <div>Chủ tài khoản: <strong>{paymentData.accountName}</strong></div>
              <div>Số tiền (100%): <strong className="text-emerald-700">{Number(paymentData.finalPrice).toLocaleString()}đ</strong></div>
              <div>Nội dung CK: <strong className="text-blue-700">{paymentData.transferContent}</strong></div>
            </div>

            <button
              onClick={handleMockConfirmPayment}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-sm shadow-md"
            >
              ✓ Mô phỏng: Khách đã chuyển khoản 100%
            </button>
          </div>
        </div>
      )}
    </div>
  );
}