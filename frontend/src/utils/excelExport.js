/**
 * Hàm định dạng tiền tệ VNĐ cho chuỗi hiển thị
 */
const formatVND = (amount) => {
  return Number(amount || 0).toLocaleString('vi-VN');
};

/**
 * Hàm định dạng ngày giờ Việt Nam
 */
const formatDateTime = (isoString) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

/**
 * Hàm định dạng ngày
 */
const formatDate = (isoString) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

/**
 * Tính toán độ rộng tự động cho các cột Excel
 */
const autoFitColumns = (dataRows) => {
  const colWidths = [];
  dataRows.forEach((row) => {
    row.forEach((cell, colIndex) => {
      const cellLen = cell ? String(cell).length : 0;
      if (!colWidths[colIndex] || cellLen > colWidths[colIndex]) {
        colWidths[colIndex] = Math.max(cellLen, 10);
      }
    });
  });
  return colWidths.map((w) => ({ wch: Math.min(w + 3, 50) }));
};

// ============================================================================
// 1. XUẤT EXCEL DÀNH CHO CHỦ SÂN (TENANT REVENUE & BOOKINGS)
// ============================================================================

export const exportTenantRevenueToExcel = async (exportData) => {
  if (!exportData) return;

  const XLSX = await import('xlsx');
  const { tenant = {}, summary = {}, bookings = [], posOrders = [], courtPerformance = [] } = exportData;
  const workbook = XLSX.utils.book_new();
  const currentDateStr = new Date().toISOString().split('T')[0];

  // --------------------------------------------------------------------------
  // SHEET 1: TỔNG HỢP DOANH THU & KẾ TOÁN (Summary KPI)
  // --------------------------------------------------------------------------
  const sheet1Data = [
    ['BÁO CÁO DOANH THU & ĐỐI SOÁT TÀI CHÍNH SÂN CẦU LÔNG'],
    [`Cụm sân: ${tenant.name || 'Cụm sân'} - Quận: ${tenant.district || ''}`],
    [`Địa chỉ: ${tenant.address || 'N/A'} - Hotline: ${tenant.phone_contact || 'N/A'}`],
    [`Chủ sân / Đại diện: ${tenant.owner_name || 'N/A'} (${tenant.owner_email || ''})`],
    [`Tài khoản VietQR thụ hưởng: ${tenant.qr_bank_name || 'N/A'} - STK: ${tenant.qr_account_number || 'N/A'} - Chủ TK: ${tenant.qr_account_name || 'N/A'}`],
    [`Thời điểm trích xuất dữ liệu: ${formatDateTime(exportData.exportedAt || new Date().toISOString())}`],
    [], // Dòng trống
    ['--- 1. BẢNG TỔNG HỢP CHỈ SỐ DOANH THU TOÀN SÂN ---'],
    ['Chỉ số tài chính', 'Giá trị', 'Đơn vị tính', 'Ghi chú nghiệp vụ kế toán'],
    ['Tổng doanh thu toàn sân', summary.totalRevenue || 0, 'VNĐ', 'Bao gồm tiền thuê sân và doanh thu bán hàng POS'],
    ['Doanh thu tiền thuê sân', summary.courtRevenue || 0, 'VNĐ', 'Tiền sân đã thu 100% qua chuyển khoản VietQR'],
    ['Số lượt đặt sân thành công', summary.paidBookingsCount || 0, 'Lượt ca', 'Số ca thi đấu đã xác nhận và hoàn thành'],
    ['Doanh thu bán hàng POS', summary.posRevenue || 0, 'VNĐ', 'Nước giải khát, cầu thi đấu, quấn cán & thuê vợt'],
    ['Số hóa đơn bán hàng POS', summary.posOrdersCount || 0, 'Hóa đơn', 'Hóa đơn bán lẻ ghi nhận tại quầy lễ tân'],
    ['Số đơn chờ hoàn tiền (Hủy 24h)', summary.pendingRefundCount || 0, 'Đơn hủy', 'Khách thao tác hủy trước giờ chơi ít nhất 24 tiếng'],
    ['Tổng tiền đã hoàn trả cho khách', summary.totalRefundedAmount || 0, 'VNĐ', 'Đã chuyển khoản hoàn tiền thành công'],
    [], // Dòng trống
    ['--- 2. HIỆU SUẤT KHAI THÁC & DOANH THU THEO TỪNG SÂN ---'],
    ['STT', 'Tên sân', 'Phân loại sân', 'Số ca đã đặt', 'Doanh thu tiền sân (VNĐ)', 'Tỷ trọng đóng góp'],
  ];

  courtPerformance.forEach((cp, idx) => {
    const percent = summary.courtRevenue > 0 ? ((Number(cp.total_revenue) / summary.courtRevenue) * 100).toFixed(1) + '%' : '0%';
    sheet1Data.push([
      idx + 1,
      cp.court_name,
      cp.court_type === 'VIP' ? 'Sân Thi Đấu VIP' : 'Sân Tiêu Chuẩn',
      Number(cp.total_bookings || 0),
      Number(cp.total_revenue || 0),
      percent,
    ]);
  });

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
  ws1['!cols'] = autoFitColumns(sheet1Data);
  XLSX.utils.book_append_sheet(workbook, ws1, 'Tổng Hợp Doanh Thu');

  // --------------------------------------------------------------------------
  // SHEET 2: CHI TIẾT SỔ CÁI ĐẶT SÂN (Bookings Ledger)
  // --------------------------------------------------------------------------
  const sheet2Data = [
    [
      'STT',
      'Mã Đặt Sân',
      'Tên Sân',
      'Loại Sân',
      'Tên Khách Hàng',
      'Số Điện Thoại',
      'Email Khách',
      'Ngày Đặt',
      'Giờ Bắt Đầu',
      'Giờ Kết Thúc',
      'Thời Lượng (Phút)',
      'Giá Gốc (VNĐ)',
      'Giảm Trừ HSSV (VNĐ)',
      'Doanh Thu Thực Thu (VNĐ)',
      'Áp Dụng HSSV',
      'Hình Thức Đặt',
      'Trạng Thái Đơn',
      'Người Tạo / Lễ Tân',
      'Thời Điểm Tạo',
    ],
  ];

  bookings.forEach((b, idx) => {
    const startTime = new Date(b.start_time);
    const endTime = new Date(b.end_time);
    const durationMin = Math.round((endTime - startTime) / (1000 * 60));

    sheet2Data.push([
      idx + 1,
      b.booking_code,
      b.court_name,
      b.court_type === 'VIP' ? 'Sân VIP' : 'Tiêu chuẩn',
      b.customer_name || 'Khách vãng lai',
      b.customer_phone || '',
      b.customer_email || '',
      formatDate(b.booking_date),
      formatDateTime(b.start_time),
      formatDateTime(b.end_time),
      durationMin,
      Number(b.original_price || 0),
      Number(b.discount_applied || 0),
      Number(b.final_price || 0),
      b.is_student_applied ? 'CÓ (HSSV)' : 'Không',
      b.booking_type === 'VISUAL' ? 'Khách đặt qua App' : 'Vãng lai tại quầy',
      b.status === 'CONFIRMED'
        ? 'ĐÃ THANH TOÁN'
        : b.status === 'COMPLETED'
        ? 'HOÀN THÀNH'
        : b.status === 'PENDING_REFUND'
        ? 'CHỜ HOÀN TIỀN'
        : b.status === 'REFUNDED'
        ? 'ĐÃ HOÀN TIỀN'
        : b.status,
      b.staff_name || 'Khách tự đặt online',
      formatDateTime(b.created_at),
    ]);
  });

  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
  ws2['!cols'] = autoFitColumns(sheet2Data);
  XLSX.utils.book_append_sheet(workbook, ws2, 'Sổ Cái Đặt Sân');

  // --------------------------------------------------------------------------
  // SHEET 3: CHI TIẾT HÓA ĐƠN BÁN HÀNG POS (POS Orders Ledger)
  // --------------------------------------------------------------------------
  if (posOrders && posOrders.length > 0) {
    const sheet3Data = [
      [
        'STT',
        'Mã Hóa Đơn (UUID)',
        'Nhân Viên Phụ Trách',
        'Sân Thi Đấu Liên Quan',
        'Mã Đặt Sân Ghép Cùng',
        'Chi Tiết Mặt Hàng Đã Bán',
        'Tổng Tiền Hóa Đơn (VNĐ)',
        'Phương Thức Thanh Toán',
        'Ghi Chú Đơn',
        'Thời Gian Thanh Toán',
      ],
    ];

    posOrders.forEach((po, idx) => {
      sheet3Data.push([
        idx + 1,
        po.id,
        po.staff_name || 'Lễ tân',
        po.court_name || 'Tại quầy lễ tân',
        po.booking_code || 'Không ghép',
        po.items_detail || 'Đơn dịch vụ POS',
        Number(po.total_amount || 0),
        po.payment_method === 'CASH' ? 'Tiền mặt tại quầy' : 'Chuyển khoản VietQR',
        po.note || '',
        formatDateTime(po.created_at),
      ]);
    });

    const ws3 = XLSX.utils.aoa_to_sheet(sheet3Data);
    ws3['!cols'] = autoFitColumns(sheet3Data);
    XLSX.utils.book_append_sheet(workbook, ws3, 'Hóa Đơn POS');
  }

  // Tên file tải về sạch đẹp, chuẩn hoá tiếng Việt không dấu
  const cleanName = (tenant.name || 'San_Cau_Long')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `Bao_Cao_Doanh_Thu_${cleanName}_${currentDateStr}.xlsx`;

  XLSX.writeFile(workbook, fileName);
};

