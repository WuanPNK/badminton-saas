const express = require('express');
const router = express.Router();
const authController = require('./authController');
const { verifyToken } = require('../../middlewares/authMiddleware');

router.post('/send-otp', authController.sendOTP);
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/reset-password', authController.resetPassword);

// Route cập nhật thông tin & đổi mật khẩu khi đã đăng nhập
router.put('/profile', verifyToken, authController.updateProfile);
router.put('/change-password', verifyToken, authController.changePassword);

module.exports = router;