const express = require('express');
const router = express.Router();
const tenantController = require('./tenantController');
const { verifyToken, authorizeRoles } = require('../../middlewares/authMiddleware');
const { verifyActiveTenant } = require('../../middlewares/tenantMiddleware');

// --- ROUTES DÀNH CHO KHÁCH HÀNG XEM MARKETPLACE ---
router.get('/marketplace', verifyToken, tenantController.getMarketplaceTenants);
router.get('/marketplace/:id', verifyToken, tenantController.getTenantPublicDetail);

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
  '/courts/:courtId/maintenance',
  verifyToken,
  authorizeRoles('TENANT_ADMIN'),
  verifyActiveTenant,
  tenantController.toggleCourtMaintenance
);

router.post(
  '/pricing-rules',
  verifyToken,
  authorizeRoles('TENANT_ADMIN'),
  verifyActiveTenant,
  tenantController.createPricingRule
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

module.exports = router;