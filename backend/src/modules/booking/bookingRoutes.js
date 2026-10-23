const express = require('express');
const router = express.Router();
const bookingController = require('./bookingController');
const { verifyToken, optionalAuth, authorizeRoles } = require('../../middlewares/authMiddleware');
const { verifyActiveTenant } = require('../../middlewares/tenantMiddleware');

// Xem lưới lịch Timeline theo ngày của 1 cụm sân (Dùng cho Khách, Khách vãng lai, và Lễ tân)
router.get('/timeline/:tenantId', bookingController.getDailyTimeline);

// Khách xem trước giá tiền (Tự động áp dụng ưu đãi nếu là Sinh viên VERIFIED)
router.post('/preview-price', optionalAuth, bookingController.previewBookingPrice);

// Khách đặt sân trực quan
router.post('/visual', verifyToken, authorizeRoles('USER'), bookingController.createVisualBooking);

// Khách xem lịch sử đặt sân của mình
router.get('/my-bookings', verifyToken, authorizeRoles('USER'), bookingController.getMyBookings);

// Lễ tân / Chủ sân tạo vé Vãng lai (WALK_IN) hoặc Sự kiện (EVENT)
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

module.exports = router;