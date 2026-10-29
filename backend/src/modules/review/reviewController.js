const { notifyTenantStaffAndOwner } = require('../notification/notificationService');
const db = require('../../config/db');

// 1. KHÁCH HÀNG GỬI ĐÁNH GIÁ SÂN (CHỈ CHO PHÉP ĐƠN ĐÃ COMPLETED)
exports.createReview = async (req, res) => {
  const userId = req.user.id;
  const { bookingId, rating, comment } = req.body;

  if (!bookingId || !rating || rating < 1 || rating > 5) {
    return res.status(400).json({
      message: 'Vui lòng chọn số sao đánh giá hợp lệ (từ 1 đến 5 sao).'
    });
  }

  try {
    // Kiểm tra đơn hàng có thuộc về khách này, đã hoàn tất và ĐÃ CHECK-IN
    const bookingRes = await db.query(
      `SELECT id, tenant_id, user_id, status, end_time, is_checked_in, checked_in_at
       FROM bookings
       WHERE id = $1 AND user_id = $2`,
      [bookingId, userId]
    );

    if (bookingRes.rows.length === 0) {
      return res.status(404).json({
        message: 'Không tìm thấy đơn đặt sân hợp lệ của bạn.'
      });
    }

    const booking = bookingRes.rows[0];

    // Kiểm tra ca chơi đã kết thúc chưa
    const isPastEndTime = new Date(booking.end_time) <= new Date();
    if (booking.status !== 'COMPLETED' && !isPastEndTime) {
      return res.status(403).json({
        message: 'Ca chơi của bạn chưa hoàn tất. Vui lòng quay lại đánh giá sau khi ca chơi kết thúc!'
      });
    }

    // ĐIỀU KIỆN QUAN TRỌNG: Khách phải thực tế đến sân Check-in thì mới được viết đánh giá!
    if (!booking.is_checked_in && !booking.checked_in_at) {
      return res.status(403).json({
        message: 'Bạn chỉ có thể đánh giá cụm sân khi đã thực tế đến sân check-in ca chơi này.'
      });
    }

    // Kiểm tra xem đơn này đã được đánh giá trước đó chưa
    const existReview = await db.query(
      `SELECT id FROM reviews WHERE booking_id = $1`,
      [bookingId]
    );

    if (existReview.rows.length > 0) {
      return res.status(400).json({
        message: 'Bạn đã gửi đánh giá cho ca đặt sân này rồi.'
      });
    }

    const insertRes = await db.query(
      `INSERT INTO reviews (tenant_id, user_id, booking_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [booking.tenant_id, userId, bookingId, Number(rating), comment || '']
    );

    res.status(201).json({
      success: true,
      message: 'Cảm ơn bạn đã đánh giá cụm sân!',
      review: insertRes.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi gửi đánh giá sân.' });
  }
};

// 2. LẤY DANH SÁCH ĐÁNH GIÁ CỦA 1 CỤM SÂN
exports.getTenantReviews = async (req, res) => {
  const { tenantId } = req.params;

  try {
    const result = await db.query(
      `SELECT r.id, r.rating, r.comment, r.created_at,
              u.full_name AS user_name,
              c.name AS court_name
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       JOIN bookings b ON r.booking_id = b.id
       JOIN courts c ON b.court_id = c.id
       WHERE r.tenant_id = $1
       ORDER BY r.created_at DESC`,
      [tenantId]
    );

    res.json({ success: true, reviews: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi tải danh sách đánh giá.' });
  }
};