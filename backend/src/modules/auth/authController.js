const db = require('../../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { sendOTPEmail } = require('../../config/mailer');

// Hàm phụ trợ: Lưu chuỗi Base64 từ Frontend thành file ảnh thực tế
const saveBase64Image = (base64Data, req) => {
  if (!base64Data || !base64Data.startsWith('data:image/')) {
    return base64Data || null;
  }

  const matches = base64Data.match(/^data:image\/([A-Za-z-+/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) return null;

  const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
  const buffer = Buffer.from(matches[2], 'base64');

  const uploadDir = path.join(__dirname, '../../../uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const fileName = `student_card_${Date.now()}_${Math.floor(Math.random() * 10000)}.${ext}`;
  fs.writeFileSync(path.join(uploadDir, fileName), buffer);

  return `${req.protocol}://${req.get('host')}/uploads/${fileName}`;
};

// 1. GỬI MÃ OTP VỀ EMAIL
exports.sendOTP = async (req, res) => {
  const { email, purpose } = req.body;
  if (!email) return res.status(400).json({ message: 'Vui lòng nhập địa chỉ email.' });

  try {
    if (purpose === 'RESET_PASSWORD') {
      const userCheck = await db.query(`SELECT id FROM users WHERE email = $1`, [email]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Email này chưa được đăng ký trong hệ thống.' });
      }
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); 

    await db.query(
      `INSERT INTO otp_verifications (email, otp_code, purpose, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [email, otpCode, purpose || 'REGISTER', expiresAt]
    );

    await sendOTPEmail(email, otpCode);
    res.json({ success: true, message: 'Mã OTP 6 số đã được gửi về Gmail của bạn.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi gửi email OTP.' });
  }
};

// 2. ĐĂNG KÝ
exports.register = async (req, res) => {
  const {
    fullName, email, phone, password, otpCode,
    isTenantRegister, tenantName, district, address,
    isStudent, studentCardImage 
  } = req.body;

  try {
    const otpRes = await db.query(
      `SELECT * FROM otp_verifications 
       WHERE email = $1 AND otp_code = $2 AND is_used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [email, otpCode]
    );

    if (otpRes.rows.length === 0) {
      return res.status(400).json({ message: 'Mã OTP không chính xác hoặc đã hết hạn.' });
    }

    await db.query(`UPDATE otp_verifications SET is_used = TRUE WHERE id = $1`, [otpRes.rows[0].id]);

    const userExist = await db.query(`SELECT id FROM users WHERE email = $1 OR phone = $2`, [email, phone]);
    if (userExist.rows.length > 0) {
      return res.status(400).json({ message: 'Email hoặc Số điện thoại đã được sử dụng.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    if (isTenantRegister) {
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

      await db.query(`UPDATE users SET tenant_id = $1 WHERE id = $2`, [tenantRes.rows[0].id, ownerId]);

      return res.status(201).json({
        success: true,
        message: 'Đăng ký đối tác thành công. Cụm sân đang chờ Super Admin phê duyệt!'
      });
    } else {
      const studentState = isStudent ? 'PENDING_APPROVAL' : 'NONE';
      const savedCardUrl = isStudent ? saveBase64Image(studentCardImage, req) : null;

      await db.query(
        `INSERT INTO users (role, full_name, email, phone, password_hash, is_email_verified, student_status, student_card_url)
         VALUES ('USER', $1, $2, $3, $4, TRUE, $5, $6) RETURNING id, role`,
        [fullName, email, phone, passwordHash, studentState, savedCardUrl]
      );

      return res.status(201).json({
        success: true,
        message: isStudent 
          ? 'Đăng ký thành công! Ảnh thẻ sinh viên đã được tải lên chờ duyệt.' 
          : 'Đăng ký tài khoản thành công!'
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi trong quá trình đăng ký.' });
  }
};

// 3. ĐĂNG NHẬP
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const userRes = await db.query(`SELECT * FROM users WHERE email = $1`, [email]);
    if (userRes.rows.length === 0) {
      return res.status(400).json({ message: 'Tài khoản hoặc mật khẩu không chính xác.' });
    }

    const user = userRes.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Tài khoản hoặc mật khẩu không chính xác.' });
    }

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

// 4. QUÊN MẬT KHẨU
exports.resetPassword = async (req, res) => {
  const { email, otpCode, newPassword } = req.body;

  if (!email || !otpCode || !newPassword) {
    return res.status(400).json({ message: 'Vui lòng nhập đầy đủ Email, Mã OTP và Mật khẩu mới.' });
  }

  try {
    const otpRes = await db.query(
      `SELECT * FROM otp_verifications
       WHERE email = $1 AND otp_code = $2 AND is_used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [email, otpCode]
    );

    if (otpRes.rows.length === 0) {
      return res.status(400).json({ message: 'Mã OTP không đúng hoặc đã hết hạn.' });
    }

    const userRes = await db.query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản gắn với email này.' });
    }

    await db.query(`UPDATE otp_verifications SET is_used = TRUE WHERE id = $1`, [otpRes.rows[0].id]);

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await db.query(`UPDATE users SET password_hash = $1 WHERE email = $2`, [passwordHash, email]);

    res.json({
      success: true,
      message: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi đặt lại mật khẩu.' });
  }
};

// 5. CẬP NHẬT THÔNG TIN CÁ NHÂN & ẢNH THẺ SINH VIÊN
exports.updateProfile = async (req, res) => {
  const userId = req.user.id;
  const { fullName, phone, studentCardImage } = req.body;

  if (!fullName || !phone) {
    return res.status(400).json({ message: 'Họ tên và Số điện thoại không được để trống.' });
  }

  try {
    const phoneCheck = await db.query(
      `SELECT id FROM users WHERE phone = $1 AND id != $2`,
      [phone, userId]
    );
    if (phoneCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Số điện thoại này đã được sử dụng bởi tài khoản khác.' });
    }

    const currentRes = await db.query(`SELECT * FROM users WHERE id = $1`, [userId]);
    if (currentRes.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản.' });
    }
    const currentUser = currentRes.rows[0];

    let newStudentStatus = currentUser.student_status;
    let newCardUrl = currentUser.student_card_url;

    if (studentCardImage && studentCardImage.startsWith('data:image/')) {
      newCardUrl = saveBase64Image(studentCardImage, req);
      if (currentUser.student_status !== 'VERIFIED') {
        newStudentStatus = 'PENDING_APPROVAL';
      }
    }

    const updateRes = await db.query(
      `UPDATE users
       SET full_name = $1, phone = $2, student_status = $3, student_card_url = $4
       WHERE id = $5
       RETURNING id, full_name, email, phone, role, student_status, student_card_url, tenant_id`,
      [fullName, phone, newStudentStatus, newCardUrl, userId]
    );

    const u = updateRes.rows[0];
    res.json({
      success: true,
      message: 'Cập nhật thông tin tài khoản thành công!',
      user: {
        id: u.id,
        fullName: u.full_name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        studentStatus: u.student_status,
        studentCardUrl: u.student_card_url,
        tenantId: u.tenant_id
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi cập nhật thông tin cá nhân.' });
  }
};

// 6. ĐỔI MẬT KHẨU
exports.changePassword = async (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
  }

  try {
    const userRes = await db.query(`SELECT password_hash FROM users WHERE id = $1`, [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Mật khẩu hiện tại không chính xác.' });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await db.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [newHash, userId]);

    res.json({
      success: true,
      message: 'Đổi mật khẩu thành công!'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi đổi mật khẩu.' });
  }
};