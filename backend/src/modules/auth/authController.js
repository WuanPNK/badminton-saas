const { notifyAdmins } = require('../notification/notificationService');
const db = require('../../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { sendOTPEmail } = require('../../config/mailer');
const { isValidEmail, isValidVNPhone, formatVNPhone } = require('../../utils/validators');

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

// 1. GỬI MÃ OTP VỀ EMAIL (Dùng chung cho Đăng ký và Khôi phục mật khẩu)
exports.sendOTP = async (req, res) => {
  const { email, purpose } = req.body;
  if (!email || !email.trim()) {
    return res.status(400).json({ message: 'Vui lòng nhập địa chỉ email.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!isValidEmail(cleanEmail)) {
    return res.status(400).json({
      message: 'Địa chỉ email không đúng định dạng (Ví dụ: ten@gmail.com hoặc ten@st.phenikaa-uni.edu.vn).'
    });
  }

  const validPurpose = purpose === 'RESET_PASSWORD' ? 'RESET_PASSWORD' : 'REGISTER';

  try {
    if (validPurpose === 'RESET_PASSWORD') {
      const userCheck = await db.query(`SELECT id FROM users WHERE email = $1`, [cleanEmail]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Email này chưa được đăng ký trong hệ thống.' });
      }
    } else {
      const userCheck = await db.query(`SELECT id FROM users WHERE email = $1`, [cleanEmail]);
      if (userCheck.rows.length > 0) {
        return res.status(400).json({
          message: 'Email này đã được sử dụng. Vui lòng đăng nhập hoặc chọn Quên mật khẩu.'
        });
      }
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 phút hiệu lực

    await db.query(
      `INSERT INTO otp_verifications (email, otp_code, purpose, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [cleanEmail, otpCode, validPurpose, expiresAt]
    );

    await sendOTPEmail(cleanEmail, otpCode, validPurpose);

    res.json({
      success: true,
      message: `Mã OTP 6 số đã được gửi đến hộp thư ${cleanEmail}. Vui lòng kiểm tra hộp thư đến (hoặc hòm thư Rác/Spam). Mã có hiệu lực trong 10 phút.`,
    });
  } catch (error) {
    console.error('Lỗi khi gửi email OTP:', error.message || error);
    let errMsg = 'Không thể gửi email OTP. Vui lòng kiểm tra lại dịch vụ email.';
    if (error.code === 'EAUTH' || (error.message && error.message.includes('535'))) {
      errMsg = 'Lỗi xác thực Gmail: Cấu hình EMAIL_USER hoặc EMAIL_PASS (Mật khẩu ứng dụng 16 số) trong backend/.env chưa chính xác.';
    }
    res.status(500).json({ message: errMsg });
  }
};

// 2. ĐĂNG KÝ
exports.register = async (req, res) => {
  const {
    fullName, email, phone, password, otpCode,
    isTenantRegister, tenantName, district, address,
    isStudent, studentCardImage,
    bankName, bankAccountNumber, bankAccountName
  } = req.body;

  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanOtp = String(otpCode || '').trim();

  if (!isValidEmail(cleanEmail)) {
    return res.status(400).json({
      message: 'Địa chỉ email không đúng định dạng (Ví dụ: ten@gmail.com hoặc ten@st.phenikaa-uni.edu.vn).'
    });
  }

  if (!isValidVNPhone(phone)) {
    return res.status(400).json({
      message: 'Số điện thoại không hợp lệ. Vui lòng nhập đúng 10 chữ số di động VN (đầu 03, 05, 07, 08, 09).'
    });
  }

  const cleanPhone = formatVNPhone(phone);

  try {
    const otpRes = await db.query(
      `SELECT * FROM otp_verifications 
       WHERE email = $1 AND otp_code = $2 AND is_used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [cleanEmail, cleanOtp]
    );

    if (otpRes.rows.length === 0) {
      // Phân tích chi tiết nguyên nhân lỗi để người dùng biết chính xác
      const historyOtp = await db.query(
        `SELECT * FROM otp_verifications WHERE email = $1 AND otp_code = $2 ORDER BY created_at DESC LIMIT 1`,
        [cleanEmail, cleanOtp]
      );

      if (historyOtp.rows.length === 0) {
        return res.status(400).json({
          message: 'Mã OTP không chính xác. Vui lòng mở email mới nhất để lấy đúng mã 6 số.'
        });
      }

      const foundOtp = historyOtp.rows[0];
      if (foundOtp.is_used) {
        return res.status(400).json({
          message: 'Mã OTP này đã được sử dụng. Vui lòng bấm "Gửi lại mã OTP" để nhận mã mới.'
        });
      }

      if (new Date(foundOtp.expires_at) <= new Date()) {
        return res.status(400).json({
          message: 'Mã OTP này đã hết hạn. Vui lòng kiểm tra email mới nhất hoặc bấm "Gửi lại mã OTP".'
        });
      }

      return res.status(400).json({ message: 'Mã OTP không hợp lệ hoặc đã hết hạn.' });
    }

    await db.query(`UPDATE otp_verifications SET is_used = TRUE WHERE id = $1`, [otpRes.rows[0].id]);

    const userExist = await db.query(`SELECT id FROM users WHERE email = $1 OR phone = $2`, [cleanEmail, cleanPhone]);
    if (userExist.rows.length > 0) {
      return res.status(400).json({ message: 'Email hoặc Số điện thoại đã được sử dụng.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    if (isTenantRegister) {
      const userRes = await db.query(
        `INSERT INTO users (role, full_name, email, phone, password_hash, is_email_verified)
         VALUES ('TENANT_ADMIN', $1, $2, $3, $4, TRUE) RETURNING id`,
        [fullName, cleanEmail, cleanPhone, passwordHash]
      );
      const ownerId = userRes.rows[0].id;

      const tenantRes = await db.query(
        `INSERT INTO tenants (owner_id, name, district, address, phone_contact, status)
         VALUES ($1, $2, $3, $4, $5, 'PENDING') RETURNING id`,
        [ownerId, tenantName, district, address, phone]
      );

      await db.query(`UPDATE users SET tenant_id = $1 WHERE id = $2`, [tenantRes.rows[0].id, ownerId]);
      notifyAdmins({
        type: 'TENANT_PENDING',
        title: 'Cụm sân mới đăng ký',
        message: `Cụm sân "${tenantName}" (${district}) vừa đăng ký tài khoản và đang chờ phê duyệt.`,
        link: '/admin',
      });

      return res.status(201).json({
        success: true,
        message: 'Đăng ký đối tác thành công. Cụm sân đang chờ Admin phê duyệt!'
      });
    } else {
      const studentState = isStudent ? 'PENDING_APPROVAL' : 'NONE';
      const savedCardUrl = isStudent ? saveBase64Image(studentCardImage, req) : null;

      await db.query(
        `INSERT INTO users (
          role, full_name, email, phone, password_hash, is_email_verified,
          student_status, student_card_url,
          bank_name, bank_account_number, bank_account_name
        )
        VALUES ('USER', $1, $2, $3, $4, TRUE, $5, $6, $7, $8, $9) RETURNING id, role`,
        [
          fullName,
          cleanEmail,
          cleanPhone,
          passwordHash,
          studentState,
          savedCardUrl,
          bankName || null,
          bankAccountNumber || null,
          bankAccountName ? bankAccountName.toUpperCase() : null
        ]
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

    let tenantData = null;
    if (user.role === 'TENANT_ADMIN' && user.tenant_id) {
      const tenantRes = await db.query(
        `SELECT id, name, district, address, phone_contact, status, created_at 
         FROM tenants WHERE id = $1`,
        [user.tenant_id]
      );
      if (tenantRes.rows.length === 0) {
        return res.status(403).json({ message: 'Không tìm thấy thông tin cụm sân liên kết.' });
      }

      tenantData = tenantRes.rows[0];
      const status = tenantData.status;

      // 1. Nếu bị Từ chối phê duyệt: Chặn đăng nhập
      if (status === 'REJECTED') {
        return res.status(403).json({
          message: 'Hồ sơ đăng ký cụm sân của bạn đã bị từ chối phê duyệt. Tài khoản không thể đăng nhập vào hệ thống.'
        });
      }

      // 2. Nếu bị Khóa: Chặn đăng nhập
      if (status === 'LOCKED') {
        return res.status(403).json({
          message: 'Tài khoản cụm sân của bạn hiện đang bị tạm khóa. Vui lòng liên hệ Admin.'
        });
      }

      // 3. Nếu đang chờ duyệt (PENDING): Kiểm tra thời hạn 7 ngày
      if (status === 'PENDING') {
        const createdAt = new Date(tenantData.created_at);
        const diffMs = Date.now() - createdAt.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (diffDays >= 7) {
          // Đã quá 7 ngày mà chưa được duyệt -> Tự động xóa tài khoản & cụm sân
          await db.query(`UPDATE users SET tenant_id = NULL WHERE id = $1`, [user.id]);
          await db.query(`DELETE FROM courts WHERE tenant_id = $1`, [user.tenant_id]);
          await db.query(`DELETE FROM tenants WHERE id = $1`, [user.tenant_id]);
          await db.query(`DELETE FROM users WHERE id = $1`, [user.id]);

          return res.status(403).json({
            message: 'Hồ sơ đăng ký cụm sân đã quá hạn 7 ngày chờ duyệt mà chưa được phê duyệt nên đã tự động bị xóa khỏi hệ thống. Vui lòng đăng ký lại hồ sơ mới.'
          });
        }
        // CHƯA QUÁ 7 NGÀY: CHO PHÉP ĐĂNG NHẬP ĐỂ VÀO GIAO DIỆN CHỜ DUYỆT!
      }
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        tenant_id: user.tenant_id,
        student_status: user.student_status,
        tenant_status: tenantData ? tenantData.status : null
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
        phone: user.phone,
        role: user.role,
        studentStatus: user.student_status,
        studentCardUrl: user.student_card_url,
        tenantId: user.tenant_id,
        tenantStatus: tenantData ? tenantData.status : null,
        tenantInfo: tenantData ? {
          id: tenantData.id,
          name: tenantData.name,
          district: tenantData.district,
          address: tenantData.address,
          phoneContact: tenantData.phone_contact,
          status: tenantData.status,
          createdAt: tenantData.created_at,
          expiresAt: new Date(new Date(tenantData.created_at).getTime() + 7 * 24 * 60 * 60 * 1000)
        } : null,
        bankName: user.bank_name,
        bankAccountNumber: user.bank_account_number,
        bankAccountName: user.bank_account_name
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

  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanOtp = String(otpCode || '').trim();

  try {
    const otpRes = await db.query(
      `SELECT * FROM otp_verifications
       WHERE email = $1 AND otp_code = $2 AND is_used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [cleanEmail, cleanOtp]
    );

    if (otpRes.rows.length === 0) {
      const historyOtp = await db.query(
        `SELECT * FROM otp_verifications WHERE email = $1 AND otp_code = $2 ORDER BY created_at DESC LIMIT 1`,
        [cleanEmail, cleanOtp]
      );

      if (historyOtp.rows.length === 0) {
        return res.status(400).json({
          message: 'Mã OTP không chính xác. Vui lòng mở email mới nhất để lấy đúng mã 6 số.'
        });
      }

      const foundOtp = historyOtp.rows[0];
      if (foundOtp.is_used) {
        return res.status(400).json({
          message: 'Mã OTP này đã được sử dụng. Vui lòng bấm "Gửi lại mã OTP" để nhận mã mới.'
        });
      }

      if (new Date(foundOtp.expires_at) <= new Date()) {
        return res.status(400).json({
          message: 'Mã OTP này đã hết hạn. Vui lòng kiểm tra email mới nhất hoặc bấm "Gửi lại mã OTP".'
        });
      }

      return res.status(400).json({ message: 'Mã OTP không đúng hoặc đã hết hạn.' });
    }

    const userRes = await db.query(`SELECT id FROM users WHERE email = $1`, [cleanEmail]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản gắn với email này.' });
    }

    await db.query(`UPDATE otp_verifications SET is_used = TRUE WHERE id = $1`, [otpRes.rows[0].id]);

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await db.query(`UPDATE users SET password_hash = $1 WHERE email = $2`, [passwordHash, cleanEmail]);

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
  const { fullName, phone, studentCardImage, bankName, bankAccountNumber, bankAccountName } = req.body;

  if (!fullName || !phone) {
    return res.status(400).json({ message: 'Họ tên và Số điện thoại không được để trống.' });
  }

  if (!isValidVNPhone(phone)) {
    return res.status(400).json({
      message: 'Số điện thoại không hợp lệ. Vui lòng nhập đúng 10 chữ số di động VN (đầu 03, 05, 07, 08, 09).'
    });
  }

  const cleanPhone = formatVNPhone(phone);

  try {
    const phoneCheck = await db.query(
      `SELECT id FROM users WHERE phone = $1 AND id != $2`,
      [cleanPhone, userId]
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
       SET full_name = $1, phone = $2, student_status = $3, student_card_url = $4,
           bank_name = $5, bank_account_number = $6, bank_account_name = $7
       WHERE id = $8
       RETURNING id, full_name, email, phone, role, student_status, student_card_url, tenant_id,
                 bank_name, bank_account_number, bank_account_name`,
      [
        fullName,
        phone,
        newStudentStatus,
        newCardUrl,
        bankName || null,
        bankAccountNumber || null,
        bankAccountName ? bankAccountName.toUpperCase() : null,
        userId
      ]
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
        tenantId: u.tenant_id,
        bankName: u.bank_name,
        bankAccountNumber: u.bank_account_number,
        bankAccountName: u.bank_account_name
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