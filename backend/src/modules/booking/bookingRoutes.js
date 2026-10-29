const express = require('express');
const router = express.Router();
const bookingController = require('./bookingController');
const { verifyToken, optionalAuth, authorizeRoles } = require('../../middlewares/authMiddleware');
const { verifyActiveTenant } = require('../../middlewares/tenantMiddleware');

// Xem lưới lịch Timeline theo ngày của 1 cụm sân (Dùng cho Khách đặt online, Sự kiện, và Lễ tân)
router.get('/timeline/:tenantId', bookingController.getDailyTimeline);

// Khách xem trước giá tiền (Tự động áp dụng ưu đãi nếu là Sinh viên VERIFIED)
router.post('/preview-price', optionalAuth, bookingController.previewBookingPrice);

// Khách đặt sân trực quan
router.post('/visual', verifyToken, authorizeRoles('USER'), bookingController.createVisualBooking);

// Khách hủy đơn giữ chỗ chờ thanh toán (khi bấm Đóng / Hủy trên modal VietQR)
router.delete('/:id/cancel-pending', verifyToken, authorizeRoles('USER'), bookingController.cancelPendingBooking);

// Khách xem lịch sử đặt sân của mình
router.get('/my-bookings', verifyToken, authorizeRoles('USER'), bookingController.getMyBookings);

// Lễ tân / Chủ sân tạo vé Sự kiện / Giải đấu (EVENT) - Đặt được nhiều sân, giảm 20% khi > 3 sân
router.post(
  '/staff-create',
  verifyToken,
  authorizeRoles('TENANT_ADMIN', 'STAFF'),
  verifyActiveTenant,
  bookingController.createStaffBooking
);

// Lễ tân / Chủ sân Check-in hoặc Hoàn tất ca chơi (COMPLETE)
router.put(
  '/:id/operation',
  verifyToken,
  authorizeRoles('TENANT_ADMIN', 'STAFF'),
  verifyActiveTenant,
  bookingController.updateBookingOperationStatus
);

// Lễ tân quét hoặc nhập mã QR check-in nhanh 1 giây
router.post(
  '/quick-check-in',
  verifyToken,
  authorizeRoles('TENANT_ADMIN', 'STAFF'),
  verifyActiveTenant,
  bookingController.quickCheckIn
);


// Lễ tân / Chủ sân kiểm tra và xem trước tiền gia hạn ca chơi
router.post(
  '/preview-extend',
  verifyToken,
  authorizeRoles('TENANT_ADMIN', 'STAFF'),
  verifyActiveTenant,
  bookingController.previewExtendBooking
);

// Lễ tân / Chủ sân gia hạn giờ chơi 1 chạm (+30p hoặc +1h)
router.post(
  '/extend',
  verifyToken,
  authorizeRoles('TENANT_ADMIN', 'STAFF'),
  verifyActiveTenant,
  bookingController.extendBooking
);

module.exports = router;