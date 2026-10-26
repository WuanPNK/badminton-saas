const db = require('../../config/db');
const { validateTimeBlocks, calculateBookingPrice } = require('./pricingHelper');
const { notifyBookingUpdate } = require('../../config/socket');

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
      `SELECT id, booking_code, court_id, booking_type, start_time, end_time, status,
              walk_in_guest_name, walk_in_guest_phone, user_id, checked_in_at, is_checked_in, final_price
       FROM bookings
       WHERE tenant_id = $1
         AND booking_date = $2
         AND (status IN ('CONFIRMED', 'COMPLETED') OR (status = 'PENDING' AND created_at >= NOW() - INTERVAL '15 minutes'))
       ORDER BY start_time ASC`,
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
  const { tenantId, courtId, startTime, endTime } = req.body;

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

exports.createStaffBooking = async (req, res) => {
  const tenantId = req.tenant.id;
  const staffId = req.user.id;
  const {
    courtId,
    courtIds,
    bookingType,
    guestName,
    guestPhone,
    bookingDate,
    startTime,
    endTime,
    customPrice
  } = req.body;

  if (!['WALK_IN', 'EVENT'].includes(bookingType)) {
    return res.status(400).json({ message: 'Loại vé phải là WALK_IN (Vãng lai) hoặc EVENT (Sự kiện).' });
  }

  // Cho phép nhiều sân khi chọn EVENT
  const targetCourtIds = (bookingType === 'EVENT' && Array.isArray(courtIds) && courtIds.length > 0)
    ? courtIds
    : [courtId].filter(Boolean);

  if (targetCourtIds.length === 0) {
    return res.status(400).json({ message: 'Vui lòng chọn ít nhất 1 sân.' });
  }

  const checkBlock = validateTimeBlocks(startTime, endTime);
  if (!checkBlock.valid) {
    return res.status(400).json({ message: checkBlock.message });
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const rulesRes = await client.query(`SELECT * FROM pricing_rules WHERE tenant_id = $1`, [tenantId]);
    const createdBookings = [];

    const parsedCustomPrice = customPrice !== undefined && customPrice !== '' ? Number(customPrice) : null;
    const pricePerCourt = parsedCustomPrice !== null && !isNaN(parsedCustomPrice)
      ? Math.round(parsedCustomPrice / targetCourtIds.length)
      : null;

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

      let courtFinalAmount = pricePerCourt;
      if (courtFinalAmount === null) {
        const calc = calculateBookingPrice({
          start: checkBlock.start,
          end: checkBlock.end,
          courtType: court.type,
          pricingRules: rulesRes.rows,
          tenant: req.tenant,
          isVerifiedStudent: false
        });
        courtFinalAmount = calc.finalPrice;
      }

      const prefix = bookingType === 'EVENT' ? 'EV' : 'WL';
      const bookingCode = prefix + Math.floor(100000 + Math.random() * 900000);

      const insertRes = await client.query(
        `INSERT INTO bookings (
          booking_code, tenant_id, court_id, booking_type,
          walk_in_guest_name, walk_in_guest_phone, created_by_staff_id,
          booking_date, start_time, end_time,
          original_price, discount_applied, final_price, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, $11, 'CONFIRMED')
        RETURNING *`,
        [
          bookingCode,
          tenantId,
          cId,
          bookingType,
          guestName || (bookingType === 'EVENT' ? 'Sự Kiện / Giải Đấu' : 'Khách vãng lai'),
          guestPhone || '',
          staffId,
          bookingDate,
          checkBlock.start,
          checkBlock.end,
          courtFinalAmount
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

    res.status(201).json({
      success: true,
      message: `Đã tạo lịch ${bookingType === 'EVENT' ? `Sự kiện (${createdBookings.length} sân)` : 'Vãng lai'} thành công!`,
      bookings: createdBookings,
      booking: createdBookings[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Lỗi khi tạo lịch trực tiếp tại sân:', error);
    res.status(500).json({ message: 'Lỗi khi tạo lịch trực tiếp tại sân.' });
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
  const { action } = req.body; // 'CHECK_IN' hoặc 'COMPLETE'
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
  let { code } = req.body; // e.g. "CHECKIN:DS123456" hoặc "DS123456"
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