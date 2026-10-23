const express = require('express');
const router = express.Router();
const tenantController = require('./tenantController');
const { verifyToken, authorizeRoles } = require('../../middlewares/authMiddleware');
const { verifyActiveTenant } = require('../../middlewares/tenantMiddleware');

// --- ROUTES DÀNH CHO KHÁCH HÀNG XEM MARKETPLACE ---
router.get('/marketplace', tenantController.getMarketplaceTenants);
router.get('/marketplace/:id', tenantController.getTenantPublicDetail);

// --- ROUTES DÀNH CHO CHỦ SÂN & LỄ TÂN XEM CẤU HÌNH ---
router.get(
  '/my-settings',
  verifyToken,
  authorizeRoles('TENANT_ADMIN', 'STAFF'),
  verifyActiveTenant,
  tenantController.getMyTenantSettings
);

router.get(
  '/courts',
  verifyToken,
  authorizeRoles('TENANT_ADMIN', 'STAFF'),
  verifyActiveTenant,
  tenantController.getMyCourts
);

router.get(
  '/pricing-rules',
  verifyToken,
  authorizeRoles('TENANT_ADMIN', 'STAFF'),
  verifyActiveTenant,
  tenantController.getMyPricingRules
);

// --- ROUTES CHỈ DÀNH RIÊNG CHO CHỦ SÂN (TENANT_ADMIN) ---
router.put(
  '/my-settings',
  verifyToken,
  authorizeRoles('TENANT_ADMIN'),
  verifyActiveTenant,
  tenantController.updateTenantSettings
);

router.post(
  '/courts',
  verifyToken,
  authorizeRoles('TENANT_ADMIN'),
  verifyActiveTenant,
  tenantController.createCourt
);

router.put(
  '/courts/:courtId',
  verifyToken,
  authorizeRoles('TENANT_ADMIN'),
  verifyActiveTenant,
  tenantController.updateCourt
);

router.delete(
  '/courts/:courtId',
  verifyToken,
  authorizeRoles('TENANT_ADMIN'),
  verifyActiveTenant,
  tenantController.deleteCourt
);

router.put(
  '/courts/:courtId/maintenance',
  verifyToken,
  authorizeRoles('TENANT_ADMIN'),
  verifyActiveTenant,
  tenantController.scheduleCourtMaintenance
);

router.post(
  '/pricing-rules',
  verifyToken,
  authorizeRoles('TENANT_ADMIN'),
  verifyActiveTenant,
  tenantController.createPricingRule
);

router.put(
  '/pricing-rules/:ruleId',
  verifyToken,
  authorizeRoles('TENANT_ADMIN'),
  verifyActiveTenant,
  tenantController.updatePricingRule
);

router.delete(
  '/pricing-rules/:ruleId',
  verifyToken,
  authorizeRoles('TENANT_ADMIN'),
  verifyActiveTenant,
  tenantController.deletePricingRule
);

router.post(
  '/staff',
  verifyToken,
  authorizeRoles('TENANT_ADMIN'),
  verifyActiveTenant,
  tenantController.createStaffAccount
);

router.get(
  '/staff',
  verifyToken,
  authorizeRoles('TENANT_ADMIN'),
  verifyActiveTenant,
  tenantController.getMyStaffList
);

router.put(
  '/staff/:id',
  verifyToken,
  authorizeRoles('TENANT_ADMIN'),
  verifyActiveTenant,
  tenantController.updateStaffAccount
);

router.delete(
  '/staff/:id',
  verifyToken,
  authorizeRoles('TENANT_ADMIN'),
  verifyActiveTenant,
  tenantController.deleteStaffAccount
);

router.get(
  '/reviews',
  verifyToken,
  authorizeRoles('TENANT_ADMIN'),
  verifyActiveTenant,
  tenantController.getMyReviews
);

router.put(
  '/venue-details',
  verifyToken,
  authorizeRoles('TENANT_ADMIN'),
  verifyActiveTenant,
  tenantController.updateVenueDetails
);

module.exports = router;