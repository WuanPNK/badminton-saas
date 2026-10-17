const express = require('express');
const router = express.Router();
const paymentController = require('./paymentController');
const { verifyToken, authorizeRoles } = require('../../middlewares/authMiddleware');
const { verifyActiveTenant } = require('../../middlewares/tenantMiddleware');

// Khách lấy mã VietQR & thông tin thanh toán của đơn hàng
router.get('/:bookingId/info', verifyToken, authorizeRoles('USER'), paymentController.getBookingPaymentInfo);

// Khách bấm nút "Mô phỏng: Đã chuyển khoản 100%"
router.put('/:bookingId/pay-mock', verifyToken, authorizeRoles('USER'), paymentController.mockConfirmPayment);

// Khách bấm "Hủy sân" (trước 24h) và gửi STK nhận tiền hoàn
router.put('/:bookingId/cancel-refund', verifyToken, authorizeRoles('USER'), paymentController.cancelBookingRequestRefund);

// Lễ tân / Chủ sân xem danh sách chờ hoàn tiền (PENDING_REFUND)
router.get(
  '/refund-requests',
  verifyToken,
  authorizeRoles('TENANT_ADMIN', 'STAFF'),
  verifyActiveTenant,
  paymentController.getTenantRefundRequests
);

// Lễ tân / Chủ sân bấm xác nhận "Đã hoàn tiền" (REFUNDED)
router.put(
  '/:bookingId/confirm-refund',
  verifyToken,
  authorizeRoles('TENANT_ADMIN', 'STAFF'),
  verifyActiveTenant,
  paymentController.markBookingRefunded
);

module.exports = router;