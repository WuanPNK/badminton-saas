const express = require('express');
const router = express.Router();
const superAdminController = require('./superAdminController');
const { verifyToken, authorizeRoles } = require('../../middlewares/authMiddleware');

// Tất cả các route này chỉ dành riêng cho SUPER_ADMIN
router.use(verifyToken, authorizeRoles('SUPER_ADMIN'));

router.get('/pending-approvals', superAdminController.getPendingApprovals);
router.put('/tenants/:id/status', superAdminController.updateTenantStatus);
router.put('/courts/:id/status', superAdminController.updateCourtStatus);
router.put('/students/:userId/verify', superAdminController.verifyStudentStatus);
router.get('/dashboard', superAdminController.getPlatformDashboard);
router.post('/subscriptions/record', superAdminController.recordTenantSubscription);

module.exports = router;