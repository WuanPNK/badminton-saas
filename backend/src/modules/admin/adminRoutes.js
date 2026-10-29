const express = require('express');
const router = express.Router();
const adminController = require('./adminController');
const { verifyToken, authorizeRoles } = require('../../middlewares/authMiddleware');

// Tất cả các route này chỉ dành riêng cho ADMIN
router.use(verifyToken, authorizeRoles('ADMIN', 'SUPER_ADMIN'));

router.get('/pending-approvals', adminController.getPendingApprovals);
router.put('/tenants/:id/status', adminController.updateTenantStatus);
router.put('/courts/:id/status', adminController.updateCourtStatus);
router.put('/students/:userId/verify', adminController.verifyStudentStatus);
router.get('/all-tenants', adminController.getAllTenants);

router.get('/plans', adminController.getPlans);
router.post('/plans', adminController.createPlan);
router.put('/plans/:id', adminController.updatePlan);
router.delete('/plans/:id', adminController.deletePlan);

router.get('/dashboard', adminController.getPlatformDashboard);
router.get('/revenue-export', adminController.getAdminRevenueExport);
router.post('/subscriptions/record', adminController.recordTenantSubscription);
router.get('/subscriptions/pending', adminController.getPendingSubscriptions);
router.put('/subscriptions/:id/approve', adminController.approveSubscription);
router.put('/subscriptions/:id/reject', adminController.rejectSubscription);

module.exports = router;