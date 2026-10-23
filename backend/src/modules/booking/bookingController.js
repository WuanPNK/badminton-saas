const db = require('../../config/db');
const { validateTimeBlocks, calculateBookingPrice } = require('./pricingHelper');

// 1. LẤY DỮ LIỆU LƯỚI THỜI GIAN (TIMELINE GRID) CỦA CỤM SÂN THEO NGÀY
exports.getDailyTimeline = async (req, res) => {
  const { tenantId } = req.params;
  const { date } = req.query; // Định dạng YYYY-MM-DD

  if (!date) {
    return res.status(400).json({ message: 'Vui lòng truyền tham số ngày (date=YYYY-MM-DD).' });
  }

  try {
    // Lấy danh sách sân đã PUBLISHED của cụm sân
    const courtsRes = await db.query(
      `SELECT id, name, type, is_under_maintenance
       FROM courts
       WHERE tenant_id = $1 AND status = 'PUBLISHED'
       ORDER BY name ASC`,
      [tenantId]
    );

    // Lấy tất cả các ca đặt đang giữ chỗ hoặc đã xác nhận trong ngày đó
    const bookingsRes = await db.query(
      `SELECT id, booking_code, court_id, booking_type, start_time, end_time, status,
              walk_in_guest_name, user_id
       FROM bookings
       WHERE tenant_id = $1
         AND booking_date = $2
         AND status IN ('PENDING', 'CONFIRMED', 'COMPLETED')
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

  try {
    const tenantRes = await db.query(`SELECT * FROM tenants WHERE id = $1 AND status = 'ACTIVE'`, [tenantId]);
    const courtRes = await db.query(`SELECT * FROM courts WHERE id = $1 AND tenant_id = $2`, [courtId, tenantId]);
    const rulesRes = await db.query(`SELECT * FROM pricing_rules WHERE tenant_id = $1`, [tenantId]);

    if (tenantRes.rows.length === 0 || courtRes.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin sân.' });
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
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Sân này đang bảo trì, vui lòng chọn sân khác.' });
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

    res.status(201).json({
      success: true,
      message: 'Đã tạo đơn đặt sân. Vui lòng thanh toán 100% tiền sân để hoàn tất xác nhận.',
      booking: insertRes.rows[0]
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

  const checkBlock = validateTimeBlocks(startTime, endTime);
  if (!checkBlock.valid) {
    return res.status(400).json({ message: checkBlock.message });
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const courtRes = await client.query(
      `SELECT * FROM courts WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
      [courtId, tenantId]
    );
    if (courtRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Không tìm thấy sân thuộc cụm sân của bạn.' });
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
      return res.status(409).json({ message: 'Khung giờ này đã bị trùng lịch trên hệ thống!' });
    }

    let finalAmount = Number(customPrice);
    if (!customPrice || isNaN(finalAmount)) {
      const rulesRes = await client.query(`SELECT * FROM pricing_rules WHERE tenant_id = $1`, [tenantId]);
      const calc = calculateBookingPrice({
        start: checkBlock.start,
        end: checkBlock.end,
        courtType: courtRes.rows[0].type,
        pricingRules: rulesRes.rows,
        tenant: req.tenant,
        isVerifiedStudent: false
      });
      finalAmount = calc.finalPrice;
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
        courtId,
        bookingType,
        guestName || 'Khách vãng lai',
        guestPhone || '',
        staffId,
        bookingDate,
        checkBlock.start,
        checkBlock.end,
        finalAmount
      ]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: `Đã tạo lịch ${bookingType === 'EVENT' ? 'Sự kiện' : 'Vãng lai'} thành công!`,
      booking: insertRes.rows[0]
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
              EXISTS(SELECT 1 FROM reviews r WHERE r.booking_id = b.id) AS has_reviewed
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
      const result = await db.query(
        `UPDATE bookings
         SET checked_in_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2 AND status = 'CONFIRMED'
         RETURNING *`,
        [id, tenantId]
      );
      if (result.rows.length === 0) {
        return res.status(400).json({ message: 'Không tìm thấy đơn CONFIRMED hợp lệ để Check-in.' });
      }
      return res.json({ success: true, message: 'Khách đã Check-in nhận sân!', booking: result.rows[0] });
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
      return res.json({
        success: true,
        message: 'Đã hoàn tất ca sân! Khách hàng hiện đã có thể đánh giá sân.',
        booking: result.rows[0]
      });
    }

    res.status(400).json({ message: 'Hành động không hợp lệ.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi cập nhật trạng thái vận hành sân.' });
  }
};