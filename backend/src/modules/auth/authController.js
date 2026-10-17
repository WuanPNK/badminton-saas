const db = require('../../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendOTPEmail } = require('../../config/mailer');

// 1. GỬI MÃ OTP VỀ EMAIL
exports.sendOTP = async (req, res) => {
  const { email, purpose } = req.body;
  if (!email) return res.status(400).json({ message: 'Vui lòng nhập email.' });

  try {
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 phút

    await db.query(
      `INSERT INTO otp_verifications (email, otp_code, purpose, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [email, otpCode, purpose || 'REGISTER', expiresAt]
    );

    // Gửi email thật
    await sendOTPEmail(email, otpCode);
    res.json({ success: true, message: 'Mã OTP đã được gửi về email của bạn.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi gửi email OTP.' });
  }
};

// 2. ĐĂNG KÝ (KHÁCH HOẶC CHỦ SÂN)
exports.register = async (req, res) => {
  const {
    fullName, email, phone, password, otpCode,
    isTenantRegister, // true nếu đăng ký làm chủ sân
    tenantName, district, address, // thông tin nếu là chủ sân
    isStudent, studentCardUrl     // thông tin nếu là học sinh/sinh viên
  } = req.body;

  try {
    // 2.1. Kiểm tra OTP hợp lệ
    const otpRes = await db.query(
      `SELECT * FROM otp_verifications 
       WHERE email = $1 AND otp_code = $2 AND is_used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [email, otpCode]
    );

    if (otpRes.rows.length === 0) {
      return res.status(400).json({ message: 'Mã OTP không đúng hoặc đã hết hạn.' });
    }

    // Đánh dấu OTP đã sử dụng
    await db.query(`UPDATE otp_verifications SET is_used = TRUE WHERE id = $1`, [otpRes.rows[0].id]);

    // 2.2. Kiểm tra email/phone trùng
    const userExist = await db.query(`SELECT id FROM users WHERE email = $1 OR phone = $2`, [email, phone]);
    if (userExist.rows.length > 0) {
      return res.status(400).json({ message: 'Email hoặc Số điện thoại đã được đăng ký.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    if (isTenantRegister) {
      // LUỒNG CHỦ SÂN: Tạo User (TENANT_ADMIN) + Tạo Tenant (PENDING)
      const userRes = await db.query(
        `INSERT INTO users (role, full_name, email, phone, password_hash, is_email_verified)
         VALUES ('TENANT_ADMIN', $1, $2, $3, $4, TRUE) RETURNING id`,
        [fullName, email, phone, passwordHash]
      );
      const ownerId = userRes.rows[0].id;

      const tenantRes = await db.query(
        `INSERT INTO tenants (owner_id, name, district, address, phone_contact, status)
         VALUES ($1, $2, $3, $4, $5, 'PENDING') RETURNING id`,
        [ownerId, tenantName, district, address, phone]
      );

      // Cập nhật lại tenant_id cho user vừa tạo
      await db.query(`UPDATE users SET tenant_id = $1 WHERE id = $2`, [tenantRes.rows[0].id, ownerId]);

      return res.status(201).json({
        success: true,
        message: 'Đăng ký cụm sân thành công. Tài khoản đang chờ Super Admin phê duyệt!'
      });
    } else {
      // LUỒNG END-USER
      const studentState = isStudent ? 'PENDING_APPROVAL' : 'NONE';
      const userRes = await db.query(
        `INSERT INTO users (role, full_name, email, phone, password_hash, is_email_verified, student_status, student_card_url)
         VALUES ('USER', $1, $2, $3, $4, TRUE, $5, $6) RETURNING id, role`,
        [fullName, email, phone, passwordHash, studentState, studentCardUrl || null]
      );

      return res.status(201).json({
        success: true,
        message: isStudent 
          ? 'Đăng ký thành công! Thẻ sinh viên đang chờ duyệt để nhận ưu đãi.' 
          : 'Đăng ký tài khoản thành công!'
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi trong quá trình đăng ký.' });
  }
};

// 3. ĐĂNG NHẬP CHUNG TẤT CẢ VAI TRÒ
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const userRes = await db.query(`SELECT * FROM users WHERE email = $1`, [email]);
    if (userRes.rows.length === 0) {
      return res.status(400).json({ message: 'Tài khoản hoặc mật khẩu không chính xác.' });
    }

    const user = userRes.rows[0];

    // Kiểm tra mật khẩu
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Tài khoản hoặc mật khẩu không chính xác.' });
    }

    // Kiểm tra trạng thái nếu là Chủ sân
    if (user.role === 'TENANT_ADMIN' && user.tenant_id) {
      const tenantRes = await db.query(`SELECT status FROM tenants WHERE id = $1`, [user.tenant_id]);
      const status = tenantRes.rows[0]?.status;
      if (status === 'PENDING') {
        return res.status(403).json({ message: 'Tài khoản cụm sân của bạn đang chờ Super Admin phê duyệt.' });
      }
      if (status === 'LOCKED' || status === 'REJECTED') {
        return res.status(403).json({ message: 'Cụm sân của bạn đã bị khóa hoặc từ chối.' });
      }
    }

    // Tạo JWT Token
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        tenant_id: user.tenant_id,
        student_status: user.student_status
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        studentStatus: user.student_status,
        tenantId: user.tenant_id
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi đăng nhập.' });
  }
};