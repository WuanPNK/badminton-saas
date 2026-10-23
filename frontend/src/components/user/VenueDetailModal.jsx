export default function VenueDetailModal({
  selectedVenue,
  loadingVenue,
  venueDetailTab,
  setVenueDetailTab,
  onClose,
  onBook,
  renderDiscountLabel,
  calcStudentHourlyPreview,
  formatDaysOfWeek,
  gallery,
}) {
  if (!selectedVenue && !loadingVenue) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 z-50"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
      >
        {loadingVenue || !selectedVenue ? (
          <div className="p-16 text-center text-sm text-slate-500">
            Đang tải thông tin cụm sân...
          </div>
        ) : (
          <>
            <div className="relative bg-gradient-to-r from-emerald-900 via-emerald-800 to-slate-900 text-white p-6">
              <div className="flex flex-wrap justify-between items-start gap-4">
                <div className="flex items-center gap-4">
                  <button
                    onClick={onClose}
                    className="w-10 h-10 rounded-full bg-white text-emerald-900 font-black flex items-center justify-center shadow hover:bg-slate-100"
                  >
                    ←
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                        🏸 Cầu lông • Quận {selectedVenue.tenant.district}
                      </span>
                      <span className="bg-amber-400 text-slate-950 text-xs font-extrabold px-2.5 py-0.5 rounded-full">
                        ★ {Number(selectedVenue.tenant.avg_rating) > 0 ? selectedVenue.tenant.avg_rating : 'Mới'} ({selectedVenue.reviews.length} đánh giá)
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black mt-1">
                      {selectedVenue.tenant.name}
                    </h2>
                    <p className="text-xs text-emerald-100 mt-0.5">
                      📍 {selectedVenue.tenant.address} • 🕒 Mở cửa: 05:00 - 22:00 • 📞 {selectedVenue.tenant.phone_contact}
                    </p>
                  </div>
                </div>

                <button
                  onClick={onBook}
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black px-6 py-3 rounded-2xl text-sm shadow-lg transition"
                >
                  Đặt lịch ngay →
                </button>
              </div>
            </div>

            <div className="flex border-b border-slate-200 bg-slate-50 px-6 overflow-x-auto text-xs font-extrabold">
              {[
                { id: 'PRICING', label: '💰 Bảng giá & Dịch vụ' },
                { id: 'IMAGES', label: '🖼️ Hình ảnh sân' },
                { id: 'RULES', label: '📋 Điều khoản & Quy định' },
                { id: 'REVIEWS', label: `⭐ Đánh giá (${selectedVenue.reviews.length})` },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setVenueDetailTab(t.id)}
                  className={`px-4 py-3.5 border-b-2 whitespace-nowrap transition ${
                    venueDetailTab === t.id
                      ? 'border-emerald-600 text-emerald-700 bg-white'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {venueDetailTab === 'PRICING' && (
                <div className="space-y-5">
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex flex-wrap justify-between items-center gap-2 text-xs">
                    <div>
                      <span className="font-extrabold text-emerald-950">
                        🎓 Chính sách Học sinh / Sinh viên tại sân:{' '}
                      </span>
                      <span className="text-emerald-800 font-semibold">
                        {renderDiscountLabel(
                          selectedVenue.tenant.student_discount_type,
                          selectedVenue.tenant.student_discount_value
                        )}
                      </span>
                    </div>
                    <span className="text-[11px] text-emerald-700 font-bold">
                      Hệ thống tự động áp dụng khi chọn giờ
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="bg-emerald-800 text-white text-center py-2.5 font-extrabold text-sm">
                      BẢNG GIÁ THUÊ SÂN CẦU LÔNG
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-center border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-800 font-extrabold border-b border-slate-200">
                            <th className="p-3 border-r border-slate-200">Loại sân</th>
                            <th className="p-3 border-r border-slate-200">Thứ</th>
                            <th className="p-3 border-r border-slate-200">Khung giờ</th>
                            <th className="p-3 border-r border-slate-200">Giá tiêu chuẩn</th>
                            <th className="p-3 text-emerald-700">Giá Học sinh / Sinh viên</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedVenue.pricingRules.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-6 text-slate-500">
                                Đồng giá mặc định: <strong>80.000 ₫ / giờ</strong> cho tất cả các khung giờ.
                              </td>
                            </tr>
                          ) : (
                            selectedVenue.pricingRules.map((rule) => (
                              <tr
                                key={rule.id}
                                className="border-b border-slate-200 hover:bg-slate-50"
                              >
                                <td className="p-3 font-extrabold text-slate-900 border-r border-slate-200">
                                  Sân {rule.court_type}
                                </td>
                                <td className="p-3 font-semibold text-slate-700 border-r border-slate-200">
                                  {formatDaysOfWeek(rule.days_of_week)}
                                </td>
                                <td className="p-3 font-semibold text-emerald-800 border-r border-slate-200">
                                  {rule.start_time.slice(0, 5)} - {rule.end_time.slice(0, 5)}
                                </td>
                                <td className="p-3 font-extrabold text-slate-900 border-r border-slate-200">
                                  {Number(rule.price_per_hour).toLocaleString()} ₫/h
                                </td>
                                <td className="p-3 font-extrabold text-emerald-700 bg-emerald-50/40">
                                  {calcStudentHourlyPreview(
                                    rule.price_per_hour,
                                    selectedVenue.tenant
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-extrabold uppercase text-slate-500 mb-2.5">
                      Danh sách sân đang mở phục vụ ({selectedVenue.courts.length} sân)
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {selectedVenue.courts.map((c) => (
                        <div
                          key={c.id}
                          className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex justify-between items-center text-xs"
                        >
                          <span className="font-extrabold text-slate-800">{c.name}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              c.is_under_maintenance
                                ? 'bg-red-100 text-red-700'
                                : c.type === 'VIP'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {c.is_under_maintenance ? 'Bảo trì' : c.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {venueDetailTab === 'IMAGES' && (
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {gallery.map((imgUrl, i) => (
                    <div
                      key={i}
                      className="rounded-2xl overflow-hidden border border-slate-200 h-48 bg-slate-100"
                    >
                      <img
                        src={imgUrl}
                        alt={`Hình ảnh sân ${i + 1}`}
                        className="w-full h-full object-cover hover:scale-105 transition duration-300"
                      />
                    </div>
                  ))}
                </div>
              )}

              {venueDetailTab === 'RULES' && (
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3 text-xs text-slate-700 leading-relaxed">
                  <h4 className="font-extrabold text-sm text-slate-900">
                    Nội quy & Quy định tại {selectedVenue.tenant.name}
                  </h4>
                  {selectedVenue.tenant.description && (
                    <p className="p-3 bg-white rounded-xl border border-slate-200">
                      {selectedVenue.tenant.description}
                    </p>
                  )}
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Vui lòng mang giày thể thao chuyên dụng hoặc không để lại vết đen trên mặt thảm.</li>
                    <li>Có mặt trước giờ đặt 5–10 phút để làm thủ tục Check-in tại quầy Lễ tân.</li>
                    <li>
                      <strong>Quy định Hủy lịch & Hoàn tiền:</strong> Hoàn lại <strong>100% tiền sân</strong> khi thao tác hủy trước giờ chơi ít nhất <strong>24 tiếng</strong>.
                    </li>
                    <li>Không hút thuốc lá và xả rác trong khu vực thảm thi đấu.</li>
                  </ul>
                </div>
              )}

              {venueDetailTab === 'REVIEWS' && (
                <div className="space-y-4">
                  {selectedVenue.reviews.length === 0 ? (
                    <div className="text-center py-12 text-xs text-slate-400">
                      Chưa có đánh giá nào cho cụm sân này.
                    </div>
                  ) : (
                    selectedVenue.reviews.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-start gap-3.5 p-4 rounded-2xl border border-slate-100 bg-slate-50/70"
                      >
                        <div className="w-10 h-10 rounded-full bg-emerald-700 text-white font-extrabold flex items-center justify-center text-sm shrink-0">
                          {r.user_name?.charAt(0)?.toUpperCase() || 'K'}
                        </div>
                        <div className="flex-1 text-xs">
                          <div className="flex flex-wrap justify-between items-center gap-2">
                            <span className="font-extrabold text-slate-900 text-sm">
                              {r.user_name}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {new Date(r.created_at).toLocaleDateString('vi-VN')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-amber-500 font-bold tracking-wider">
                              {r.rating} {'★'.repeat(r.rating)}
                              {'☆'.repeat(5 - r.rating)}
                            </span>
                            {r.court_name && (
                              <span className="text-[10px] bg-white border px-2 py-0.5 rounded-full text-slate-600 font-semibold">
                                Đã chơi tại: {r.court_name}
                              </span>
                            )}
                          </div>
                          <p className="text-slate-700 mt-2">{r.comment}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
