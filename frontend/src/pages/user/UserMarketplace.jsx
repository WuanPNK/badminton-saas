import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';

export default function UserMarketplace() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('MARKETPLACE'); // 'MARKETPLACE' | 'MY_BOOKINGS'
  const [tenants, setTenants] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [district, setDistrict] = useState('');
  const [search, setSearch] = useState('');

  // State cho Modal Hủy sân hoàn tiền 100%
  const [cancelModalBooking, setCancelModalBooking] = useState(null);
  const [refundBank, setRefundBank] = useState({
    refundBankName: 'MB Bank',
    refundAccountNumber: '',
    refundAccountName: '',
  });

  // State cho Modal Đánh giá sân (Verified Purchase)
  const [reviewModalBooking, setReviewModalBooking] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });

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
    // eslint-disable-next-line
    fetchMarketplace();
  }, [district]);

  useEffect(() => {
    if (activeTab === 'MY_BOOKINGS') {
      // eslint-disable-next-line
      fetchMyBookings();
    }
  }, [activeTab]);
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

  const renderStudentBadge = () => {
    if (user?.studentStatus === 'VERIFIED') {
      return (
        <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-full text-xs font-bold">
          🎓 Tài khoản Học sinh / Sinh viên (Đã xác thực)
        </span>
      );
    }
    if (user?.studentStatus === 'PENDING_APPROVAL') {
      return (
        <span className="bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1 rounded-full text-xs font-semibold">
          ⏳ Thẻ Học sinh / Sinh viên đang chờ duyệt
        </span>
      );
    }
    return (
      <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-medium">
        Tài khoản Khách thường
      </span>
    );
  };

  const renderDiscountLabel = (type, value) => {
    if (type === 'SYSTEM_DEFAULT_20') return 'Ưu đãi HSSV: Giảm tự động 20%';
    if (type === 'CUSTOM_FIXED_OFF') return `Ưu đãi HSSV: Giảm thẳng ${Number(value).toLocaleString()}đ/ca`;
    if (type === 'CUSTOM_FLAT_RATE') return `Ưu đãi HSSV: Đồng giá ${Number(value).toLocaleString()}đ/giờ`;
    return 'Không áp dụng ưu đãi HSSV';
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* THANH NAVBAR CÓ HUY HIỆU LOẠI TÀI KHOẢN SINH VIÊN Ở GÓC MÀN HÌNH */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Sàn Đặt Lịch Cụm Sân Thể Thao</h1>
          <p className="text-xs text-slate-500">Xin chào, {user?.fullName}</p>
        </div>

        <div className="flex items-center gap-3">
          {renderStudentBadge()}
          <button
            onClick={() => { logout(); navigate('/'); }}
            className="text-xs bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg font-semibold"
          >
            Đăng xuất
          </button>
        </div>
      </header>

      {/* THANH CHUYỂN TAB */}
      <div className="max-w-6xl mx-auto px-6 pt-6">
        <div className="flex gap-3 border-b border-slate-200 pb-3">
          <button
            onClick={() => setActiveTab('MARKETPLACE')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              activeTab === 'MARKETPLACE'
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-slate-700 border'
            }`}
          >
            Danh sách Tất cả Cụm sân
          </button>
          <button
            onClick={() => setActiveTab('MY_BOOKINGS')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              activeTab === 'MY_BOOKINGS'
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-slate-700 border'
            }`}
          >
            Lịch sử Đặt sân, Hoàn tiền & Đánh giá
          </button>
        </div>

        {/* TAB 1: MARKETPLACE TÌM KIẾM & LỌC CỤM SÂN */}
        {activeTab === 'MARKETPLACE' && (
          <div className="py-6">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-3 mb-6">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên cụm sân hoặc tên đường..."
                className="flex-1 min-w-[240px] px-3 py-2 border rounded-lg text-sm"
              />
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm bg-white"
              >
                <option value="">Tất cả Quận / Khu vực</option>
                <option value="Cầu Giấy">Quận Cầu Giấy</option>
                <option value="Đống Đa">Quận Đống Đa</option>
                <option value="Thanh Xuân">Quận Thanh Xuân</option>
                <option value="Hai Bà Trưng">Quận Hai Bà Trưng</option>
                <option value="Hoàng Mai">Quận Hoàng Mai</option>
                <option value="Nam Từ Liêm">Quận Nam Từ Liêm</option>
              </select>
              <button
                onClick={fetchMarketplace}
                className="bg-slate-800 text-white px-5 py-2 rounded-lg text-sm font-semibold"
              >
                Tìm kiếm
              </button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {tenants.map((t) => (
                <div
                  key={t.id}
                  className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded">
                        Quận {t.district}
                      </span>
                      <span className="text-amber-500 text-xs font-bold">
                        ★ {t.avg_rating} ({t.total_reviews} đánh giá)
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-1">{t.name}</h3>
                    <p className="text-xs text-slate-500 mb-3">📍 {t.address}</p>
                    <p className="text-xs text-slate-600 mb-3">
                      📞 Hotline đặt vé vãng lai / sự kiện: <strong>{t.phone_contact}</strong>
                    </p>
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-2.5 rounded-lg mb-4 font-medium">
                      🎓 {renderDiscountLabel(t.student_discount_type, t.student_discount_value)}
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(`/marketplace/${t.id}`)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg text-sm transition"
                  >
                    Vào xem lịch & Đặt sân ({t.total_courts} sân mở)
                  </button>
                </div>
              ))}
              {tenants.length === 0 && (
                <p className="text-sm text-slate-500 col-span-3 text-center py-10">
                  Chưa có cụm sân nào hoạt động tại khu vực này.
                </p>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: LỊCH SỬ ĐẶT SÂN, HỦY SÂN HOÀN TIỀN & ĐÁNH GIÁ */}
        {activeTab === 'MY_BOOKINGS' && (
          <div className="py-6 space-y-4">
            {myBookings.map((b) => (
              <div
                key={b.id}
                className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{b.tenant_name}</span>
                    <span className="text-xs bg-slate-100 px-2 py-0.5 rounded font-semibold">
                      {b.court_name} ({b.court_type})
                    </span>
                    <span className="text-xs font-mono text-slate-500">#{b.booking_code}</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Thời gian: {new Date(b.start_time).toLocaleString('vi-VN')} →{' '}
                    {new Date(b.end_time).toLocaleTimeString('vi-VN')}
                  </p>
                  <p className="text-sm font-bold text-emerald-700">
                    Tổng thanh toán 100%: {Number(b.final_price).toLocaleString()}đ
                    {b.is_student_applied && (
                      <span className="ml-2 text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                        Đã tự động áp dụng giá Sinh viên (Giảm {Number(b.discount_applied).toLocaleString()}đ)
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
                    Trạng thái: {b.status}
                  </span>

                  {/* Nếu đã thanh toán CONFIRMED -> Cho phép bấm Hủy sân (Trước 24h) */}
                  {b.status === 'CONFIRMED' && (
                    <button
                      onClick={() => setCancelModalBooking(b)}
                      className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    >
                      Hủy sân & Nhận hoàn tiền 100%
                    </button>
                  )}

                  {/* Chỉ người đã đặt sân và hoàn tất ca chơi (COMPLETED) mới được đánh giá */}
                  {b.status === 'COMPLETED' && !b.has_reviewed && (
                    <button
                      onClick={() => setReviewModalBooking(b)}
                      className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold"
                    >
                      ★ Viết đánh giá sân
                    </button>
                  )}

                  {b.has_reviewed && (
                    <span className="text-xs text-emerald-700 font-semibold">✓ Đã đánh giá</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL ĐIỀN SỐ TÀI KHOẢN ĐỂ HỦY SÂN & HOÀN 100% TIỀN */}
      {cancelModalBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleConfirmCancel}
            className="bg-white rounded-xl max-w-md w-full p-6 space-y-4"
          >
            <h3 className="text-lg font-bold text-slate-800">
              Yêu cầu Hủy sân & Hoàn 100% tiền
            </h3>
            <p className="text-xs text-slate-600">
              Hệ thống kiểm tra điều kiện hủy trước giờ chơi 24h. Đơn sẽ chuyển sang trạng thái{' '}
              <strong>PENDING_REFUND</strong> để Lễ tân chuyển khoản hoàn lại{' '}
              <strong>{Number(cancelModalBooking.final_price).toLocaleString()}đ</strong> cho bạn.
            </p>
            <div>
              <label className="block text-xs font-semibold mb-1">Tên Ngân hàng nhận hoàn tiền</label>
              <input
                type="text"
                required
                value={refundBank.refundBankName}
                onChange={(e) => setRefundBank({ ...refundBank, refundBankName: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Số tài khoản nhận tiền</label>
              <input
                type="text"
                required
                value={refundBank.refundAccountNumber}
                onChange={(e) => setRefundBank({ ...refundBank, refundAccountNumber: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Tên chủ tài khoản</label>
              <input
                type="text"
                required
                value={refundBank.refundAccountName}
                onChange={(e) => setRefundBank({ ...refundBank, refundAccountName: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalBooking(null)}
                className="px-4 py-2 border rounded-lg text-xs font-semibold"
              >
                Đóng
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold"
              >
                Xác nhận Hủy sân
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL ĐÁNH GIÁ SÂN (CHỈ DÀNH CHO ĐƠN COMPLETED) */}
      {reviewModalBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleSubmitReview}
            className="bg-white rounded-xl max-w-md w-full p-6 space-y-4"
          >
            <h3 className="text-lg font-bold text-slate-800">
              Đánh giá {reviewModalBooking.tenant_name}
            </h3>
            <div>
              <label className="block text-xs font-semibold mb-1">Số sao (1 - 5)</label>
              <select
                value={reviewForm.rating}
                onChange={(e) => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value={5}>5 Sao - Tuyệt vời</option>
                <option value={4}>4 Sao - Tốt</option>
                <option value={3}>3 Sao - Bình thường</option>
                <option value={2}>2 Sao - Tạm được</option>
                <option value={1}>1 Sao - Kém</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Nhận xét trải nghiệm mặt sân</label>
              <textarea
                rows={3}
                required
                value={reviewForm.comment}
                onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                placeholder="Thảm sân mới, ánh sáng tốt..."
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReviewModalBooking(null)}
                className="px-4 py-2 border rounded-lg text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold"
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