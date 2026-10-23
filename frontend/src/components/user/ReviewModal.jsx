export default function ReviewModal({
  booking,
  reviewForm,
  setReviewForm,
  onClose,
  onSubmit,
}) {
  if (!booking) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <form
        onSubmit={onSubmit}
        className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4"
      >
        <h3 className="text-lg font-extrabold text-slate-900">
          Đánh giá {booking.tenant_name}
        </h3>
        <div>
          <label className="block text-xs font-bold mb-1">Số sao (1 - 5)</label>
          <select
            value={reviewForm.rating}
            onChange={(e) => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })}
            className="w-full px-3 py-2 border rounded-xl text-sm font-semibold"
          >
            <option value={5}>★★★★★ (5 Sao - Tuyệt vời)</option>
            <option value={4}>★★★★☆ (4 Sao - Tốt)</option>
            <option value={3}>★★★☆☆ (3 Sao - Bình thường)</option>
            <option value={2}>★★☆☆☆ (2 Sao - Tạm được)</option>
            <option value={1}>★☆☆☆☆ (1 Sao - Kém)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold mb-1">Nhận xét trải nghiệm mặt sân</label>
          <textarea
            rows={3}
            required
            value={reviewForm.comment}
            onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
            placeholder="Thảm sân mới, ánh sáng tốt, phục vụ nhiệt tình..."
            className="w-full px-3 py-2 border rounded-xl text-sm"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-xl text-xs font-bold"
          >
            Hủy
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
          >
            Gửi đánh giá
          </button>
        </div>
      </form>
    </div>
  );
}
