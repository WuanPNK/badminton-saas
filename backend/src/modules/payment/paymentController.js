const db = require('../../config/db');

// 1. LẤY THÔNG TIN THANH TOÁN & SINH MÃ VIETQR ĐỘNG CHO ĐƠN ĐẶT SÂN
exports.getBookingPaymentInfo = async (req, res) => {
  const { bookingId } = req.params;

  try {
    const result = await db.query(
      `SELECT b.*, t.name AS tenant_name, t.qr_bank_name, t.qr_account_number, t.qr_account_name,
              c.name AS court_name
       FROM bookings b
       JOIN tenants t ON b.tenant_id = t.id
       JOIN courts c ON b.court_id = c.id
       WHERE b.id = $1 AND b.user_id = $2`,
      [bookingId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đơn đặt sân.' });
    }

    const booking = result.rows[0];
    const bankId = booking.qr_bank_name || 'MB';
    const accountNo = booking.qr_account_number || '0000123456789';
    const accountName = encodeURIComponent(booking.qr_account_name || booking.tenant_name);
    const amount = Math.round(Number(booking.final_price));
    const addInfo = encodeURIComponent(`DAT SAN ${booking.booking_code}`);

    // Link ảnh QR chuẩn VietQR (Hiển thị trực tiếp trên thẻ img của React)
    const vietQrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${amount}&addInfo=${addInfo}&accountName=${accountName}`;

    res.json({
      success: true,
      paymentData: {
        bookingId: booking.id,
        bookingCode: booking.booking_code,
        tenantName: booking.tenant_name,
        courtName: booking.court_name,
        startTime: booking.start_time,
        endTime: booking.end_time,
        originalPrice: booking.original_price,
        discountApplied: booking.discount_applied,
        finalPrice: booking.final_price,
        isStudentApplied: booking.is_student_applied,
        status: booking.status,
        bankName: bankId,
        accountNumber: accountNo,
        accountName: booking.qr_account_name || booking.tenant_name,
        transferContent: `DAT SAN ${booking.booking_code}`,
        vietQrUrl
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi lấy thông tin thanh toán VietQR.' });
  }
};

// 2. NÚT BẤM MÔ PHỎNG THANH TOÁN 100% THÀNH CÔNG (DEMO LOCAL)
exports.mockConfirmPayment = async (req, res) => {
  const { bookingId } = req.params;

  try {
    const result = await db.query(
      `UPDATE bookings
       SET status = 'CONFIRMED', updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status = 'PENDING'
       RETURNING *`,
      [bookingId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        message: 'Đơn hàng không ở trạng thái chờ thanh toán hoặc không thuộc quyền sở hữu của bạn.'
      });
    }

    res.json({
      success: true,
      message: 'Thanh toán 100% thành công! Lịch đặt sân của bạn đã được xác nhận (CONFIRMED).',
      booking: result.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi xác nhận thanh toán giả lập.' });
  }
};

// 3. KHÁCH HÀNG YÊU CẦU HỦY SÂN TRƯỚC 24H -> CHUYỂN SANG CHỜ HOÀN TIỀN (PENDING_REFUND)
exports.cancelBookingRequestRefund = async (req, res) => {
  const { bookingId } = req.params;
  const { refundBankName, refundAccountNumber, refundAccountName } = req.body;

  if (!refundBankName || !refundAccountNumber || !refundAccountName) {
    return res.status(400).json({
      message: 'Vui lòng cung cấp đầy đủ Tên ngân hàng, Số tài khoản và Tên chủ tài khoản để nhận hoàn tiền 100%.'
    });
  }

  try {
    const bookingRes = await db.query(
      `SELECT * FROM bookings WHERE id = $1 AND user_id = $2`,
      [bookingId, req.user.id]
    );

    if (bookingRes.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đơn đặt sân.' });
    }

    const booking = bookingRes.rows[0];

    if (booking.status !== 'CONFIRMED') {
      return res.status(400).json({
        message: 'Chỉ những đơn đặt sân đã thanh toán (CONFIRMED) mới có thể yêu cầu hủy và hoàn tiền.'
      });
    }

    // Kiểm tra điều kiện hủy trước giờ bắt đầu chơi ít nhất 24 giờ
    const now = new Date();
    const startTime = new Date(booking.start_time);
    const hoursUntilStart = (startTime - now) / (1000 * 60 * 60);

    if (hoursUntilStart < 24) {
      return res.status(400).json({
        message: 'Không thể hủy sân! Hệ thống chỉ hỗ trợ hủy và hoàn tiền 100% khi thao tác trước giờ chơi ít nhất 24 tiếng.'
      });
    }

    // Chuyển trạng thái sang PENDING_REFUND (Ô lịch trên Timeline tự động trống để người khác đặt)
    const updateRes = await db.query(
      `UPDATE bookings
       SET status = 'PENDING_REFUND',
           refund_bank_name = $1,
           refund_account_number = $2,
           refund_account_name = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [refundBankName, refundAccountNumber, refundAccountName, bookingId]
    );

    res.json({
      success: true,
      message: 'Đã hủy lịch hợp lệ (trước 24h). Yêu cầu hoàn 100% tiền đã được gửi tới Lễ tân cụm sân!',
      booking: updateRes.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi xử lý hủy sân.' });
  }
};

// 4. LỄ TÂN / CHỦ SÂN XEM DANH SÁCH YÊU CẦU HOÀN TIỀN (TAB HOÀN TIỀN)
exports.getTenantRefundRequests = async (req, res) => {
  const tenantId = req.tenant.id;
  const { status } = req.query; // Có thể lọc 'PENDING_REFUND' hoặc 'REFUNDED'

  try {
    const filterStatus = status || 'PENDING_REFUND';
    const result = await db.query(
      `SELECT b.id, b.booking_code, b.booking_date, b.start_time, b.end_time,
              b.final_price, b.status,
              b.refund_bank_name, b.refund_account_number, b.refund_account_name,
              b.refunded_at,
              u.full_name AS customer_name, u.phone AS customer_phone,
              c.name AS court_name
       FROM bookings b
       LEFT JOIN users u ON b.user_id = u.id
       JOIN courts c ON b.court_id = c.id
       WHERE b.tenant_id = $1 AND b.status = $2
       ORDER BY b.updated_at DESC`,
      [tenantId, filterStatus]
    );

    res.json({
      success: true,
      refundRequests: result.rows
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi tải danh sách yêu cầu hoàn tiền.' });
  }
};

// 5. LỄ TÂN / CHỦ SÂN BẤM NÚT "ĐÃ HOÀN TIỀN" SAU KHI CHUYỂN KHOẢN THỦ CÔNG
exports.markBookingRefunded = async (req, res) => {
  const { bookingId } = req.params;
  const tenantId = req.tenant.id;
  const staffId = req.user.id;

  try {
    const result = await db.query(
      `UPDATE bookings
       SET status = 'REFUNDED',
           refunded_at = NOW(),
           refunded_by_staff_id = $1,
           updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3 AND status = 'PENDING_REFUND'
       RETURNING *`,
      [staffId, bookingId, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Không tìm thấy yêu cầu hoàn tiền hợp lệ hoặc đơn này đã được hoàn tiền trước đó.'
      });
    }

    res.json({
      success: true,
      message: 'Đã xác nhận hoàn 100% tiền cho khách hàng thành công (REFUNDED)!',
      booking: result.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi xác nhận hoàn tiền.' });
  }
};