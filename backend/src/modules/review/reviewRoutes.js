const express = require('express');
const router = express.Router();
const reviewController = require('./reviewController');
const { verifyToken, authorizeRoles } = require('../../middlewares/authMiddleware');

// Khách hàng gửi đánh giá (Yêu cầu đăng nhập role USER)
router.post('/', verifyToken, authorizeRoles('USER'), reviewController.createReview);

// Xem danh sách đánh giá của 1 cụm sân
router.get('/tenant/:tenantId', verifyToken, reviewController.getTenantReviews);

module.exports = router;