import { useState, useEffect } from 'react';

const QUICK_TAGS = [
  'Thảm sân êm ái, bám tốt',
  'Ánh sáng chuẩn thi đấu',
  'Trần cao thoáng đãng',
  'Lễ tân nhiệt tình',
  'Bãi xe rộng rãi',
  'WC & tiện ích sạch sẽ',
];

const RATING_DATA = {
  5: {
    label: 'Tuyệt vời',
    desc: 'Vượt mong đợi, sân chơi và phục vụ rất hài lòng!',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  4: {
    label: 'Rất tốt',
    desc: 'Chất lượng sân tốt, trải nghiệm chơi thoải mái.',
    badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  3: {
    label: 'Bình thường',
    desc: 'Chất lượng tương xứng với mức giá, tạm ổn.',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  2: {
    label: 'Tạm được',
    desc: 'Có điểm chưa hài lòng, cần khắc phục thêm.',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  1: {
    label: 'Kém',
    desc: 'Trải nghiệm không tốt, cơ sở vật chất chưa đạt.',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
  },
};

export default function ReviewModal({
  booking,
  reviewForm,
  setReviewForm,
  onClose,
  onSubmit,
}) {
  const [hoverRating, setHoverRating] = useState(0);

  // Đóng modal khi bấm phím Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!booking) return null;

  const currentRating = hoverRating || reviewForm.rating || 5;
  const currentFeedback = RATING_DATA[currentRating] || RATING_DATA[5];

  const handleToggleTag = (tag) => {
    const currentComment = reviewForm.comment || '';
    if (currentComment.includes(tag)) {
      // Bỏ tag nếu đã có
      const updated = currentComment
        .replace(new RegExp(`(^|,\\s*)${tag}`, 'g'), '')
        .replace(/^,\s*/, '')
        .trim();
      setReviewForm({ ...reviewForm, comment: updated });
    } else {
      // Thêm tag nếu chưa có
      const separator = currentComment.trim().length > 0 ? ', ' : '';
      setReviewForm({ ...reviewForm, comment: `${currentComment.trim()}${separator}${tag}` });
    }
  };

  const formatSlotTime = (isoTime) => {
    if (!isoTime) return '';
    try {
      const d = new Date(isoTime);
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return '';
    }
  };

  const formatDateVN = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden my-8 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER MODAL */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-extrabold mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Đã check-in & hoàn thành ca chơi
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              Đánh giá cụm sân
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {booking.tenant_name}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            title="Đóng"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-5">
          {/* THÔNG TIN CHI TIẾT CA SÂN VỪA CHƠI */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 text-xs">
            <div className="min-w-0">
              <p className="font-extrabold text-slate-800 truncate">
                {booking.court_name} {booking.court_type === 'VIP' ? '(VIP)' : ''}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {formatSlotTime(booking.start_time)} - {formatSlotTime(booking.end_time)} | Ngày {formatDateVN(booking.booking_date || booking.start_time)}
              </p>
            </div>
            <span className="text-[11px] font-mono font-bold bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 shrink-0 shadow-2xs">
              #{booking.booking_code}
            </span>
          </div>

          {/* CHỌN SỐ SAO TRỰC QUAN (INTERACTIVE 5-STAR SYSTEM) */}
          <div className="text-center py-1">
            <label className="block text-xs font-bold text-slate-700 mb-3 uppercase tracking-wider">
              Chất lượng trải nghiệm của bạn
            </label>

            {/* HÀNG 5 SAO SVG */}
            <div className="flex items-center justify-center gap-2 mb-3">
              {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = star <= currentRating;
                return (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setReviewForm({ ...reviewForm, rating: star })}
                    className="p-1 group focus:outline-none transition-transform hover:scale-125 active:scale-95 cursor-pointer"
                    aria-label={`${star} sao`}
                  >
                    <svg
                      className={`w-9 h-9 transition-colors duration-150 ${
                        isFilled
                          ? 'fill-amber-400 text-amber-400 drop-shadow-[0_2px_8px_rgba(251,191,36,0.45)]'
                          : 'fill-slate-100 text-slate-300'
                      }`}
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                      />
                    </svg>
                  </button>
                );
              })}
            </div>

            {/* NHÃN PHẢN HỒI THEO SỐ SAO */}
            <div className="inline-flex flex-col items-center">
              <span className={`px-3 py-1 rounded-full text-xs font-black border transition-all ${currentFeedback.badgeColor}`}>
                {currentRating} sao — {currentFeedback.label}
              </span>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                {currentFeedback.desc}
              </p>
            </div>
          </div>

          {/* GỢI Ý NHANH TRẢI NGHIỆM (ONE-CLICK TAGS) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Điểm nổi bật bạn ấn tượng
            </label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TAGS.map((tag) => {
                const isSelected = (reviewForm.comment || '').includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleToggleTag(tag)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-600'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {isSelected && <span className="mr-1">✓</span>}
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ô NHẬP NHẬN XÉT CHI TIẾT */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Nhận xét trải nghiệm chi tiết
              </label>
              <span className="text-[11px] text-slate-400">
                {(reviewForm.comment || '').length}/500 ký tự
              </span>
            </div>
            <textarea
              rows={3}
              required
              maxLength={500}
              value={reviewForm.comment}
              onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
              placeholder="Chia sẻ cảm nhận về độ nảy của thảm, hệ thống đèn chiếu, không gian sân hoặc thái độ phục vụ của nhân viên..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition leading-relaxed resize-none"
            />
          </div>

          {/* HÀNG NÚT THAO TÁC */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 active:scale-95 transition cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={!(reviewForm.comment || '').trim()}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-xl text-xs transition shadow-lg shadow-emerald-600/25 active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Gửi đánh giá</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
