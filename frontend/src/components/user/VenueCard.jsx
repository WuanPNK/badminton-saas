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
      className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl hover:shadow-emerald-950/10 border border-slate-200/80 hover:border-emerald-300 transition-all duration-300 cursor-pointer flex flex-col justify-between group transform hover:-translate-y-1"
    >
      <div>
        {/* KHUNG ẢNH CỤM SÂN */}
        <div className="relative h-48 overflow-hidden bg-slate-900">
          <img
            src={coverImg}
            alt={tenant.name}
            className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-700 opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent" />

          {/* BADGES GÓC TRÁI TRÊN */}
          <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
            <span className="bg-white/95 backdrop-blur text-amber-600 text-xs font-black px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
              <span>★</span>
              <span>{Number(tenant.avg_rating) > 0 ? tenant.avg_rating : 'Mới'}</span>
              <span className="text-slate-400 font-normal text-[10px]">({tenant.total_reviews})</span>
            </span>
          </div>

          {/* BADGE QUẬN GÓC PHẢI TRÊN */}
          <span className="absolute top-3 right-3 bg-slate-950/75 backdrop-blur text-white text-xs font-bold px-3 py-1 rounded-full border border-white/10 shadow">
            Quận {tenant.district}
          </span>

          {/* THÔNG TIN KHUNG GIỜ VÀ SỐ SÂN DƯỚI ĐÁY ẢNH */}
          <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center text-white text-xs">
            <span className="font-semibold text-slate-200 drop-shadow">
              05:00 - 22:00
            </span>
            <span className="bg-emerald-600/90 backdrop-blur text-white px-2.5 py-0.5 rounded-lg font-extrabold text-[11px] border border-emerald-400/30 shadow">
              {tenant.total_courts} sân
            </span>
          </div>
        </div>

        {/* THÔNG TIN CHI TIẾT */}
        <div className="p-5">
          <h3 className="text-base font-extrabold text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-1">
            {tenant.name}
          </h3>
          <p className="text-xs text-slate-500 mt-1 line-clamp-1">
            {tenant.address}
          </p>
          <p className="text-xs text-slate-600 mt-1.5">
            Hotline: <strong className="text-slate-800 font-bold">{tenant.phone_contact}</strong>
          </p>

          {/* BADGE ƯU ĐÃI SINH VIÊN */}
          <div className="mt-3.5 bg-emerald-50/90 border border-emerald-200 text-emerald-800 text-xs px-3 py-2 rounded-2xl font-bold flex items-center">
            <span className="truncate">{renderDiscountLabel(tenant.student_discount_type, tenant.student_discount_value)}</span>
          </div>
        </div>
      </div>

      {/* 2 NÚT THAO TÁC DƯỚI ĐÁY CARD */}
      <div className="px-5 pb-5 pt-3 flex items-center gap-2.5 border-t border-slate-100">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail();
          }}
          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
        >
          Bảng giá & Chi tiết
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onBook();
          }}
          className="flex-1 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black py-2.5 rounded-xl text-xs transition shadow-sm active:scale-95 cursor-pointer flex items-center justify-center gap-1"
        >
          <span>ĐẶT LỊCH</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
}
