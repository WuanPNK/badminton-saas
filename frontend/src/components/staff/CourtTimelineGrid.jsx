import { useMemo } from 'react';

// Khung giờ từ 05:00 đến 22:00 (17 tiếng = 1020 phút = 34 block 30 phút)
const START_HOUR = 5;
const END_HOUR = 22;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60; // 1020 phút

// Danh sách các mốc giờ 1 tiếng để hiển thị thanh Header
const HOUR_MARKS = [];
for (let h = START_HOUR; h <= END_HOUR; h++) {
  HOUR_MARKS.push(`${h < 10 ? '0' + h : h}:00`);
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  // Hỗ trợ cả ISO string và HH:MM
  if (timeStr.includes('T')) {
    const d = new Date(timeStr);
    return d.getHours() * 60 + d.getMinutes();
  }
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

export default function CourtTimelineGrid({
  courts = [],
  bookings = [],
  selectedDate,
  onSelectBooking,
  onQuickCheckIn,
  onQuickComplete,
  onQuickExtend,
}) {
  const isToday = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return selectedDate === today;
  }, [selectedDate]);

  // Vạch thời gian thực (phút tính từ 05:00)
  const currentMinutesOffset = useMemo(() => {
    if (!isToday) return null;
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const offset = nowMins - START_HOUR * 60;
    if (offset < 0 || offset > TOTAL_MINUTES) return null;
    return (offset / TOTAL_MINUTES) * 100;
  }, [isToday]);

  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
      {/* HEADER & CHÚ THÍCH TRỰC QUAN */}
      <div className="flex flex-wrap justify-between items-center gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="font-extrabold text-slate-900 text-base">
            Sơ Đồ Ma Trận Sân Thời Gian Thực
          </h3>
          <p className="text-xs text-slate-400">
            Theo dõi trực quan trạng thái từng sân từ 05:00 đến 22:00
          </p>
        </div>

        {/* BẢNG CHÚ THÍCH MÀU (LEGEND) */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            Đang chơi
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            Chờ chơi / Sắp vào ca
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
            Đã hoàn tất
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 text-slate-400 border border-slate-200">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
            Sân trống
          </span>
        </div>
      </div>

      {/* KHUNG TIMELINE CUỘN NGANG */}
      <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-slate-50/50">
        <div className="min-w-[1100px] select-none">
          {/* HÀNG HEADER THỜI GIAN */}
          <div className="flex border-b border-slate-200 bg-slate-100 sticky top-0 z-10 text-[11px] font-black text-slate-600">
            <div className="w-36 shrink-0 p-2.5 border-r border-slate-200 bg-slate-200/80 text-center font-bold text-slate-700">
              Sân thi đấu
            </div>
            <div className="flex-1 grid grid-cols-17 relative">
              {HOUR_MARKS.slice(0, -1).map((hour, idx) => (
                <div
                  key={idx}
                  className="p-2 border-r border-slate-200 text-center text-slate-600 font-extrabold"
                >
                  {hour}
                </div>
              ))}
            </div>
          </div>

          {/* DANH SÁCH TỪNG SÂN (HÀNG) */}
          <div className="divide-y divide-slate-200 relative">
            {courts.map((court) => {
              // Lọc các ca đặt thuộc sân này
              const courtBookings = bookings.filter((b) => b.court_id === court.id);

              return (
                <div key={court.id} className="flex items-center h-20 group hover:bg-slate-50/80 transition relative">
                  {/* CỘT TÊN SÂN */}
                  <div className="w-36 shrink-0 p-3 border-r border-slate-200 bg-white h-full flex flex-col justify-center">
                    <span className="font-extrabold text-xs text-slate-900 truncate">
                      {court.name}
                    </span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span
                        className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                          court.is_under_maintenance
                            ? 'bg-red-100 text-red-700'
                            : court.type === 'VIP'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {court.is_under_maintenance ? 'Bảo trì' : court.type || 'Tiêu chuẩn'}
                      </span>
                    </div>
                  </div>

                  {/* VÙNG TIMELINE CỦA SÂN */}
                  <div className="flex-1 h-full relative">
                    {/* CÁC ĐƯỜNG KẺ DỌC MỖI GIỜ */}
                    <div className="absolute inset-0 grid grid-cols-17 pointer-events-none">
                      {Array.from({ length: 17 }).map((_, colIdx) => (
                        <div
                          key={colIdx}
                          className="border-r border-slate-200/60 h-full"
                        />
                      ))}
                    </div>

                    {/* VẠCH ĐỎ THỜI GIAN THỰC (NẾU LÀ HÔM NAY) */}
                    {currentMinutesOffset !== null && (
                      <div
                        className="absolute top-0 bottom-0 z-20 pointer-events-none"
                        style={{ left: `${currentMinutesOffset}%` }}
                      >
                        <div className="w-0.5 h-full bg-red-500 shadow-sm" />
                        <div className="w-2 h-2 -ml-[3px] rounded-full bg-red-600 shadow" />
                      </div>
                    )}

                    {/* RENDER CÁC KHỐI CA CHƠI TRÊN SÂN */}
                    {courtBookings.map((b) => {
                      const startMins = parseTimeToMinutes(b.start_time);
                      const endMins = parseTimeToMinutes(b.end_time);

                      const offsetMins = Math.max(0, startMins - START_HOUR * 60);
                      const durationMins = Math.max(30, endMins - startMins);

                      const leftPercent = (offsetMins / TOTAL_MINUTES) * 100;
                      const widthPercent = (durationMins / TOTAL_MINUTES) * 100;

                      // Xác định trạng thái màu sắc
                      const now = new Date();
                      const nowMins = now.getHours() * 60 + now.getMinutes();
                      const isNowPlaying =
                        isToday && nowMins >= startMins && nowMins < endMins && b.status !== 'COMPLETED';

                      let badgeBg = 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20';
                      let statusText = 'Chờ chơi';

                      if (b.status === 'COMPLETED') {
                        badgeBg = 'bg-slate-600 hover:bg-slate-700 text-white shadow-slate-500/20';
                        statusText = 'Hoàn tất';
                      } else if (isNowPlaying || b.is_checked_in) {
                        badgeBg = 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 ring-2 ring-emerald-400';
                        statusText = isNowPlaying ? 'Đang chơi' : 'Đã Check-in';
                      }

                      const startTimeLabel = b.start_time?.includes('T')
                        ? new Date(b.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                        : b.start_time?.slice(0, 5);
                      const endTimeLabel = b.end_time?.includes('T')
                        ? new Date(b.end_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                        : b.end_time?.slice(0, 5);

                      return (
                        <div
                          key={b.id}
                          onClick={() => onSelectBooking(b)}
                          style={{
                            left: `${leftPercent}%`,
                            width: `${Math.min(100 - leftPercent, widthPercent)}%`,
                          }}
                          className={`absolute top-2 bottom-2 rounded-xl p-2 cursor-pointer shadow-sm transition-all duration-200 z-10 flex flex-col justify-between overflow-hidden ${badgeBg}`}
                          title={`Bấm xem chi tiết: ${b.booking_code} (${startTimeLabel} - ${endTimeLabel})`}
                        >
                          <div className="flex items-center justify-between gap-1 leading-tight">
                            <span className="font-black text-[11px] truncate tracking-tight">
                              {b.booking_code}
                            </span>
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-black/25 rounded-md shrink-0">
                              {statusText}
                            </span>
                          </div>

                          <div className="text-[10px] font-bold truncate opacity-95">
                            {b.customer_name || b.walk_in_guest_name || 'Khách đặt'}
                          </div>

                          <div className="text-[9px] font-semibold opacity-90 truncate">
                            {startTimeLabel} – {endTimeLabel}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {courts.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400">
                Chưa có sân nào được kích hoạt hiển thị.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

