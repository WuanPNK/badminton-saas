import { useState } from 'react';
import toast from 'react-hot-toast';
import axiosClient from '../../api/axiosClient';
import { exportTenantRevenueToExcel, exportTenantRevenueToCSV } from '../../utils/excelExport';

export default function RevenueCharts({ analytics }) {
  const [hoveredDay, setHoveredDay] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = async () => {
    setIsExporting(true);
    const toastId = toast.loading('Đang trích xuất sổ cái doanh thu & giao dịch...');
    try {
      const res = await axiosClient.get('/tenant/revenue-export');
      if (res.data?.success && res.data?.exportData) {
        await exportTenantRevenueToExcel(res.data.exportData);
        toast.success('Đã xuất file Excel (.xlsx) thành công!', { id: toastId });
      } else {
        toast.error('Không tìm thấy dữ liệu để xuất.', { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi xuất file Excel. Vui lòng thử lại.', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    const toastId = toast.loading('Đang chuẩn bị file CSV...');
    try {
      const res = await axiosClient.get('/tenant/revenue-export');
      if (res.data?.success && res.data?.exportData) {
        exportTenantRevenueToCSV(res.data.exportData);
        toast.success('Đã xuất file CSV thành công!', { id: toastId });
      } else {
        toast.error('Không tìm thấy dữ liệu để xuất.', { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi xuất file CSV. Vui lòng thử lại.', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  if (!analytics || !analytics.chartData) return null;

  const { dailyTrends = [], timeSlots = [], revenueSplit = {} } = analytics.chartData;
  const { summary = {}, advancedAnalyticsEnabled = false, advancedData = null } = analytics;

  // Tìm mức doanh thu cao nhất trong 7 ngày để scale chiều cao cột
  const maxDayRevenue = Math.max(
    ...dailyTrends.map((d) => d.totalRevenue),
    200000 // Tối thiểu để tránh chia cho 0
  );

  // Tìm lượt đặt cao nhất trong các khung giờ
  const maxSlotCount = Math.max(
    ...timeSlots.map((s) => s.count),
    1
  );

  return (
    <div className="space-y-6">

      {/* THANH ĐIỀU HƯỚNG & XUẤT BÁO CÁO KẾ TOÁN (EXCEL / CSV) */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200/90 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black text-sm border border-emerald-100">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </span>
            <h2 className="text-base font-extrabold text-slate-900">Báo Cáo Doanh Thu & Quyết Toán Sân</h2>
            <span className="hidden sm:inline-flex bg-emerald-100/70 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-200">
              Kế toán đối soát
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tổng hợp dòng tiền thuê sân, hóa đơn bán hàng POS và khấu trừ HSSV phục vụ quyết toán thuế cuối tháng
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={isExporting}
            onClick={handleExportExcel}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl transition shadow-sm hover:shadow flex items-center gap-2 disabled:opacity-50"
            title="Xuất file Excel (.xlsx) gồm 3 Sheets: Tổng hợp, Sổ cái đặt sân, Hóa đơn POS"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>{isExporting ? 'Đang trích xuất...' : 'Xuất Báo Cáo Excel (.xlsx)'}</span>
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={handleExportCSV}
            className="px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-700 text-xs font-bold rounded-xl transition border border-slate-200/80 flex items-center gap-1.5 disabled:opacity-50"
            title="Xuất file CSV chuẩn UTF-8 (Excel không lỗi font)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Xuất CSV</span>
          </button>
        </div>
      </div>

      {/* 1. HÀNG THỐNG KÊ TỔNG QUAN (KPI CARDS) */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-[11px] font-bold uppercase text-slate-400">Tổng Doanh Thu Toàn Sân</p>
          <p className="text-2xl font-black text-emerald-700 mt-1">
            {Number(summary.totalRevenue || 0).toLocaleString()} ₫
          </p>
          <div className="mt-2 text-[11px] text-slate-500 flex justify-between">
            <span>Tiền sân: {Number(summary.courtRevenue || 0).toLocaleString()} ₫</span>
            <span>POS: {Number(summary.posRevenue || 0).toLocaleString()} ₫</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-[11px] font-bold uppercase text-slate-400">Số Lượt Đặt Thành Công</p>
          <p className="text-2xl font-black text-slate-900 mt-1">
            {summary.paidBookingsCount || 0} <span className="text-sm font-semibold text-slate-500">lượt</span>
          </p>
          <p className="mt-2 text-[11px] text-emerald-600 font-medium">Đã thanh toán 100% qua VietQR</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-[11px] font-bold uppercase text-slate-400">Đơn Bán Hàng POS</p>
          <p className="text-2xl font-black text-slate-900 mt-1">
            {summary.totalPosOrders || 0} <span className="text-sm font-semibold text-slate-500">hóa đơn</span>
          </p>
          <p className="mt-2 text-[11px] text-slate-500">Nước giải khát & Phụ kiện cầu lông</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <p className="text-[11px] font-bold uppercase text-slate-400">Đơn Chờ Hoàn Tiền (Hủy 24h)</p>
          <p className="text-2xl font-black text-amber-600 mt-1">
            {summary.pendingRefundCount || 0} <span className="text-sm font-semibold text-slate-500">đơn</span>
          </p>
          <p className="mt-2 text-[11px] text-slate-500">
            Đã hoàn: {Number(summary.totalRefundedAmount || 0).toLocaleString()} ₫
          </p>
        </div>
      </div>

      {/* 2. BIỂU ĐỒ CỘT DOANH THU 7 NGÀY & TỶ TRỌNG NGUỒN THU */}
      <div className="grid lg:grid-cols-12 gap-6">
        
        {/* Biểu đồ cột: Doanh thu 7 ngày qua */}
        <div className="lg:col-span-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-6">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">
                Biểu đồ Doanh thu 7 ngày gần nhất
              </h3>
              <p className="text-xs text-slate-500">
                Thống kê kết hợp tiền thuê sân và doanh thu bán hàng POS
              </p>
            </div>
            
            {/* Chú thích màu */}
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-600 inline-block"></span>
                <span>Tiền Sân</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-500 inline-block"></span>
                <span>POS Nước/Đồ</span>
              </span>
            </div>
          </div>

          {/* Khung Biểu đồ SVG / Responsive Bar Chart */}
          <div className="relative pt-6 pb-2">
            
            {/* Tooltip khi di chuột vào cột */}
            {hoveredDay && (
              <div className="absolute top-0 right-4 bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-3 z-10">
                <span>{hoveredDay.displayDate} ({hoveredDay.dayLabel})</span>
                <span className="text-emerald-400 font-bold">
                  Sân: {Number(hoveredDay.courtRevenue).toLocaleString()} ₫
                </span>
                {hoveredDay.posRevenue > 0 && (
                  <span className="text-amber-400 font-bold">
                    POS: {Number(hoveredDay.posRevenue).toLocaleString()} ₫
                  </span>
                )}
                <span className="font-extrabold border-l border-slate-700 pl-2">
                  Tổng: {Number(hoveredDay.totalRevenue).toLocaleString()} ₫
                </span>
              </div>
            )}

            {/* Trục kẻ ngang & Cột bar */}
            <div className="h-52 flex items-end justify-between gap-2 sm:gap-4 px-2 border-b border-slate-200 relative">
              
              {/* Vạch lưới ngang mờ */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-40">
                <div className="border-b border-dashed border-slate-200 w-full"></div>
                <div className="border-b border-dashed border-slate-200 w-full"></div>
                <div className="border-b border-dashed border-slate-200 w-full"></div>
              </div>

              {dailyTrends.map((d, idx) => {
                const courtHeight = maxDayRevenue > 0 ? (d.courtRevenue / maxDayRevenue) * 100 : 0;
                const posHeight = maxDayRevenue > 0 ? (d.posRevenue / maxDayRevenue) * 100 : 0;
                const hasRev = d.totalRevenue > 0;

                return (
                  <div
                    key={idx}
                    onMouseEnter={() => setHoveredDay(d)}
                    onMouseLeave={() => setHoveredDay(null)}
                    className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative z-0"
                  >
                    {/* Nhãn doanh thu trên đỉnh cột nếu có */}
                    {hasRev && (
                      <span className="text-[10px] font-bold text-slate-600 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {Math.round(d.totalRevenue / 1000)}k
                      </span>
                    )}

                    {/* Khối Cột (Stacked Bar) */}
                    <div className="w-full max-w-[42px] flex flex-col justify-end rounded-t-lg overflow-hidden transition-all duration-300 group-hover:brightness-110">
                      {/* POS revenue bar */}
                      {posHeight > 0 && (
                        <div
                          style={{ height: `${Math.max(posHeight, 6)}%` }}
                          className="w-full bg-amber-500 transition-all duration-500"
                        />
                      )}
                      {/* Court revenue bar */}
                      <div
                        style={{ height: `${hasRev ? Math.max(courtHeight, 8) : 4}%` }}
                        className={`w-full transition-all duration-500 ${
                          hasRev ? 'bg-emerald-600' : 'bg-slate-100'
                        }`}
                      />
                    </div>

                    {/* Nhãn ngày bên dưới */}
                    <span className="text-[11px] font-semibold text-slate-500 mt-2 group-hover:text-emerald-700">
                      {d.dayLabel}
                    </span>
                    <span className="text-[9px] text-slate-400 -mt-0.5">
                      {d.displayDate}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Cột phụ: Tỷ trọng nguồn thu & Tỷ lệ lấp đầy */}
        <div className="lg:col-span-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm">
              Cơ cấu Nguồn Doanh Thu
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Tỷ lệ đóng góp giữa tiền sân và dịch vụ phụ trợ
            </p>

            {/* Thanh tỷ lệ phân chia */}
            <div className="space-y-3">
              <div className="h-5 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                <div
                  style={{ width: `${revenueSplit.courtPercent || 100}%` }}
                  className="bg-emerald-600 h-full transition-all duration-500"
                  title={`Tiền sân: ${revenueSplit.courtPercent}%`}
                />
                <div
                  style={{ width: `${revenueSplit.posPercent || 0}%` }}
                  className="bg-amber-500 h-full transition-all duration-500"
                  title={`Dịch vụ POS: ${revenueSplit.posPercent}%`}
                />
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center p-2.5 bg-emerald-50 rounded-xl text-emerald-900 font-semibold">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                    <span>Tiền thuê sân</span>
                  </span>
                  <span className="font-bold">
                    {revenueSplit.courtPercent || 100}% ({Number(summary.courtRevenue || 0).toLocaleString()} ₫)
                  </span>
                </div>

                <div className="flex justify-between items-center p-2.5 bg-amber-50 rounded-xl text-amber-900 font-semibold">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <span>Dịch vụ POS</span>
                  </span>
                  <span className="font-bold">
                    {revenueSplit.posPercent || 0}% ({Number(summary.posRevenue || 0).toLocaleString()} ₫)
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-500">
            <strong>Mẹo vận hành:</strong> Bán thêm nước giải khát, cầu thi đấu và quấn cán vợt tại quầy giúp tăng trung bình <strong>15–25%</strong> doanh thu ròng mỗi ca chơi.
          </div>
        </div>
      </div>

      {/* 3. BIỂU ĐỒ KHUNG GIỜ CAO ĐIỂM (PEAK HOURS OCCUPANCY) */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="mb-4">
          <h3 className="font-extrabold text-slate-900 text-sm">
            Tần suất Đặt sân theo Khung Giờ (Peak Hours)
          </h3>
          <p className="text-xs text-slate-500">
            Giúp chủ sân nắm bắt giờ cao điểm để tối ưu cấu hình bảng giá và bố trí nhân viên lễ tân
          </p>
        </div>

        <div className="space-y-3">
          {timeSlots.map((slot, idx) => {
            const percent = maxSlotCount > 0 ? Math.round((slot.count / maxSlotCount) * 100) : 0;
            const isGoldenHour = slot.slot.includes('17:00 - 20:00');

            return (
              <div key={idx} className="flex items-center gap-3 text-xs">
                {/* Tên khung giờ */}
                <div className="w-32 font-bold text-slate-700 shrink-0">
                  {slot.slot}
                </div>

                {/* Thanh tiến trình bar */}
                <div className="flex-1 h-6 bg-slate-100 rounded-xl overflow-hidden relative shadow-inner">
                  <div
                    style={{ width: `${Math.max(percent, slot.count > 0 ? 8 : 2)}%` }}
                    className={`h-full transition-all duration-500 rounded-xl flex items-center px-2 text-[10px] font-bold text-white ${
                      isGoldenHour
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                        : 'bg-emerald-600'
                    }`}
                  >
                    {slot.count > 0 && `${slot.count} ca`}
                  </div>
                </div>

                {/* Nhãn mô tả */}
                <div className="w-28 text-right font-semibold text-slate-500 shrink-0">
                  {slot.title}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. PHÂN TÍCH CHUYÊN SÂU NẾU CHỦ SÂN BẬT TÍNH NĂNG */}
      {advancedAnalyticsEnabled && advancedData && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Doanh thu chi tiết theo từng Sân */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-3">
            <h3 className="font-extrabold text-slate-900 text-sm">
              Xếp hạng Hiệu suất Khai thác theo Sân
            </h3>
            <p className="text-xs text-slate-500">
              So sánh doanh thu và lượt đặt giữa các sân tiêu chuẩn & VIP
            </p>

            <div className="space-y-2.5 pt-2">
              {advancedData.revenueByCourt.map((rc, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center p-3 bg-slate-50 rounded-xl text-xs hover:bg-slate-100 transition"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <div>
                      <strong className="text-slate-900">{rc.court_name}</strong>
                      <span className="ml-1 text-[10px] text-slate-500">({rc.type === 'VIP' ? 'VIP' : 'Tiêu chuẩn'})</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-emerald-700 font-bold">
                      {Number(rc.revenue).toLocaleString()} ₫
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {rc.total_bookings} ca thi đấu
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top sản phẩm POS bán chạy */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-3">
            <h3 className="font-extrabold text-slate-900 text-sm">
              Top 5 Sản Phẩm POS Bán Chạy Nhất
            </h3>
            <p className="text-xs text-slate-500">
              Các mặt hàng được khách mua nhiều nhất tại quầy
            </p>

            <div className="space-y-2.5 pt-2">
              {advancedData.topProducts.map((tp, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center p-3 bg-slate-50 rounded-xl text-xs hover:bg-slate-100 transition"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <div>
                      <strong className="text-slate-900">{tp.name}</strong>
                      <span className="ml-1 text-[10px] bg-white border px-1.5 py-0.2 rounded text-slate-500">
                        {tp.category === 'DRINK' ? 'Nước uống' : tp.category === 'SHUTTLECOCK' ? 'Cầu lông' : tp.category === 'RACKET_RENTAL' ? 'Thuê vợt' : tp.category === 'ACCESSORY' ? 'Phụ kiện' : tp.category}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-emerald-700 font-bold">
                      {Number(tp.revenue).toLocaleString()} ₫
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Đã bán: {tp.total_sold} món
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
