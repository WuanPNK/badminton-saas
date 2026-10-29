const express = require('express');
const router = express.Router();
const posController = require('./posController');
const { verifyToken, authorizeRoles } = require('../../middlewares/authMiddleware');
const { verifyActiveTenant, requireFeatureToggle } = require('../../middlewares/tenantMiddleware');

// Báo cáo doanh thu tổng hợp cho Chủ sân
router.get(
  '/analytics',
  verifyToken,
  authorizeRoles('TENANT_ADMIN'),
  verifyActiveTenant,
  posController.getTenantAnalytics
);

// Tất cả các API POS bên dưới đều yêu cầu Chủ sân phải bật công tắc "enable_pos_module"
router.use(
  verifyToken,
  authorizeRoles('TENANT_ADMIN', 'STAFF'),
  verifyActiveTenant,
  requireFeatureToggle('enable_pos_module')
);

router.get('/products', posController.getProducts);
router.post('/products', authorizeRoles('TENANT_ADMIN'), posController.createProduct);
router.put('/products/:productId', authorizeRoles('TENANT_ADMIN'), posController.updateProduct);
router.delete('/products/:productId', authorizeRoles('TENANT_ADMIN'), posController.deleteProduct);

router.post('/orders', posController.createPosOrder);
router.get('/orders', posController.getPosOrders);
router.put('/orders/:orderId', posController.updatePosOrder);
router.put('/orders/:orderId/cancel', posController.cancelPosOrder);

module.exports = router;