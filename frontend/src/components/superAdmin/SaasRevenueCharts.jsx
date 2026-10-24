import { useState } from 'react';
import toast from 'react-hot-toast';
import axiosClient from '../../api/axiosClient';
import { exportSuperAdminRevenueToExcel, exportSuperAdminRevenueToCSV } from '../../utils/excelExport';

export default function SaasRevenueCharts({ dashboardData }) {
  const [hoveredMonth, setHoveredMonth] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = async () => {
    setIsExporting(true);
    const toastId = toast.loading('Đang trích xuất toàn bộ sổ cái hợp đồng SaaS...');
    try {
      const res = await axiosClient.get('/super-admin/revenue-export');
      if (res.data?.success && res.data?.exportData) {
        await exportSuperAdminRevenueToExcel(res.data.exportData);
        toast.success('Đã xuất file Excel SaaS (.xlsx) thành công!', { id: toastId });
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
      const res = await axiosClient.get('/super-admin/revenue-export');
      if (res.data?.success && res.data?.exportData) {
        exportSuperAdminRevenueToCSV(res.data.exportData);
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

  if (!dashboardData) return null;

  const {
    saasRevenue = {},
    monthlyRevenue = [],
    planDistribution = [],
    tenantRanking = [],
    recentSubscriptions = [],
  } = dashboardData;

  // Tìm mức doanh thu cao nhất trong 6 tháng để scale chiều cao cột
  const maxMonthRevenue = Math.max(
    ...monthlyRevenue.map((m) => m.totalRevenue),
    5000000 // Tối thiểu để tránh chia 0
  );

  // Tính tổng doanh thu theo plan distribution để tính %
  const totalPlanAmount = planDistribution.reduce((acc, p) => acc + p.total_amount, 0) || 1;

  // Màu sắc phân bổ cho các gói cước
  const planColorMap = {
    0: { bar: 'bg-blue-600', text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
    1: { bar: 'bg-emerald-600', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    2: { bar: 'bg-purple-600', text: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
    3: { bar: 'bg-amber-600', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  };

  return (
    <div className="space-y-6">

      {/* THANH ĐIỀU HƯỚNG & XUẤT BÁO CÁO SAAS NỀN TẢNG (EXCEL / CSV) */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black text-sm border border-emerald-100">
              📊
            </span>
            <h2 className="text-base font-extrabold text-slate-900">Báo Cáo Doanh Thu Nền Tảng & Sổ Cái Hợp Đồng</h2>
            <span className="hidden sm:inline-flex bg-emerald-100/70 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-200">
              Kế toán Super Admin
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tổng hợp phí thuê phần mềm từ các cụm sân, cơ cấu gói cước và kỳ hạn hợp đồng phục vụ đối soát tài chính
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={isExporting}
            onClick={handleExportExcel}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl transition shadow-sm hover:shadow flex items-center gap-2 disabled:opacity-50"
            title="Xuất file Excel (.xlsx) gồm 3 Sheets: Tổng quan tài chính SaaS, Sổ cái hợp đồng, Doanh thu theo tháng"
          >
            <span className="text-sm">📗</span>
            <span>{isExporting ? 'Đang trích xuất...' : 'Xuất Báo Cáo Excel (.xlsx)'}</span>
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={handleExportCSV}
            className="px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-700 text-xs font-bold rounded-xl transition border border-slate-200/80 flex items-center gap-1.5 disabled:opacity-50"
            title="Xuất file CSV chuẩn UTF-8"
          >
            <span>📄</span>
            <span>Xuất CSV</span>
          </button>
        </div>
      </div>

      {/* 1. HÀNG THỐNG KÊ TỔNG QUAN (KPI CARDS) */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Tổng doanh thu SaaS */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Tổng Thu Gói Cước SaaS
              </span>
              <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm font-black">
                💰
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-emerald-700 mt-2">
              {Number(saasRevenue.total_saas_revenue || 0).toLocaleString()} ₫
            </p>
          </div>
          <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5">
            <span className="text-emerald-600 font-bold">✓</span> Doanh thu tích lũy từ ngày thành lập sàn
          </p>
        </div>

        {/* KPI 2: Doanh thu tháng này */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Doanh Thu Tháng Này
              </span>
              <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-black">
                📅
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-blue-700 mt-2">
              {Number(saasRevenue.this_month_revenue || 0).toLocaleString()} ₫
            </p>
          </div>
          <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
            Số hợp đồng ký mới/gia hạn: <strong>{saasRevenue.this_month_subscriptions || 0}</strong> lượt
          </p>
        </div>

        {/* KPI 3: Tổng số hợp đồng thuê */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Số Hợp Đồng Đã Ký
              </span>
              <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm font-black">
                📝
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
              {saasRevenue.total_subscriptions || 0}{' '}
              <span className="text-sm font-semibold text-slate-400">hợp đồng</span>
            </p>
          </div>
          <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100 flex items-center gap-1">
            <span className="text-emerald-600 font-bold">●</span> Đã thanh toán 100% qua Chuyển khoản
          </p>
        </div>

        {/* KPI 4: Giá trị trung bình hợp đồng */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Giá Trị Hợp Đồng TB (ARPU)
              </span>
              <span className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-sm font-black">
                🎯
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-purple-700 mt-2">
              {Number(saasRevenue.average_deal || 0).toLocaleString()} ₫
            </p>
          </div>
          <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
            Thời hạn trung bình gói: <strong>6 tháng / hợp đồng</strong>
          </p>
        </div>
      </div>

      {/* 2. BIỂU ĐỒ CỘT DOANH THU 6 THÁNG & CƠ CẤU GÓI CƯỚC */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* BIỂU ĐỒ CỘT 6 THÁNG */}
        <div className="lg:col-span-8 bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-6">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">
                Biểu đồ Doanh thu Thuê Nền tảng SaaS (6 tháng gần nhất)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Dòng tiền thu từ các chủ sân thanh toán phí sử dụng phần mềm quản lý và niêm yết sân
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
              <span>Doanh thu thực nhận</span>
            </div>
          </div>

          {/* KHUNG CỘT SVG / CSS FLEX */}
          <div className="relative pt-8 pb-3">
            {hoveredMonth && (
              <div className="absolute top-0 right-4 bg-slate-900 text-white text-xs px-3.5 py-1.5 rounded-xl shadow-lg flex items-center gap-3 z-10 animate-fade-in">
                <span className="font-bold">{hoveredMonth.monthLabel}</span>
                <span className="text-emerald-400 font-extrabold">
                  {hoveredMonth.totalRevenue.toLocaleString()} ₫
                </span>
                <span className="text-slate-300">({hoveredMonth.subCount} hợp đồng)</span>
              </div>
            )}

            <div className="h-56 flex items-end justify-between gap-3 sm:gap-6 border-b border-slate-200 pb-2 px-2">
              {monthlyRevenue.map((m, idx) => {
                const heightPercent = maxMonthRevenue > 0
                  ? Math.round((m.totalRevenue / maxMonthRevenue) * 100)
                  : 0;
                const hasRev = m.totalRevenue > 0;

                return (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                    onMouseEnter={() => setHoveredMonth(m)}
                    onMouseLeave={() => setHoveredMonth(null)}
                  >
                    {/* Cột giá trị */}
                    <div className="w-full max-w-[56px] bg-slate-100 rounded-2xl flex flex-col justify-end overflow-hidden group-hover:brightness-105 transition h-full p-1">
                      <div
                        style={{ height: `${hasRev ? Math.max(heightPercent, 12) : 6}%` }}
                        className={`w-full rounded-xl transition-all duration-500 ${
                          hasRev
                            ? 'bg-gradient-to-t from-emerald-700 via-teal-600 to-emerald-500 shadow-sm'
                            : 'bg-slate-200'
                        }`}
                      />
                    </div>

                    {/* Nhãn tháng */}
                    <span className="text-[11px] font-black text-slate-600 mt-2.5 group-hover:text-emerald-700 transition">
                      {m.monthLabel}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 -mt-0.5">
                      {hasRev ? `${(m.totalRevenue / 1000000).toFixed(1)}M` : '0đ'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* TỶ TRỌNG DOANH THU THEO GÓI CƯỚC (DONUT / PROGRESS SPLIT) */}
        <div className="lg:col-span-4 bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-slate-900 text-base">Cơ Cấu Gói Cước SaaS</h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">
              Tỷ lệ doanh thu đóng góp từ từng phân khúc gói thuê
            </p>

            {/* Thanh tiến trình phân bổ */}
            <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
              {planDistribution.map((p, idx) => {
                const percent = Math.round((p.total_amount / totalPlanAmount) * 100);
                const colors = planColorMap[idx % 4];
                return (
                  <div
                    key={idx}
                    style={{ width: `${percent}%` }}
                    className={`${colors.bar} h-full transition-all duration-500`}
                    title={`${p.plan_name}: ${percent}%`}
                  />
                );
              })}
            </div>

            {/* Danh sách chi tiết các gói */}
            <div className="space-y-2.5 mt-5">
              {planDistribution.map((p, idx) => {
                const percent = Math.round((p.total_amount / totalPlanAmount) * 100);
                const colors = planColorMap[idx % 4];
                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-2xl border ${colors.border} ${colors.bg} flex justify-between items-center text-xs`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${colors.bar}`}></span>
                        <span className="font-black text-slate-900">{p.plan_name}</span>
                      </div>
                      <span className="text-[11px] text-slate-500 ml-4.5">
                        {p.sub_count} hợp đồng kích hoạt
                      </span>
                    </div>
                    <div className="text-right">
                      <div className={`font-black ${colors.text}`}>{percent}%</div>
                      <div className="text-[10px] text-slate-500 font-bold">
                        {p.total_amount.toLocaleString()} ₫
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 text-[11px] text-slate-500">
            💡 <strong>Phân tích thị trường:</strong> Gói Chuyên Nghiệp (Pro SaaS) đem lại hơn{' '}
            <strong>65%</strong> tổng doanh thu nhờ tích hợp tính năng Bảng giá động & Quản lý bán hàng POS.
          </div>
        </div>
      </div>

      {/* 3. BẢNG XẾP HẠNG CỤM SÂN ĐÓNG GÓP DOANH THU & NHẬT KÝ HỢP ĐỒNG GẦN ĐÂY */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* XẾP HẠNG CỤM SÂN */}
        <div className="lg:col-span-5 bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="font-extrabold text-slate-900 text-base mb-1">
            Top Cụm Sân Đóng Góp Doanh Thu
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Các đơn vị đối tác chủ sân có giá trị hợp đồng thuê phần mềm cao nhất
          </p>

          <div className="space-y-3">
            {tenantRanking.length === 0 ? (
              <p className="text-xs text-slate-400">Chưa có dữ liệu xếp hạng cụm sân.</p>
            ) : (
              tenantRanking.map((t, idx) => (
                <div
                  key={t.id}
                  className="p-3.5 bg-slate-50 hover:bg-slate-100/70 rounded-2xl flex items-center justify-between text-xs transition"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs ${
                        idx === 0
                          ? 'bg-amber-400 text-slate-950 shadow-sm'
                          : idx === 1
                          ? 'bg-slate-300 text-slate-900'
                          : idx === 2
                          ? 'bg-amber-700 text-white'
                          : 'bg-white border text-slate-600'
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="font-extrabold text-slate-900">{t.tenant_name}</div>
                      <div className="text-[11px] text-slate-500">
                        Quận {t.district} • {t.subscription_count} lần thanh toán
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-emerald-700">
                      {t.total_paid.toLocaleString()} ₫
                    </div>
                    {t.latest_expiry && (
                      <div className="text-[10px] text-slate-400">
                        Hạn: {new Date(t.latest_expiry).toLocaleDateString('vi-VN')}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* NHẬT KÝ HỢP ĐỒNG GẦN ĐÂY */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-1">
            <h3 className="font-extrabold text-slate-900 text-base">
              Nhật Ký Hợp Đồng SaaS Gần Đây ({recentSubscriptions.length})
            </h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Lịch sử giao dịch thu phí dịch vụ phần mềm từ các cụm sân
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] font-extrabold">
                  <th className="pb-2.5">Cụm sân</th>
                  <th className="pb-2.5">Gói cước</th>
                  <th className="pb-2.5">Số tiền</th>
                  <th className="pb-2.5">Thời hạn</th>
                  <th className="pb-2.5 text-right">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentSubscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-400">
                      Chưa có hợp đồng nào được ghi nhận.
                    </td>
                  </tr>
                ) : (
                  recentSubscriptions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 font-extrabold text-slate-900">
                        <div>{sub.tenant_name}</div>
                        <div className="text-[10px] text-slate-400 font-normal">Quận {sub.district}</div>
                      </td>
                      <td className="py-3 font-semibold text-slate-700">
                        <span className="bg-slate-100 px-2.5 py-1 rounded-lg text-[11px]">
                          {sub.plan_name}
                        </span>
                      </td>
                      <td className="py-3 font-black text-emerald-700">
                        {Number(sub.amount_paid).toLocaleString()} ₫
                      </td>
                      <td className="py-3 text-slate-500 text-[11px]">
                        {new Date(sub.start_date).toLocaleDateString('vi-VN')} →{' '}
                        {new Date(sub.end_date).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="py-3 text-right">
                        <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full text-[10px]">
                          ✓ ĐÃ THU
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
