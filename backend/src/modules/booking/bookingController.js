const db = require('../../config/db');
const { validateTimeBlocks, calculateBookingPrice } = require('./pricingHelper');
const { notifyBookingUpdate } = require('../../config/socket');
const { isValidVNPhone, formatVNPhone } = require('../../utils/validators');

// 1. LẤY DỮ LIỆU LƯỚI THỜI GIAN (TIMELINE GRID) CỦA CỤM SÂN THEO NGÀY
exports.getDailyTimeline = async (req, res) => {
  const { tenantId } = req.params;
  const { date } = req.query; // Định dạng YYYY-MM-DD

  if (!date) {
    return res.status(400).json({ message: 'Vui lòng truyền tham số ngày (date=YYYY-MM-DD).' });
  }

  try {
    // Tự động chuyển các ca CONFIRMED đã hết giờ (end_time <= NOW()) thành COMPLETED
    await db.query(
      `UPDATE bookings
       SET status = 'COMPLETED', updated_at = NOW()
       WHERE tenant_id = $1 AND status = 'CONFIRMED' AND end_time <= NOW()`,
      [tenantId]
    );

    // Lấy danh sách sân đã PUBLISHED của cụm sân
    const courtsRes = await db.query(
      `SELECT id, name, type, is_under_maintenance, maintenance_start, maintenance_note
       FROM courts
       WHERE tenant_id = $1 AND status = 'PUBLISHED'
       ORDER BY name ASC`,
      [tenantId]
    );

    // Lấy tất cả các ca đặt đang giữ chỗ (dưới 15 phút) hoặc đã xác nhận trong ngày đó
    const bookingsRes = await db.query(
      `SELECT b.id, b.booking_code, b.court_id, b.booking_type, b.start_time, b.end_time, b.status,
              b.walk_in_guest_name, b.walk_in_guest_phone, b.user_id, b.checked_in_at, b.is_checked_in, b.final_price,
              COALESCE(b.walk_in_guest_name, u.full_name) AS customer_name,
              COALESCE(b.walk_in_guest_phone, u.phone) AS customer_phone
       FROM bookings b
       LEFT JOIN users u ON b.user_id = u.id
       WHERE b.tenant_id = $1
         AND b.booking_date = $2
         AND (b.status IN ('CONFIRMED', 'COMPLETED') OR (b.status = 'PENDING' AND b.created_at >= NOW() - INTERVAL '15 minutes'))
       ORDER BY b.start_time ASC`,
      [tenantId, date]
    );

    res.json({
      success: true,
      date,
      courts: courtsRes.rows,
      bookings: bookingsRes.rows
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi tải lịch sân.' });
  }
};

// 2. TÍNH THỬ GIÁ TIỀN TỰ ĐỘNG TRƯỚC KHI ĐẶT (DÀNH CHO GIAO DIỆN KHÁCH HÀNG)
exports.previewBookingPrice = async (req, res) => {
  const { tenantId, startTime, endTime } = req.body;
  const courtId = req.body.courtId || (Array.isArray(req.body.courtIds) ? req.body.courtIds[0] : undefined);

  const checkBlock = validateTimeBlocks(startTime, endTime);
  if (!checkBlock.valid) {
    return res.status(400).json({ message: checkBlock.message });
  }

  // Khách chỉ được đặt trước tối đa 4 ngày
  const bookingDate = startTime.split('T')[0];
  const todayStr = new Date().toISOString().split('T')[0];
  const diffDays = Math.round((new Date(bookingDate) - new Date(todayStr)) / (1000 * 3600 * 24));
  if (diffDays < 0 || diffDays > 4) {
    return res.status(400).json({ message: 'Quý khách chỉ có thể đặt sân sớm trước tối đa 4 ngày.' });
  }

  try {
    const tenantRes = await db.query(`SELECT * FROM tenants WHERE id = $1 AND status = 'ACTIVE'`, [tenantId]);
    const courtRes = await db.query(`SELECT * FROM courts WHERE id = $1 AND tenant_id = $2`, [courtId, tenantId]);
    const rulesRes = await db.query(`SELECT * FROM pricing_rules WHERE tenant_id = $1`, [tenantId]);

    if (tenantRes.rows.length === 0 || courtRes.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin sân.' });
    }

    if (courtRes.rows[0].is_under_maintenance) {
      const maintStart = courtRes.rows[0].maintenance_start ? new Date(courtRes.rows[0].maintenance_start) : null;
      if (!maintStart || new Date(checkBlock.end) > maintStart) {
        return res.status(400).json({ message: 'Sân này đang trong thời gian bảo trì, vui lòng chọn sân khác.' });
      }
    }

    let isVerifiedStudent = false;
    if (req.user?.id) {
      const userRes = await db.query(`SELECT student_status FROM users WHERE id = $1`, [req.user.id]);
      isVerifiedStudent = userRes.rows[0]?.student_status === 'VERIFIED';
    }

    const priceDetails = calculateBookingPrice({
      start: checkBlock.start,
      end: checkBlock.end,
      courtType: courtRes.rows[0].type,
      pricingRules: rulesRes.rows,
      tenant: tenantRes.rows[0],
      isVerifiedStudent
    });

    res.json({
      success: true,
      totalHours: checkBlock.totalHours,
      ...priceDetails
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi tính giá sân.' });
  }
};

exports.createVisualBooking = async (req, res) => {
  const { tenantId, courtId, bookingDate, startTime, endTime } = req.body;
  const userId = req.user.id;

  const checkBlock = validateTimeBlocks(startTime, endTime);
  if (!checkBlock.valid) {
    return res.status(400).json({ message: checkBlock.message });
  }

  // Khách chỉ được đặt trước tối đa 4 ngày
  const todayStr = new Date().toISOString().split('T')[0];
  const diffDays = Math.round((new Date(bookingDate) - new Date(todayStr)) / (1000 * 3600 * 24));
  if (diffDays < 0 || diffDays > 4) {
    return res.status(400).json({ message: 'Quý khách chỉ có thể đặt sân sớm trước tối đa 4 ngày.' });
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const courtRes = await client.query(
      `SELECT * FROM courts
       WHERE id = $1 AND tenant_id = $2 AND status = 'PUBLISHED'
       FOR UPDATE`,
      [courtId, tenantId]
    );

    if (courtRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Sân không tồn tại hoặc chưa được mở bán.' });
    }
    if (courtRes.rows[0].is_under_maintenance) {
      const maintStart = courtRes.rows[0].maintenance_start ? new Date(courtRes.rows[0].maintenance_start) : null;
      if (!maintStart || new Date(checkBlock.end) > maintStart) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Sân này đang trong thời gian bảo trì, vui lòng chọn sân khác.' });
      }
    }

    const overlapRes = await client.query(
      `SELECT id FROM bookings
       WHERE court_id = $1
         AND status IN ('PENDING', 'CONFIRMED', 'COMPLETED')
         AND start_time < $3
         AND end_time > $2
       LIMIT 1`,
      [courtId, checkBlock.start, checkBlock.end]
    );

    if (overlapRes.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        message: 'Khung giờ bạn chọn đã có người đặt hoặc đang được giữ chỗ. Vui lòng chọn khung giờ khác!'
      });
    }

    const tenantRes = await client.query(`SELECT * FROM tenants WHERE id = $1`, [tenantId]);
    const rulesRes = await client.query(`SELECT * FROM pricing_rules WHERE tenant_id = $1`, [tenantId]);
    const userRes = await client.query(`SELECT student_status FROM users WHERE id = $1`, [userId]);

    const isVerifiedStudent = userRes.rows[0]?.student_status === 'VERIFIED';

    const priceDetails = calculateBookingPrice({
      start: checkBlock.start,
      end: checkBlock.end,
      courtType: courtRes.rows[0].type,
      pricingRules: rulesRes.rows,
      tenant: tenantRes.rows[0],
      isVerifiedStudent
    });

    const bookingCode = 'DS' + Math.floor(100000 + Math.random() * 900000);

    const insertRes = await client.query(
      `INSERT INTO bookings (
        booking_code, tenant_id, court_id, booking_type, user_id,
        booking_date, start_time, end_time,
        original_price, discount_applied, final_price, is_student_applied, status
      )
      VALUES ($1, $2, $3, 'VISUAL', $4, $5, $6, $7, $8, $9, $10, $11, 'PENDING')
      RETURNING *`,
      [
        bookingCode,
        tenantId,
        courtId,
        userId,
        bookingDate,
        checkBlock.start,
        checkBlock.end,
        priceDetails.originalPrice,
        priceDetails.discountApplied,
        priceDetails.finalPrice,
        priceDetails.isStudentApplied
      ]
    );

    await client.query('COMMIT');

    const createdBooking = insertRes.rows[0];

    // Phát sự kiện cập nhật thời gian thực qua Socket.io
    notifyBookingUpdate(tenantId, {
      type: 'BOOKING_CREATED',
      booking: createdBooking,
      date: bookingDate,
      courtId: courtId,
    });

    res.status(201).json({
      success: true,
      message: 'Đã tạo đơn đặt sân. Vui lòng thanh toán 100% tiền sân để hoàn tất xác nhận.',
      booking: createdBooking
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Lỗi khi tạo đơn đặt sân:', error);
    res.status(500).json({ message: 'Lỗi khi tạo đơn đặt sân.' });
  } finally {
    client.release();
  }
};

// 4. LỄ TÂN / CHỦ SÂN TẠO VÉ SỰ KIỆN / GIẢI ĐẤU (EVENT) - ĐẶT ĐƯỢC NHIỀU SÂN, GIẢM 20% KHI > 3 SÂN
exports.createStaffBooking = async (req, res) => {
  const tenantId = req.tenant.id;
  const staffId = req.user.id;
  const {
    courtId,
    courtIds,
    bookingType,
    guestName,
    guestPhone,
    bookingDate: rawBookingDate,
    startTime,
    endTime,
    customPrice
  } = req.body;
  const bookingDate = rawBookingDate || (startTime ? startTime.split('T')[0] : null);

  if (guestPhone && guestPhone.trim()) {
    if (!isValidVNPhone(guestPhone)) {
      return res.status(400).json({
        message: 'Số điện thoại khách không hợp lệ. Vui lòng nhập đúng 10 chữ số di động VN (đầu 03, 05, 07, 08, 09).'
      });
    }
  }
  const cleanGuestPhone = guestPhone && guestPhone.trim() ? formatVNPhone(guestPhone) : '';

  if (bookingType === 'WALK_IN') {
    return res.status(400).json({ message: 'Loại vé vãng lai đã ngừng hỗ trợ. Vui lòng chọn vé Sự Kiện (EVENT)!' });
  }

  // Cho phép 1 hoặc nhiều sân khi tổ chức Sự Kiện
  const targetCourtIds = (Array.isArray(courtIds) && courtIds.length > 0)
    ? courtIds
    : [courtId].filter(Boolean);

  if (targetCourtIds.length === 0) {
    return res.status(400).json({ message: 'Vui lòng chọn ít nhất 1 sân để tổ chức sự kiện.' });
  }

  const checkBlock = validateTimeBlocks(startTime, endTime);
  if (!checkBlock.valid) {
    return res.status(400).json({ message: checkBlock.message });
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const rulesRes = await client.query(`SELECT * FROM pricing_rules WHERE tenant_id = $1`, [tenantId]);
    const tenantRes = await client.query(`SELECT * FROM tenants WHERE id = $1`, [tenantId]);

    // 1. Kiểm tra tồn tại, bảo trì và trùng lịch trước cho tất cả các sân
    const courtsToBook = [];
    for (const cId of targetCourtIds) {
      const courtRes = await client.query(
        `SELECT * FROM courts WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
        [cId, tenantId]
      );
      if (courtRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: `Không tìm thấy sân có ID: ${cId}` });
      }
      const court = courtRes.rows[0];

      if (court.is_under_maintenance) {
        const maintStart = court.maintenance_start ? new Date(court.maintenance_start) : null;
        if (!maintStart || new Date(checkBlock.end) > maintStart) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: `Sân "${court.name}" đang trong thời gian bảo trì, vui lòng chọn sân khác.` });
        }
      }

      const overlapRes = await client.query(
        `SELECT id FROM bookings
         WHERE court_id = $1
           AND status IN ('PENDING', 'CONFIRMED', 'COMPLETED')
           AND start_time < $3
           AND end_time > $2
         LIMIT 1`,
        [cId, checkBlock.start, checkBlock.end]
      );

      if (overlapRes.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ message: `Sân "${court.name}" đã bị trùng lịch trong khung giờ này!` });
      }

      courtsToBook.push(court);
    }

    // 2. Tính tiền theo bảng giá động (KHÔNG áp dụng ưu đãi sinh viên)
    let totalOriginalPrice = 0;
    const courtPrices = [];

    for (const court of courtsToBook) {
      const calc = calculateBookingPrice({
        start: checkBlock.start,
        end: checkBlock.end,
        courtType: court.type,
        pricingRules: rulesRes.rows,
        tenant: tenantRes.rows[0],
        isVerifiedStudent: false // Không áp dụng ưu đãi sinh viên cho vé sự kiện
      });
      totalOriginalPrice += calc.originalPrice;
      courtPrices.push({
        court,
        originalPrice: calc.originalPrice
      });
    }

    // Quy định: Đặt trên 3 sân (> 3 sân, tức từ 4 sân trở lên) được giảm 20% tổng số tiền
    const isBulkDiscount = targetCourtIds.length > 3;
    const discountRate = isBulkDiscount ? 0.20 : 0;
    const totalDiscount = Math.round(totalOriginalPrice * discountRate);

    const parsedCustomPrice = customPrice !== undefined && customPrice !== '' ? Number(customPrice) : null;
    const hasCustomPrice = parsedCustomPrice !== null && !isNaN(parsedCustomPrice) && parsedCustomPrice >= 0;

    const createdBookings = [];
    const eventGroupCode = 'EV' + Math.floor(100000 + Math.random() * 900000);

    for (let i = 0; i < courtPrices.length; i++) {
      const { court, originalPrice } = courtPrices[i];
      let courtFinal = 0;
      let courtDiscount = 0;

      if (hasCustomPrice) {
        courtFinal = Math.round(parsedCustomPrice / courtPrices.length);
        courtDiscount = Math.max(0, originalPrice - courtFinal);
      } else {
        courtDiscount = Math.round(originalPrice * discountRate);
        courtFinal = originalPrice - courtDiscount;
      }

      const bookingCode = courtsToBook.length === 1 ? eventGroupCode : `${eventGroupCode}-${i + 1}`;

      const insertRes = await client.query(
        `INSERT INTO bookings (
          booking_code, tenant_id, court_id, booking_type,
          walk_in_guest_name, walk_in_guest_phone, created_by_staff_id,
          booking_date, start_time, end_time,
          original_price, discount_applied, final_price, is_student_applied, status
        )
        VALUES ($1, $2, $3, 'EVENT', $4, $5, $6, $7, $8, $9, $10, $11, $12, FALSE, 'CONFIRMED')
        RETURNING *`,
        [
          bookingCode,
          tenantId,
          court.id,
          guestName || 'Sự Kiện / Giải Đấu',
          cleanGuestPhone,
          staffId,
          bookingDate,
          checkBlock.start,
          checkBlock.end,
          originalPrice,
          courtDiscount,
          courtFinal
        ]
      );

      createdBookings.push(insertRes.rows[0]);
    }

    await client.query('COMMIT');

    // Phát sự kiện cập nhật thời gian thực qua Socket.io
    notifyBookingUpdate(tenantId, {
      type: 'STAFF_BOOKING_CREATED',
      bookings: createdBookings,
      date: bookingDate,
    });

    const finalTotalAmount = hasCustomPrice ? parsedCustomPrice : (totalOriginalPrice - totalDiscount);

    res.status(201).json({
      success: true,
      message: `Đã tạo vé Sự Kiện (${createdBookings.length} sân) thành công!${isBulkDiscount ? ' (Đã áp dụng giảm 20% khi đặt trên 3 sân)' : ''}`,
      bookings: createdBookings,
      booking: createdBookings[0],
      totalOriginalPrice,
      totalDiscount,
      totalFinalPrice: finalTotalAmount,
      isBulkDiscount,
      discountPercent: isBulkDiscount ? 20 : 0
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Lỗi khi tạo vé sự kiện:', error);
    res.status(500).json({ message: 'Lỗi khi tạo vé sự kiện.' });
  } finally {
    client.release();
  }
};

// 5. KHÁCH HÀNG XEM LỊCH SỬ ĐẶT SÂN CỦA MÌNH
exports.getMyBookings = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT b.*, t.name AS tenant_name, t.address AS tenant_address, c.name AS court_name, c.type AS court_type,
              EXISTS(SELECT 1 FROM reviews r WHERE r.booking_id = b.id) AS has_reviewed,
              ((b.is_checked_in = TRUE OR b.checked_in_at IS NOT NULL) AND (b.status = 'COMPLETED' OR b.end_time <= NOW())) AS can_review
       FROM bookings b
       JOIN tenants t ON b.tenant_id = t.id
       JOIN courts c ON b.court_id = c.id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
      [req.user.id]
    );

    res.json({ success: true, bookings: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi tải lịch sử đặt sân.' });
  }
};

// 6. LỄ TÂN CHECK-IN KHÁCH ĐẾN SÂN & HOÀN TẤT CA CHƠI (MỞ KHÓA REVIEW)
exports.updateBookingOperationStatus = async (req, res) => {
  const { id } = req.params;
  const action = req.body.action || req.body.operation; // 'CHECK_IN' hoặc 'COMPLETE'
  const tenantId = req.tenant.id;

  try {
    if (action === 'CHECK_IN') {
      const bookingCheck = await db.query(
        `SELECT id, start_time, end_time, status, is_checked_in, checked_in_at
         FROM bookings WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId]
      );

      if (bookingCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Không tìm thấy đơn đặt sân.' });
      }

      const b = bookingCheck.rows[0];
      if (b.status !== 'CONFIRMED' && b.status !== 'COMPLETED') {
        return res.status(400).json({ message: 'Chỉ đơn đặt sân đã thanh toán (CONFIRMED) mới có thể Check-in.' });
      }

      if (b.is_checked_in || b.checked_in_at) {
        return res.status(400).json({ message: 'Khách hàng đã check-in ca chơi này rồi!' });
      }

      const now = new Date();
      const startTime = new Date(b.start_time);
      const endTime = new Date(b.end_time);
      const windowStart = new Date(startTime.getTime() - 15 * 60 * 1000);

      if (now < windowStart) {
        const timeStr = windowStart.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
        return res.status(400).json({
          message: `Chưa đến giờ check-in! Nút check-in chỉ mở từ 15 phút trước giờ chơi (từ ${timeStr}).`
        });
      }

      if (now > endTime) {
        return res.status(400).json({
          message: 'Ca chơi này đã kết thúc, không thể thực hiện check-in.'
        });
      }

      const result = await db.query(
        `UPDATE bookings
         SET checked_in_at = NOW(), is_checked_in = TRUE, updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2
         RETURNING *`,
        [id, tenantId]
      );

      const checkedInBooking = result.rows[0];

      // Phát sự kiện cập nhật thời gian thực qua Socket.io
      notifyBookingUpdate(tenantId, {
        type: 'BOOKING_CHECKED_IN',
        booking: checkedInBooking,
        date: checkedInBooking.booking_date,
        courtId: checkedInBooking.court_id,
      });

      return res.json({
        success: true,
        message: 'Khách đã Check-in nhận sân thành công!',
        booking: checkedInBooking
      });
    }

    if (action === 'COMPLETE') {
      const result = await db.query(
        `UPDATE bookings
         SET status = 'COMPLETED', updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2 AND status = 'CONFIRMED'
         RETURNING *`,
        [id, tenantId]
      );
      if (result.rows.length === 0) {
        return res.status(400).json({ message: 'Chỉ có thể hoàn tất đơn đang ở trạng thái CONFIRMED.' });
      }

      const completedBooking = result.rows[0];

      // Phát sự kiện cập nhật thời gian thực qua Socket.io
      notifyBookingUpdate(tenantId, {
        type: 'BOOKING_COMPLETED',
        booking: completedBooking,
        date: completedBooking.booking_date,
        courtId: completedBooking.court_id,
      });

      return res.json({
        success: true,
        message: 'Đã hoàn tất ca sân! Khách hàng hiện đã có thể đánh giá sân.',
        booking: completedBooking
      });
    }

    res.status(400).json({ message: 'Hành động không hợp lệ.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi cập nhật trạng thái vận hành sân.' });
  }
};

// 7. KHÁCH HỦY ĐƠN CHỜ THANH TOÁN (KHI ĐÓNG POPUP VIETQR) -> GIẢI PHÓNG SÂN NGAY
exports.cancelPendingBooking = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const result = await db.query(
      `DELETE FROM bookings
       WHERE id = $1 AND user_id = $2 AND status = 'PENDING'
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đơn PENDING hợp lệ để hủy.' });
    }

    const cancelledBooking = result.rows[0];

    // Phát sự kiện cập nhật thời gian thực qua Socket.io
    notifyBookingUpdate(cancelledBooking.tenant_id, {
      type: 'BOOKING_CANCELLED',
      booking: cancelledBooking,
      date: cancelledBooking.booking_date,
      courtId: cancelledBooking.court_id,
    });

    res.json({
      success: true,
      message: 'Đã hủy đơn giữ chỗ chưa thanh toán thành công.'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi hủy đơn giữ chỗ.' });
  }
};

// 8. LỄ TÂN QUÉT HOẶC NHẬP MÃ QR ĐỂ CHECK-IN NHANH 1 GIÂY
exports.quickCheckIn = async (req, res) => {
  const tenantId = req.tenant.id;
  let code = req.body.code || req.body.codeOrQr; // e.g. "CHECKIN:DS123456" hoặc "DS123456"
  if (!code) {
    return res.status(400).json({ message: 'Vui lòng cung cấp mã vé hoặc quét mã QR.' });
  }

  code = code.trim().replace(/^CHECKIN:/i, '').replace(/^#/, '').trim().toUpperCase();

  try {
    const bookingRes = await db.query(
      `SELECT b.*, c.name AS court_name, u.full_name AS customer_name, u.phone AS customer_phone
       FROM bookings b
       JOIN courts c ON b.court_id = c.id
       LEFT JOIN users u ON b.user_id = u.id
       WHERE (b.booking_code = $1 OR CAST(b.id AS TEXT) = $1) AND b.tenant_id = $2`,
      [code, tenantId]
    );

    if (bookingRes.rows.length === 0) {
      return res.status(404).json({ message: `Không tìm thấy vé đặt sân với mã [${code}] tại cơ sở của bạn.` });
    }

    const b = bookingRes.rows[0];

    if (b.status !== 'CONFIRMED' && b.status !== 'COMPLETED') {
      return res.status(400).json({
        message: `Vé này đang ở trạng thái [${b.status}], chưa thanh toán hoặc đã bị hủy, không thể Check-in.`
      });
    }

    if (b.is_checked_in || b.checked_in_at) {
      const checkInTime = new Date(b.checked_in_at).toLocaleTimeString('vi-VN');
      return res.status(400).json({
        message: `Vé [${b.booking_code}] đã được check-in trước đó vào lúc ${checkInTime}!`
      });
    }

    const now = new Date();
    const startTime = new Date(b.start_time);
    const endTime = new Date(b.end_time);
    const windowStart = new Date(startTime.getTime() - 15 * 60 * 1000);

    if (now < windowStart) {
      const timeStr = windowStart.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
      return res.status(400).json({
        message: `Chưa đến giờ check-in! Ca chơi bắt đầu lúc ${startTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}. Check-in chỉ mở từ 15 phút trước giờ chơi (từ ${timeStr}).`
      });
    }

    if (now > endTime) {
      return res.status(400).json({
        message: `Ca chơi này đã kết thúc lúc ${endTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}, không thể check-in!`
      });
    }

    const updateRes = await db.query(
      `UPDATE bookings
       SET checked_in_at = NOW(), is_checked_in = TRUE, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [b.id, tenantId]
    );

    const updatedBooking = updateRes.rows[0];

    // Phát thông báo thời gian thực qua Socket.io
    notifyBookingUpdate(tenantId, {
      type: 'BOOKING_CHECKED_IN',
      booking: updatedBooking,
      date: updatedBooking.booking_date,
      courtId: updatedBooking.court_id,
    });

    return res.json({
      success: true,
      message: `✓ Check-in thành công cho khách [${b.customer_name || b.walk_in_guest_name || 'Khách'}] - Sân: ${b.court_name}!`,
      booking: {
        ...updatedBooking,
        court_name: b.court_name,
        customer_name: b.customer_name || b.walk_in_guest_name,
        customer_phone: b.customer_phone || b.walk_in_guest_phone
      }
    });
  } catch (error) {
    console.error('Lỗi khi check-in nhanh bằng mã QR:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi thực hiện check-in nhanh.' });
  }
};
// 10. LỄ TÂN / CHỦ SÂN KIỂM TRA & XEM TRƯỚC GIÁ GIA HẠN CA CHƠI
exports.previewExtendBooking = async (req, res) => {
  const { bookingId, durationMinutes } = req.body;
  const tenantId = req.tenant.id;

  if (!bookingId || !durationMinutes || ![30, 60].includes(Number(durationMinutes))) {
    return res.status(400).json({ message: 'Thời gian gia hạn phải là 30 phút hoặc 60 phút.' });
  }

  try {
    const bookingRes = await db.query(
      `SELECT b.*, c.type as court_type, c.name as court_name
       FROM bookings b
       JOIN courts c ON b.court_id = c.id
       WHERE b.id = $1 AND b.tenant_id = $2`,
      [bookingId, tenantId]
    );

    if (bookingRes.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy ca đặt.' });
    }

    const booking = bookingRes.rows[0];
    const currentEnd = new Date(booking.end_time);
    const newEnd = new Date(currentEnd.getTime() + Number(durationMinutes) * 60 * 1000);

    // Kiểm tra trùng lịch với ca khác trên cùng sân
    const conflictRes = await db.query(
      `SELECT id, booking_code, start_time, end_time
       FROM bookings
       WHERE court_id = $1
         AND id != $2
         AND status IN ('CONFIRMED', 'COMPLETED', 'PENDING')
         AND start_time < $3 AND end_time > $4`,
      [booking.court_id, booking.id, newEnd, currentEnd]
    );

    if (conflictRes.rows.length > 0) {
      const conflict = conflictRes.rows[0];
      const conflictStart = new Date(conflict.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      const conflictEnd = new Date(conflict.end_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      return res.status(400).json({
        canExtend: false,
        message: `Không thể gia hạn! Khung giờ tiếp theo [${conflictStart} - ${conflictEnd}] trên sân này đã có ca đặt trước (${conflict.booking_code}).`
      });
    }

    // Lấy bảng giá động của cụm sân
    const rulesRes = await db.query(
      'SELECT * FROM pricing_rules WHERE tenant_id = $1',
      [tenantId]
    );

    const priceCalc = calculateBookingPrice({
      start: currentEnd,
      end: newEnd,
      courtType: booking.court_type,
      pricingRules: rulesRes.rows,
      tenant: req.tenant,
      isVerifiedStudent: Boolean(booking.is_student_applied)
    });

    res.json({
      success: true,
      canExtend: true,
      currentEndTime: booking.end_time,
      newEndTime: newEnd.toISOString(),
      durationMinutes: Number(durationMinutes),
      extraPrice: priceCalc.finalPrice,
      originalExtraPrice: priceCalc.originalPrice,
      courtName: booking.court_name
    });
  } catch (err) {
    console.error('Error previewing extension:', err);
    res.status(500).json({ message: 'Lỗi khi tính toán gia hạn ca chơi.' });
  }
};

// 11. LỄ TÂN / CHỦ SÂN GIA HẠN GIỜ CHƠI 1 CHẠM
exports.extendBooking = async (req, res) => {
  const { bookingId, durationMinutes, paymentMethod = 'CASH' } = req.body;
  const tenantId = req.tenant.id;

  if (!bookingId || !durationMinutes || ![30, 60].includes(Number(durationMinutes))) {
    return res.status(400).json({ message: 'Thời gian gia hạn phải là 30 phút hoặc 60 phút.' });
  }

  try {
    const bookingRes = await db.query(
      `SELECT b.*, c.type as court_type, c.name as court_name
       FROM bookings b
       JOIN courts c ON b.court_id = c.id
       WHERE b.id = $1 AND b.tenant_id = $2`,
      [bookingId, tenantId]
    );

    if (bookingRes.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy ca đặt.' });
    }

    const booking = bookingRes.rows[0];
    const currentEnd = new Date(booking.end_time);
    const newEnd = new Date(currentEnd.getTime() + Number(durationMinutes) * 60 * 1000);

    // Kiểm tra trùng lịch với ca khác trên cùng sân
    const conflictRes = await db.query(
      `SELECT id, booking_code, start_time, end_time
       FROM bookings
       WHERE court_id = $1
         AND id != $2
         AND status IN ('CONFIRMED', 'COMPLETED', 'PENDING')
         AND start_time < $3 AND end_time > $4`,
      [booking.court_id, booking.id, newEnd, currentEnd]
    );

    if (conflictRes.rows.length > 0) {
      return res.status(400).json({
        message: 'Khung giờ tiếp theo đã có người đặt, không thể gia hạn thêm!'
      });
    }

    // Lấy bảng giá
    const rulesRes = await db.query(
      'SELECT * FROM pricing_rules WHERE tenant_id = $1',
      [tenantId]
    );

    const priceCalc = calculateBookingPrice({
      start: currentEnd,
      end: newEnd,
      courtType: booking.court_type,
      pricingRules: rulesRes.rows,
      tenant: req.tenant,
      isVerifiedStudent: Boolean(booking.is_student_applied)
    });

    const updatedBookingRes = await db.query(
      `UPDATE bookings
       SET end_time = $1,
           original_price = original_price + $2,
           discount_applied = discount_applied + $3,
           final_price = final_price + $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [newEnd, priceCalc.originalPrice, priceCalc.discountApplied, priceCalc.finalPrice, booking.id]
    );

    const updatedBooking = updatedBookingRes.rows[0];

    // Phát thông báo thời gian thực qua Socket.io
    notifyBookingUpdate(tenantId, {
      type: 'BOOKING_EXTENDED',
      booking: updatedBooking,
      date: updatedBooking.booking_date,
      courtId: updatedBooking.court_id
    });

    res.json({
      success: true,
      message: `✓ Đã gia hạn thêm ${durationMinutes} phút thành công! Phụ thu: ${Number(priceCalc.finalPrice).toLocaleString()} ₫ (${paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}).`,
      booking: updatedBooking,
      extraPrice: priceCalc.finalPrice,
      paymentMethod
    });
  } catch (err) {
    console.error('Error extending booking:', err);
    res.status(500).json({ message: 'Lỗi máy chủ khi gia hạn ca chơi.' });
  }
};
