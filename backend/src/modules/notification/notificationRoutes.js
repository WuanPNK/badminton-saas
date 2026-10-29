const express = require('express');
const router = express.Router();
const notificationController = require('./notificationController');
const { verifyToken } = require('../../middlewares/authMiddleware');

// Tất cả các route thông báo đều yêu cầu đăng nhập
router.use(verifyToken);

router.get('/', notificationController.getMyNotifications);
router.put('/read-all', notificationController.markAllAsRead);
router.put('/:id/read', notificationController.markAsRead);
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;

