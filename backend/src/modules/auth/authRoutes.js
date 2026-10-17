const express = require('express');
const router = express.Router();
const authController = require('./authController');

router.post('/send-otp', authController.sendOTP);
router.post('/register', authController.register);
router.post('/login', authController.login);

module.exports = router;