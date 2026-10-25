const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Gửi email chứa mã OTP xác thực (dùng chung cho cả Đăng ký và Khôi phục mật khẩu)
 * @param {string} toEmail - Địa chỉ email người nhận (chính là email tài khoản)
 * @param {string} otpCode - Mã xác thực 6 chữ số
 * @param {string} purpose - 'REGISTER' | 'RESET_PASSWORD'
 */
const sendOTPEmail = async (toEmail, otpCode, purpose = 'REGISTER') => {
  const isReset = purpose === 'RESET_PASSWORD';

  const subject = isReset
    ? '[Badminton SaaS] Mã OTP khôi phục mật khẩu của bạn'
    : '[Badminton SaaS] Mã OTP xác thực đăng ký tài khoản';

  const titleText = isReset
    ? 'Khôi Phục Mật Khẩu Tài Khoản'
    : 'Xác Thực Email Tạo Tài Khoản Mới';

  const introText = isReset
    ? 'Bạn nhận được email này vì đã gửi yêu cầu đặt lại mật khẩu cho tài khoản sử dụng email này tại nền tảng <strong>Badminton SaaS</strong>.'
    : 'Chào mừng bạn đến với <strong>Badminton SaaS Portal</strong>! Vui lòng sử dụng mã xác thực dưới đây để hoàn tất việc đăng ký tài khoản.';

  const mailOptions = {
    from: `"Badminton SaaS Portal" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: subject,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 15px;">
          <tr>
            <td align="center">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
                <!-- Header Banner -->
                <tr>
                  <td style="background: linear-gradient(135deg, #059669 0%, #065f46 100%); padding: 28px 30px; text-align: center;">
                    <div style="font-size: 32px; margin-bottom: 6px;">🏸</div>
                    <h1 style="color: #ffffff; font-size: 20px; font-weight: 800; margin: 0; letter-spacing: 0.5px;">BADMINTON SAAS PORTAL</h1>
                    <p style="color: #a7f3d0; font-size: 12px; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Hệ Thống Đặt Lịch Sân & Quản Trị Đa Cụm Sân</p>
                  </td>
                </tr>

                <!-- Content Body -->
                <tr>
                  <td style="padding: 32px 30px;">
                    <h2 style="color: #0f172a; font-size: 17px; font-weight: 700; margin: 0 0 12px 0;">
                      ${titleText}
                    </h2>
                    
                    <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                      ${introText}
                    </p>

                    <!-- Khung OTP Box -->
                    <div style="background-color: #f0fdf4; border: 2px dashed #10b981; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
                      <p style="margin: 0 0 6px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #047857; font-weight: 800;">
                        MÃ XÁC THỰC OTP CỦA BẠN
                      </p>
                      <div style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #065f46; margin: 8px 0;">
                        ${otpCode}
                      </div>
                      <p style="margin: 6px 0 0 0; font-size: 12px; color: #64748b;">
                        (Mã có hiệu lực trong vòng <strong style="color: #0f172a;">5 phút</strong> kể từ lúc gửi)
                      </p>
                    </div>

                    <!-- Security Notice -->
                    <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; font-size: 12px; color: #92400e; line-height: 1.5; margin: 20px 0 0 0;">
                      <strong>⚠️ Lưu ý an toàn:</strong> Tuyệt đối không chia sẻ mã này cho bất kỳ ai khác. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email và đổi mật khẩu tài khoản ngay lập tức.
                    </div>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 18px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="color: #94a3b8; font-size: 11px; margin: 0; line-height: 1.5;">
                      Email tự động được gửi từ nền tảng <strong>Badminton SaaS Portal</strong>.<br>
                      Vui lòng không phản hồi trực tiếp thư này.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  };

  return transporter.sendMail(mailOptions);
};

module.exports = { sendOTPEmail };