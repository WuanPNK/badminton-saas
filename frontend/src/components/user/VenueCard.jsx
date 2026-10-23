export default function VenueCard({
  tenant,
  coverImg,
  onOpenDetail,
  onBook,
  renderDiscountLabel,
}) {
  return (
    <div
      onClick={onOpenDetail}
      className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl border border-slate-200/80 transition-all duration-200 cursor-pointer flex flex-col justify-between group"
    >
      <div>
        <div className="relative h-44 overflow-hidden bg-slate-900">
          <img
            src={coverImg}
            alt={tenant.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />

          <div className="absolute top-3 left-3 flex items-center gap-1.5">
            <span className="bg-white/95 text-amber-600 text-xs font-extrabold px-2.5 py-1 rounded-full shadow flex items-center gap-1">
              ★ {Number(tenant.avg_rating) > 0 ? tenant.avg_rating : 'Mới'} ({tenant.total_reviews})
            </span>
            <span className="bg-emerald-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow">
              Đơn ngày
            </span>
            <span className="bg-purple-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow">
              Sự kiện
            </span>
          </div>

          <span className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
            Quận {tenant.district}
          </span>

          <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center text-white text-xs">
            <span className="font-semibold">🕒 05:00 - 22:00</span>
            <span className="bg-emerald-600/90 px-2.5 py-0.5 rounded-md font-bold">
              {tenant.total_courts} sân tiêu chuẩn
            </span>
          </div>
        </div>

        <div className="p-5">
          <h3 className="text-base font-extrabold text-slate-900 group-hover:text-emerald-700 transition line-clamp-1">
            {tenant.name}
          </h3>
          <p className="text-xs text-slate-500 mt-1 line-clamp-1">📍 {tenant.address}</p>
          <p className="text-xs text-slate-600 mt-1">
            📞 Hotline: <strong className="text-slate-800">{tenant.phone_contact}</strong>
          </p>

          <div className="mt-3 bg-emerald-50/90 border border-emerald-200 text-emerald-800 text-xs px-3 py-2 rounded-xl font-semibold">
            🎓 {renderDiscountLabel(tenant.student_discount_type, tenant.student_discount_value)}
          </div>
        </div>
      </div>

      <div className="px-5 pb-5 pt-2 flex items-center gap-2.5 border-t border-slate-100">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail();
          }}
          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 rounded-xl text-xs transition"
        >
          Bảng giá & Đánh giá
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onBook();
          }}
          className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold py-2.5 rounded-xl text-xs transition shadow-sm"
        >
          ĐẶT LỊCH →
        </button>
      </div>
    </div>
  );
}
