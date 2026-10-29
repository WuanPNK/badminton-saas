import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import axiosClient from '../../api/axiosClient';

export default function ExtendBookingModal({
  booking,
  tenant,
  onClose,
  onSuccess,
}) {
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [conflictMsg, setConflictMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Xem trước giá và kiểm tra trùng lịch khi đổi thời lượng gia hạn
  useEffect(() => {
    if (!booking?.id) return;
    const fetchPreview = async () => {
      setLoadingPreview(true);
      setConflictMsg('');
      setPreviewData(null);
      try {
        const res = await axiosClient.post('/bookings/preview-extend', {
          bookingId: booking.id,
          durationMinutes,
        });
        setPreviewData(res.data);
      } catch (err) {
        setConflictMsg(err.response?.data?.message || 'Không thể gia hạn trong khung giờ này.');
      } finally {
        setLoadingPreview(false);
      }
    };
    fetchPreview();
  }, [booking?.id, durationMinutes]);

  if (!booking) return null;

  const currentStartTime = booking.start_time?.includes('T')
    ? new Date(booking.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : booking.start_time?.slice(0, 5);

  const currentEndTime = booking.end_time?.includes('T')
    ? new Date(booking.end_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : booking.end_time?.slice(0, 5);

  const newEndTimeLabel = previewData?.newEndTime
    ? new Date(previewData.newEndTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : '';

  // Tạo URL VietQR cho khoản phụ thu nếu chọn chuyển khoản
  const qrUrl =
    paymentMethod === 'TRANSFER' && previewData?.extraPrice > 0 && tenant?.qr_bank_name && tenant?.qr_account_number
      ? `https://img.vietqr.io/image/${tenant.qr_bank_name}-${tenant.qr_account_number}-compact2.png?amount=${previewData.extraPrice}&addInfo=GIAHAN%20${booking.booking_code}&accountName=${encodeURIComponent(tenant.qr_account_name || '')}`
      : null;

  const handleConfirmExtend = async () => {
    if (!previewData?.canExtend) {
      toast.error('Khung giờ không khả dụng để gia hạn.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await axiosClient.post('/bookings/extend', {
        bookingId: booking.id,
        durationMinutes,
        paymentMethod,
      });
      toast.success(res.data.message);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi gia hạn ca chơi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
        {/* HEADER */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
              <span>Gia Hạn Giờ Chơi</span>
              <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-bold">
                {booking.booking_code}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Khách đang chơi: {booking.customer_name || booking.walk_in_guest_name || 'Khách'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center text-sm font-black transition"
          >
            ✕
          </button>
        </div>

        {/* THÔNG TIN CA HIỆN TẠI */}
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500 font-semibold">Khung giờ hiện tại:</span>
            <span className="font-black text-slate-800">
              {currentStartTime} – {currentEndTime}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-semibold">Sân thi đấu:</span>
            <span className="font-bold text-slate-800">{previewData?.courtName || 'Sân hiện tại'}</span>
          </div>
        </div>

        {/* CHỌN THỜI LƯỢNG GIA HẠN */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Chọn thời lượng gia hạn thêm:
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDurationMinutes(30)}
              className={`py-3 px-3 rounded-2xl font-black text-xs border transition flex flex-col items-center gap-1 ${
                durationMinutes === 30
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>+ 30 Phút</span>
              <span className={`text-[10px] font-normal ${durationMinutes === 30 ? 'text-emerald-100' : 'text-slate-400'}`}>
                1 block 30p
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDurationMinutes(60)}
              className={`py-3 px-3 rounded-2xl font-black text-xs border transition flex flex-col items-center gap-1 ${
                durationMinutes === 60
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>+ 1 Tiếng</span>
              <span className={`text-[10px] font-normal ${durationMinutes === 60 ? 'text-emerald-100' : 'text-slate-400'}`}>
                2 block 30p
              </span>
            </button>
          </div>
        </div>

        {/* TRẠNG THÁI KIỂM TRA KHẢ DỤNG & GIÁ TIỀN */}
        {loadingPreview ? (
          <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <span>Đang kiểm tra lịch trống và tính giá...</span>
          </div>
        ) : conflictMsg ? (
          <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 font-bold flex items-center gap-2">
            <span className="text-sm">⚠️</span>
            <span>{conflictMsg}</span>
          </div>
        ) : previewData?.canExtend ? (
          <div className="space-y-3">
            {/* THÔNG TIN GIỜ MỚI & TIỀN PHỤ THU */}
            <div className="bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-2xl space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-emerald-900 font-bold">Giờ kết thúc mới:</span>
                <span className="font-black text-sm text-emerald-800">{newEndTimeLabel}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-emerald-200/60">
                <span className="text-emerald-900 font-bold">Phụ thu tiền sân:</span>
                <span className="font-black text-base text-emerald-700">
                  +{Number(previewData.extraPrice).toLocaleString()} ₫
                </span>
              </div>
            </div>

            {/* HÌNH THỨC THU TIỀN */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Hình thức thanh toán phụ thu:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                    paymentMethod === 'CASH'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  💵 Tiền mặt tại quầy
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('TRANSFER')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                    paymentMethod === 'TRANSFER'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  📱 Quét mã VietQR
                </button>
              </div>
            </div>

            {/* HIỂN THỊ MÃ VIETQR NẾU CHỌN CHUYỂN KHOẢN */}
            {paymentMethod === 'TRANSFER' && qrUrl && (
              <div className="p-3 bg-slate-900 text-white rounded-2xl text-center space-y-2">
                <p className="text-[11px] text-slate-300 font-medium">
                  Quét mã VietQR để thanh toán phụ thu:
                </p>
                <div className="w-40 h-40 mx-auto bg-white p-2 rounded-xl">
                  <img src={qrUrl} alt="VietQR phụ thu" className="w-full h-full object-contain" />
                </div>
                <p className="text-[10px] text-slate-400 font-mono">
                  {tenant.qr_account_number} • {tenant.qr_bank_name}
                </p>
              </div>
            )}
          </div>
        ) : null}

        {/* NÚT THAO TÁC */}
        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 font-bold text-xs text-slate-600 hover:bg-slate-100 transition"
          >
            Đóng
          </button>
          <button
            type="button"
            disabled={!previewData?.canExtend || submitting}
            onClick={handleConfirmExtend}
            className={`flex-1 py-2.5 rounded-xl text-white font-bold text-xs transition shadow-md flex items-center justify-center gap-1.5 ${
              previewData?.canExtend && !submitting
                ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'
                : 'bg-slate-300 cursor-not-allowed'
            }`}
          >
            {submitting ? 'Đang gia hạn...' : 'Xác nhận gia hạn'}
          </button>
        </div>
      </div>
    </div>
  );
}

