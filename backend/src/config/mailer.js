const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendOTPEmail = async (toEmail, otpCode) => {
  const mailOptions = {
    from: `"Badminton SaaS" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: '[Badminton SaaS] Mã xác thực OTP của bạn',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Mã xác thực đăng ký tài khoản</h2>
        <p>Mã OTP của bạn là: <strong style="font-size: 24px; color: #16a34a;">${otpCode}</strong></p>
        <p>Mã này có hiệu lực trong vòng 5 phút. Vui lòng không chia sẻ mã này cho ai khác.</p>
      </div>
    `,
  };
  return transporter.sendMail(mailOptions);
};

module.exports = { sendOTPEmail };