// ============================================================================
// 2. XUẤT FILE CSV DÀNH CHO CHỦ SÂN (UTF-8 BOM HỖ TRỢ EXCEL KHÔNG LỖI FONT)
// ============================================================================

export const exportTenantRevenueToCSV = (exportData) => {
  if (!exportData || !exportData.bookings) return;

  const { tenant = {}, bookings = [] } = exportData;
  const currentDateStr = new Date().toISOString().split('T')[0];

  const headers = [
    'STT',
    'Ma_Dat_San',
    'Ten_San',
    'Loai_San',
    'Khach_Hang',
    'So_Dien_Thoai',
    'Ngay_Choi',
    'Gio_Bat_Dau',
    'Gio_Ket_Thuc',
    'Gia_Goc_VND',
    'Giam_Gia_VND',
    'Doanh_Thu_Thuc_Thu_VND',
    'HSSV',
    'Trang_Thai',
    'Ngay_Tao',
  ];

  const rows = bookings.map((b, idx) => [
    idx + 1,
    `"${b.booking_code}"`,
    `"${b.court_name}"`,
    `"${b.court_type}"`,
    `"${b.customer_name || 'Khách vãng lai'}"`,
    `"${b.customer_phone || ''}"`,
    `"${formatDate(b.booking_date)}"`,
    `"${formatDateTime(b.start_time)}"`,
    `"${formatDateTime(b.end_time)}"`,
    Number(b.original_price || 0),
    Number(b.discount_applied || 0),
    Number(b.final_price || 0),
    b.is_student_applied ? 'YES' : 'NO',
    `"${b.status}"`,
    `"${formatDateTime(b.created_at)}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const cleanName = (tenant.name || 'San_Cau_Long')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_');
  link.setAttribute('href', url);
  link.setAttribute('download', `So_Cai_Dat_San_${cleanName}_${currentDateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// ============================================================================
// 3. XUẤT EXCEL DÀNH CHO SUPER ADMIN (SAAS PLATFORM REVENUE & CONTRACTS)
// ============================================================================

export const exportSuperAdminRevenueToExcel = async (exportData) => {
  if (!exportData) return;

  const XLSX = await import('xlsx');
  const {
    summary = {},
    subscriptions = [],
    planDistribution = [],
    tenantRanking = [],
    monthlyRevenue = [],
  } = exportData;

  const workbook = XLSX.utils.book_new();
  const currentDateStr = new Date().toISOString().split('T')[0];

  // --------------------------------------------------------------------------
  // SHEET 1: TỔNG QUAN TÀI CHÍNH NỀN TẢNG SAAS (Platform Overview)
  // --------------------------------------------------------------------------
  const sheet1Data = [
    ['BÁO CÁO DOANH THU NỀN TẢNG SAAS & ĐỐI SOÁT HỢP ĐỒNG ĐỐI TÁC'],
    ['Nền tảng: Badminton SaaS Multi-Tenant Platform'],
    [`Thời điểm trích xuất dữ liệu: ${formatDateTime(exportData.exportedAt || new Date().toISOString())}`],
    ['Đơn vị lập báo cáo: Ban Quản Trị Hệ Thống (Super Admin)'],
    [],
    ['--- 1. CÁC CHỈ SỐ DOANH THU SAAS NỀN TẢNG ---'],
    ['Chỉ số tài chính', 'Giá trị', 'Đơn vị tính', 'Ghi chú đối soát'],
    ['Tổng Doanh Thu SaaS Tích Lũy', summary.total_saas_revenue || 0, 'VNĐ', 'Tổng thu từ phí thuê phần mềm từ các cụm sân'],
    ['Doanh Thu Tháng Này', summary.this_month_revenue || 0, 'VNĐ', 'Hợp đồng kích hoạt / gia hạn trong tháng hiện tại'],
    ['Số Hợp Đồng Ký Trong Tháng', summary.this_month_subscriptions || 0, 'Hợp đồng', 'Giao dịch thu phí thành công'],
    ['Tổng Số Hợp Đồng Đã Ký', summary.total_subscriptions || 0, 'Hợp đồng', 'Toàn bộ hợp đồng từ ngày vận hành sàn'],
    ['Giá Trị Trung Bình Hợp Đồng (ARPU)', Math.round(summary.average_deal || 0), 'VNĐ / hợp đồng', 'Doanh thu trung bình trên mỗi hợp đồng thuê'],
    [],
    ['--- 2. CƠ CẤU DOANH THU THEO GÓI CƯỚC SAAS ---'],
    ['STT', 'Tên Gói Cước', 'Hạng Gói', 'Số Hợp Đồng Kích Hoạt', 'Tổng Doanh Thu (VNĐ)', 'Tỷ Trọng (%)'],
  ];

  const totalPlanAmount = planDistribution.reduce((acc, p) => acc + Number(p.total_amount || 0), 0) || 1;
  planDistribution.forEach((p, idx) => {
    const percent = ((Number(p.total_amount || 0) / totalPlanAmount) * 100).toFixed(1) + '%';
    sheet1Data.push([
      idx + 1,
      p.plan_name,
      p.badge || 'TIÊU CHUẨN',
      Number(p.sub_count || 0),
      Number(p.total_amount || 0),
      percent,
    ]);
  });

  sheet1Data.push([]);
  sheet1Data.push(['--- 3. XẾP HẠNG ĐÓNG GÓP DOANH THU CÁC CỤM SÂN ---']);
  sheet1Data.push(['Hạng', 'Tên Cụm Sân', 'Quận / Khu Vực', 'Địa Chỉ', 'Số Lần Thanh Toán', 'Tổng Phí SaaS Đã Đóng (VNĐ)', 'Hạn Dùng Hiện Tại']);

  tenantRanking.forEach((t, idx) => {
    sheet1Data.push([
      `#${idx + 1}`,
      t.tenant_name,
      `Quận ${t.district}`,
      t.address || 'N/A',
      Number(t.subscription_count || 0),
      Number(t.total_paid || 0),
      t.latest_expiry ? formatDate(t.latest_expiry) : 'Chưa kích hoạt',
    ]);
  });

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
  ws1['!cols'] = autoFitColumns(sheet1Data);
  XLSX.utils.book_append_sheet(workbook, ws1, 'Tổng Quan Tài Chính SaaS');

  // --------------------------------------------------------------------------
  // SHEET 2: SỔ CÁI HỢP ĐỒNG THUÊ PHẦN MỀM (Subscriptions Ledger)
  // --------------------------------------------------------------------------
  const sheet2Data = [
    [
      'STT',
      'Mã Hợp Đồng (UUID)',
      'Tên Cụm Sân',
      'Quận / Huyện',
      'Địa Chỉ Cụ Thể',
      'Người Đại Diện / Chủ Sân',
      'Email Liên Hệ',
      'Số Điện Thoại Hotline',
      'Gói Cước Kích Hoạt',
      'Giới Hạn Số Sân',
      'Số Tiền Thu Phí (VNĐ)',
      'Ngày Bắt Đầu',
      'Ngày Hết Hạn Hợp Đồng',
      'Trạng Thái Thanh Toán',
      'Thời Điểm Ghi Nhận',
    ],
  ];

  subscriptions.forEach((sub, idx) => {
    sheet2Data.push([
      idx + 1,
      sub.id,
      sub.tenant_name,
      `Quận ${sub.district}`,
      sub.address || '',
      sub.owner_name || '',
      sub.owner_email || '',
      sub.phone_contact || '',
      sub.plan_name,
      sub.max_courts ? `${sub.max_courts} sân` : 'Không giới hạn',
      Number(sub.amount_paid || 0),
      formatDate(sub.start_date),
      formatDate(sub.end_date),
      sub.payment_status === 'PAID' ? 'ĐÃ THU 100%' : sub.payment_status,
      formatDateTime(sub.created_at),
    ]);
  });

  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
  ws2['!cols'] = autoFitColumns(sheet2Data);
  XLSX.utils.book_append_sheet(workbook, ws2, 'Sổ Cái Hợp Đồng');

  // --------------------------------------------------------------------------
  // SHEET 3: DOANH THU THEO TỪNG THÁNG (Monthly Revenue Trends)
  // --------------------------------------------------------------------------
  if (monthlyRevenue && monthlyRevenue.length > 0) {
    const sheet3Data = [
      ['STT', 'Kỳ Kế Toán (Tháng/Năm)', 'Số Lượng Hợp Đồng Ký', 'Doanh Thu Thu Được (VNĐ)'],
    ];

    monthlyRevenue.forEach((m, idx) => {
      sheet3Data.push([
        idx + 1,
        m.month_label || m.month_key,
        Number(m.sub_count || 0),
        Number(m.total_revenue || 0),
      ]);
    });

    const ws3 = XLSX.utils.aoa_to_sheet(sheet3Data);
    ws3['!cols'] = autoFitColumns(sheet3Data);
    XLSX.utils.book_append_sheet(workbook, ws3, 'Doanh Thu Theo Tháng');
  }

  const fileName = `Bao_Cao_Doanh_Thu_SaaS_Nen_Tang_${currentDateStr}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

// ============================================================================
// 4. XUẤT CSV CHO SUPER ADMIN
// ============================================================================

export const exportSuperAdminRevenueToCSV = (exportData) => {
  if (!exportData || !exportData.subscriptions) return;

  const { subscriptions = [] } = exportData;
  const currentDateStr = new Date().toISOString().split('T')[0];

  const headers = [
    'STT',
    'Ma_Hop_Dong',
    'Ten_Cum_San',
    'Quan',
    'Chu_San',
    'Email',
    'So_Dien_Thoai',
    'Goi_Cuoc',
    'So_Tien_Thu_VND',
    'Ngay_Bat_Dau',
    'Ngay_Het_Han',
    'Trang_Thai',
  ];

  const rows = subscriptions.map((s, idx) => [
    idx + 1,
    `"${s.id}"`,
    `"${s.tenant_name}"`,
    `"${s.district}"`,
    `"${s.owner_name || ''}"`,
    `"${s.owner_email || ''}"`,
    `"${s.phone_contact || ''}"`,
    `"${s.plan_name}"`,
    Number(s.amount_paid || 0),
    `"${formatDate(s.start_date)}"`,
    `"${formatDate(s.end_date)}"`,
    `"${s.payment_status}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.setAttribute('href', url);
  link.setAttribute('download', `So_Cai_Hop_Dong_SaaS_${currentDateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
