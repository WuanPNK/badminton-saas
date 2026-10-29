const express = require('express');
const router = express.Router();
const shiftController = require('./shiftController');
const { verifyToken, authorizeRoles } = require('../../middlewares/authMiddleware');
const { verifyActiveTenant } = require('../../middlewares/tenantMiddleware');

// Lấy danh sách ca trực của cụm sân (Lễ tân và Chủ sân đều xem được)
router.get(
  '/',
  verifyToken,
  authorizeRoles('TENANT_ADMIN', 'STAFF'),
  verifyActiveTenant,
  shiftController.getTenantShifts
);

// Kiểm tra quyền vào ca trực hiện tại của nhân viên
router.get(
  '/my-status',
  verifyToken,
  authorizeRoles('TENANT_ADMIN', 'STAFF'),
  verifyActiveTenant,
  shiftController.checkStaffShiftAccess
);

// Báo cáo chấm công & hiệu suất lễ tân theo ca trực (Chủ sân)
router.get(
  '/staff-analytics',
  verifyToken,
  authorizeRoles('TENANT_ADMIN'),
  verifyActiveTenant,
  shiftController.getStaffShiftAnalytics
);

// Chủ sân tạo ca trực mới & phân công nhân sự
router.post(
  '/',
  verifyToken,
  authorizeRoles('TENANT_ADMIN'),
  verifyActiveTenant,
  shiftController.createTenantShift
);

// Chủ sân cập nhật ca trực & phân công nhân sự
router.put(
  '/:id',
  verifyToken,
  authorizeRoles('TENANT_ADMIN'),
  verifyActiveTenant,
  shiftController.updateTenantShift
);

// Phân công nhanh nhân sự 1 chạm vào ca trực
router.patch(
  '/:id/assign',
  verifyToken,
  authorizeRoles('TENANT_ADMIN'),
  verifyActiveTenant,
  shiftController.assignShiftStaff
);

// Chủ sân xóa ca trực
router.delete(
  '/:id',
  verifyToken,
  authorizeRoles('TENANT_ADMIN'),
  verifyActiveTenant,
  shiftController.deleteTenantShift
);

// Lễ tân / Chủ sân xem tổng hợp tài chính ca trực thời gian thực
router.get(
  '/summary',
  verifyToken,
  authorizeRoles('TENANT_ADMIN', 'STAFF'),
  verifyActiveTenant,
  shiftController.getShiftFinancialSummary
);

// Lễ tân nộp biên bản chốt ca & bàn giao
router.post(
  '/handover',
  verifyToken,
  authorizeRoles('TENANT_ADMIN', 'STAFF'),
  verifyActiveTenant,
  shiftController.submitShiftHandover
);

// Xem lịch sử các biên bản chốt ca (Chủ sân và Lễ tân)
router.get(
  '/handovers',
  verifyToken,
  authorizeRoles('TENANT_ADMIN', 'STAFF'),
  verifyActiveTenant,
  shiftController.getShiftHandovers
);

module.exports = router;
