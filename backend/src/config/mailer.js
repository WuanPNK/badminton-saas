const nodemailer = require('nodemailer');
require('dotenv').config();

const getTransporter = () => {
  // Tự động reload lại .env nếu có thay đổi mà không cần restart toàn bộ
  require('dotenv').config();
  const user = (process.env.EMAIL_USER || '').trim();
  const pass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: user,
      pass: pass,
    },
  });
};

/**
 * Gửi email chứa mã OTP xác thực (dùng chung cho cả Đăng ký và Khôi phục mật khẩu)
 * @param {string} toEmail - Địa chỉ email người nhận (chính là email tài khoản)
 * @param {string} otpCode - Mã xác thực 6 chữ số
 * @param {string} purpose - 'REGISTER' | 'RESET_PASSWORD'
 */
const sendOTPEmail = async (toEmail, otpCode, purpose = 'REGISTER') => {
  const isReset = purpose === 'RESET_PASSWORD';

  const subject = isReset
    ? '[BadmintonHub] Mã OTP khôi phục mật khẩu của bạn'
    : '[BadmintonHub] Mã OTP xác thực đăng ký tài khoản';

  const titleText = isReset
    ? 'Khôi Phục Mật Khẩu Tài Khoản'
    : 'Xác Thực Email Tạo Tài Khoản Mới';

  const introText = isReset
    ? 'Bạn nhận được email này vì đã gửi yêu cầu đặt lại mật khẩu cho tài khoản sử dụng email này tại nền tảng <strong>BadmintonHub</strong>.'
    : 'Chào mừng bạn đến với <strong>BadmintonHub</strong>! Vui lòng sử dụng mã xác thực dưới đây để hoàn tất việc đăng ký tài khoản.';

  const mailOptions = {
    from: `"BadmintonHub" <${process.env.EMAIL_USER}>`,
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
                    <h1 style="color: #ffffff; font-size: 20px; font-weight: 800; margin: 0; letter-spacing: 0.5px;">BADMINTONHUB</h1>
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
                        (Mã có hiệu lực trong vòng <strong style="color: #0f172a;">10 phút</strong> kể từ lúc gửi)
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
                      Email tự động được gửi từ nền tảng <strong>BadmintonHub</strong>.<br>
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

  const transporter = getTransporter();
  console.log(`[EMAIL] Đang gửi OTP ${otpCode} đến ${toEmail} qua tài khoản: ${process.env.EMAIL_USER}`);
  const result = await transporter.sendMail(mailOptions);
  console.log(`[EMAIL] ✓ Đã gửi email thành công! MessageId: ${result.messageId}`);
  return result;
};

/**
 * Gửi email xác nhận đặt sân thành công kèm Mã QR Check-in độc quyền
 */
const QRCode = require('qrcode');

const sendBookingTicketEmail = async ({
  toEmail,
  customerName,
  booking,
  tenant,
  court,
}) => {
  try {
    if (!toEmail) return null;

    // Sinh mã QR dưới dạng Data URL (nhúng trực tiếp vào thẻ <img> của email HTML)
    const qrData = `CHECKIN:${booking.booking_code}`;
    const qrDataUrl = await QRCode.toDataURL(qrData, {
      width: 260,
      margin: 2,
      color: {
        dark: '#065f46',
        light: '#ffffff',
      },
    });

    const startTimeStr = new Date(booking.start_time).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const endTimeStr = new Date(booking.end_time).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const dateStr = new Date(booking.booking_date).toLocaleDateString('vi-VN');

    const subject = `[BadmintonHub] Xác nhận vé đặt sân #${booking.booking_code} - ${tenant.name}`;

    const mailOptions = {
      from: `"BadmintonHub" <${process.env.EMAIL_USER}>`,
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
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0;">
                  <!-- Header Banner -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #065f46 0%, #047857 50%, #0d9488 100%); padding: 32px 30px; text-align: center; color: #ffffff;">
                      <div style="font-size: 38px; margin-bottom: 8px;">🏸</div>
                      <h1 style="margin: 0; font-size: 22px; font-weight: 900; letter-spacing: -0.5px;">VÉ ĐẶT SÂN CẦU LÔNG</h1>
                      <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9; color: #a7f3d0;">
                        Thanh toán thành công • Lịch đã được xác nhận
                      </p>
                    </td>
                  </tr>

                  <!-- Nội dung chính -->
                  <tr>
                    <td style="padding: 32px 30px;">
                      <p style="font-size: 15px; color: #1e293b; margin: 0 0 18px 0; font-weight: 600;">
                        Xin chào <strong>${customerName || 'Quý khách'}</strong>,
                      </p>
                      <p style="font-size: 13px; color: #475569; margin: 0 0 24px 0; line-height: 1.6;">
                        Đơn đặt sân của bạn tại <strong>${tenant.name}</strong> đã được thanh toán 100% và giữ chỗ thành công. Dưới đây là thông tin vé và mã QR để làm thủ tục check-in tại quầy:
                      </p>

                      <!-- BẢNG CHI TIẾT VÉ SÂN -->
                      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; margin-bottom: 24px;">
                        <tr>
                          <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
                            <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; display: block; margin-bottom: 4px;">Mã đặt sân:</span>
                            <span style="font-size: 18px; font-weight: 900; font-family: monospace; color: #047857;">#${booking.booking_code}</span>
                          </td>
                          <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; text-align: right;">
                            <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; display: block; margin-bottom: 4px;">Tổng tiền đã trả:</span>
                            <span style="font-size: 16px; font-weight: 900; color: #0f172a;">${Number(booking.final_price).toLocaleString()} ₫</span>
                          </td>
                        </tr>
                        <tr>
                          <td colspan="2" style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
                            <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; display: block; margin-bottom: 4px;">Cụm sân thi đấu:</span>
                            <strong style="font-size: 14px; color: #0f172a;">${tenant.name}</strong>
                            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">📍 ${tenant.address || ''} (Quận ${tenant.district || ''})</div>
                            ${tenant.phone_contact ? `<div style="font-size: 12px; color: #64748b; margin-top: 2px;">📞 Hotline: ${tenant.phone_contact}</div>` : ''}
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 14px 20px;">
                            <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; display: block; margin-bottom: 4px;">Sân đấu:</span>
                            <strong style="font-size: 14px; color: #0f172a;">${court.name}</strong> (${court.type === 'VIP' ? 'Sân VIP' : 'Sân Tiêu chuẩn'})
                          </td>
                          <td style="padding: 14px 20px; text-align: right;">
                            <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; display: block; margin-bottom: 4px;">Khung giờ:</span>
                            <strong style="font-size: 14px; color: #047857;">${startTimeStr} → ${endTimeStr}</strong>
                            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Ngày ${dateStr}</div>
                          </td>
                        </tr>
                      </table>

                      <!-- HỘP MÃ QR CHECK-IN ĐỘC QUYỀN -->
                      <div style="text-align: center; background: linear-gradient(180deg, #ecfdf5 0%, #f0fdf4 100%); border: 2px dashed #10b981; border-radius: 16px; padding: 24px 20px; margin-bottom: 24px;">
                        <span style="display: inline-block; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #065f46; background: #d1fae5; padding: 4px 12px; border-radius: 999px; margin-bottom: 12px;">
                          📍 MÃ QR CHECK-IN NHẬN SÂN
                        </span>
                        <div>
                          <img src="${qrDataUrl}" width="200" height="200" alt="Mã QR Check-In" style="display: block; margin: 0 auto; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.06); background: #ffffff; padding: 6px;" />
                        </div>
                        <div style="font-family: monospace; font-size: 16px; font-weight: 900; color: #065f46; margin-top: 10px;">
                          #${booking.booking_code}
                        </div>
                        <p style="font-size: 12px; color: #047857; margin: 8px 0 0 0; line-height: 1.5; font-weight: 500;">
                          Xuất trình mã QR này hoặc đọc mã vé tại quầy Lễ tân khi đến sân.<br>
                          (Nút check-in sẽ mở trong khoảng 15 phút trước giờ chơi).
                        </p>
                      </div>

                      <!-- QUY ĐỊNH HỦY HOÀN TIỀN & ĐÁNH GIÁ -->
                      <div style="background-color: #f8fafc; border-left: 4px solid #059669; padding: 14px 16px; border-radius: 8px; font-size: 12px; color: #334155; line-height: 1.6;">
                        <strong style="color: #065f46;">📋 Lưu ý quan trọng:</strong>
                        <ul style="margin: 6px 0 0 0; padding-left: 18px;">
                          <li><strong>Hoàn tiền 100%:</strong> Bạn có thể hủy lịch bất kỳ lúc nào trước giờ chơi ít nhất <strong>24 tiếng</strong> để nhận hoàn tiền 100% về tài khoản ngân hàng.</li>
                          <li><strong>Đánh giá sân:</strong> Chỉ những khách hàng <strong>thực tế đã đến check-in ca chơi</strong> mới được viết đánh giá trên sàn website.</li>
                          <li>Vui lòng mang giày thể thao đế mềm chuyên dụng để bảo vệ mặt thảm thi đấu.</li>
                        </ul>
                      </div>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                      <p style="color: #94a3b8; font-size: 11px; margin: 0; line-height: 1.6;">
                        Email tự động xác nhận đơn đặt từ <strong>BadmintonHub</strong>.<br>
                        Chúc bạn có một buổi thi đấu cầu lông tuyệt vời và tràn đầy năng lượng!
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

    const transporter = getTransporter();
    console.log(`[EMAIL TICKET] Đang gửi vé #${booking.booking_code} đến ${toEmail}...`);
    const result = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL TICKET] ✓ Đã gửi vé đặt sân thành công! MessageId: ${result.messageId}`);
    return result;
  } catch (err) {
    console.error('[EMAIL TICKET] Lỗi khi gửi vé đặt sân:', err);
    return null;
  }
};

module.exports = { sendOTPEmail, sendBookingTicketEmail };