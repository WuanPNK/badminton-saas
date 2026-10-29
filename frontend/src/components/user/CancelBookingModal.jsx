export default function CancelBookingModal({
  booking,
  refundBank,
  setRefundBank,
  onClose,
  onConfirm,
}) {
  if (!booking) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <form
        onSubmit={onConfirm}
        className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4"
      >
        <h3 className="text-lg font-extrabold text-slate-900">
          Yêu cầu Hủy sân & Hoàn 100% tiền
        </h3>
        <p className="text-xs text-slate-600">
          Đơn sẽ chuyển sang trạng thái <strong>Chờ hoàn tiền</strong> để Lễ tân chuyển khoản hoàn lại{' '}
          <strong className="text-emerald-700">
            {Number(booking.final_price).toLocaleString()} ₫
          </strong>{' '}
          cho bạn (áp dụng khi hủy trước giờ chơi tối thiểu 24h).
        </p>
        <div>
          <label className="block text-xs font-bold mb-1">Tên Ngân hàng nhận hoàn tiền</label>
          <input
            type="text"
            required
            value={refundBank.refundBankName}
            onChange={(e) => setRefundBank({ ...refundBank, refundBankName: e.target.value })}
            className="w-full px-3 py-2 border rounded-xl text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-bold mb-1">Số tài khoản nhận tiền</label>
          <input
            type="text"
            required
            value={refundBank.refundAccountNumber}
            onChange={(e) =>
              setRefundBank({ ...refundBank, refundAccountNumber: e.target.value })
            }
            className="w-full px-3 py-2 border rounded-xl text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-bold mb-1">Tên chủ tài khoản</label>
          <input
            type="text"
            required
            value={refundBank.refundAccountName}
            onChange={(e) =>
              setRefundBank({ ...refundBank, refundAccountName: e.target.value })
            }
            className="w-full px-3 py-2 border rounded-xl text-sm"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-xl text-xs font-bold"
          >
            Đóng
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold"
          >
            Xác nhận Hủy sân
          </button>
        </div>
      </form>
    </div>
  );
}
