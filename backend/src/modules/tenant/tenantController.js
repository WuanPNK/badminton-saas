const db = require('../../config/db');
const bcrypt = require('bcryptjs');

// =========================================================
// PHẦN A: API PUBLIC / MARKETPLACE DÀNH CHO KHÁCH HÀNG
// =========================================================

// 1. Lấy danh sách tất cả cụm sân đang ACTIVE (Kèm lọc theo Quận & Từ khóa)
exports.getMarketplaceTenants = async (req, res) => {
  const { district, search } = req.query;

  try {
    let queryText = `
      SELECT t.id, t.name, t.district, t.address, t.phone_contact, t.description,
             t.student_discount_type, t.student_discount_value,
             COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'PUBLISHED') AS total_courts,
             COALESCE(ROUND(AVG(r.rating), 1), 0) AS avg_rating,
             COUNT(DISTINCT r.id) AS total_reviews
      FROM tenants t
      LEFT JOIN courts c ON t.id = c.tenant_id
      LEFT JOIN reviews r ON t.id = r.tenant_id
      WHERE t.status = 'ACTIVE'
    `;
    const params = [];

    if (district) {
      params.push(district);
      queryText += ` AND LOWER(t.district) = LOWER($${params.length})`;
    }

    if (search) {
      params.push(`%${search}%`);
      queryText += ` AND (t.name ILIKE $${params.length} OR t.address ILIKE $${params.length})`;
    }

    queryText += ` GROUP BY t.id ORDER BY t.created_at DESC`;

    const result = await db.query(queryText, params);
    res.json({ success: true, tenants: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi tải danh sách cụm sân.' });
  }
};

// 2. Xem chi tiết 1 Cụm sân (Các sân đã PUBLISHED + Bảng giá động + Đánh giá chi tiết)
exports.getTenantPublicDetail = async (req, res) => {
  const { id } = req.params;

  try {
    const tenantRes = await db.query(
      `SELECT t.id, t.name, t.district, t.address, t.phone_contact, t.description,
              t.student_discount_type, t.student_discount_value,
              t.qr_bank_name, t.qr_account_number, t.qr_account_name,
              COALESCE(ROUND(AVG(r.rating), 1), 0) AS avg_rating,
              COUNT(DISTINCT r.id) AS total_reviews
       FROM tenants t
       LEFT JOIN reviews r ON t.id = r.tenant_id
       WHERE t.id = $1 AND t.status = 'ACTIVE'
       GROUP BY t.id`,
      [id]
    );

    if (tenantRes.rows.length === 0) {
      return res.status(404).json({ message: 'Cụm sân không tồn tại hoặc đang tạm ngưng.' });
    }

    const courtsRes = await db.query(
      `SELECT id, name, type, is_under_maintenance
       FROM courts
       WHERE tenant_id = $1 AND status = 'PUBLISHED'
       ORDER BY name ASC`,
      [id]
    );

    const pricingRes = await db.query(
      `SELECT id, court_type, start_time, end_time, price_per_hour, days_of_week
       FROM pricing_rules
       WHERE tenant_id = $1
       ORDER BY court_type, start_time ASC`,
      [id]
    );

    const reviewsRes = await db.query(
      `SELECT r.id, r.rating, r.comment, r.created_at,
              u.full_name AS user_name,
              c.name AS court_name
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       LEFT JOIN bookings b ON r.booking_id = b.id
       LEFT JOIN courts c ON b.court_id = c.id
       WHERE r.tenant_id = $1
       ORDER BY r.created_at DESC LIMIT 30`,
      [id]
    );

    res.json({
      success: true,
      data: {
        tenant: tenantRes.rows[0],
        courts: courtsRes.rows,
        pricingRules: pricingRes.rows,
        reviews: reviewsRes.rows
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi tải chi tiết cụm sân.' });
  }
};

// =========================================================
// PHẦN B: API QUẢN TRỊ DÀNH CHO CHỦ SÂN (TENANT ADMIN)
// =========================================================

// 3. Lấy thông tin cấu hình hiện tại của Cụm sân
exports.getMyTenantSettings = async (req, res) => {
  res.json({ success: true, tenant: req.tenant });
};

// 4. Cập nhật Công tắc tính năng (Feature Toggles), Ưu đãi HSSV & Tài khoản VietQR
exports.updateTenantSettings = async (req, res) => {
  const tenantId = req.tenant.id;
  const {
    name, district, address, phoneContact, description,
    enableVipCourts, enablePosModule, enableAdvancedAnalytics,
    studentDiscountType, studentDiscountValue,
    qrBankName, qrAccountNumber, qrAccountName
  } = req.body;

  try {
    const result = await db.query(
      `UPDATE tenants SET
        name = COALESCE($1, name),
        district = COALESCE($2, district),
        address = COALESCE($3, address),
        phone_contact = COALESCE($4, phone_contact),
        description = COALESCE($5, description),
        enable_vip_courts = COALESCE($6, enable_vip_courts),
        enable_pos_module = COALESCE($7, enable_pos_module),
        enable_advanced_analytics = COALESCE($8, enable_advanced_analytics),
        student_discount_type = COALESCE($9, student_discount_type),
        student_discount_value = COALESCE($10, student_discount_value),
        qr_bank_name = COALESCE($11, qr_bank_name),
        qr_account_number = COALESCE($12, qr_account_number),
        qr_account_name = COALESCE($13, qr_account_name)
       WHERE id = $14 RETURNING *`,
      [
        name, district, address, phoneContact, description,
        enableVipCourts, enablePosModule, enableAdvancedAnalytics,
        studentDiscountType, studentDiscountValue,
        qrBankName, qrAccountNumber, qrAccountName,
        tenantId
      ]
    );

    res.json({
      success: true,
      message: 'Đã lưu cấu hình cụm sân thành công!',
      tenant: result.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi cập nhật cấu hình cụm sân.' });
  }
};

// 5. Tạo Sân mới (Mặc định trạng thái PENDING chờ Super Admin duyệt)
exports.createCourt = async (req, res) => {
  const tenantId = req.tenant.id;
  const { name, type } = req.body; // type: 'STANDARD' hoặc 'VIP'

  if (!name) {
    return res.status(400).json({ message: 'Vui lòng nhập tên sân.' });
  }

  // Nếu tạo sân VIP mà công tắc enable_vip_courts đang tắt thì chặn lại
  if (type === 'VIP' && !req.tenant.enable_vip_courts) {
    return res.status(403).json({
      message: 'Bạn cần bật công tắc "Sử dụng Sân VIP" trong phần Cài đặt trước khi tạo sân VIP.'
    });
  }

  try {
    const result = await db.query(
      `INSERT INTO courts (tenant_id, name, type, status)
       VALUES ($1, $2, $3, 'PENDING') RETURNING *`,
      [tenantId, name, type || 'STANDARD']
    );

    res.status(201).json({
      success: true,
      message: 'Đã tạo sân mới. Sân đang ở trạng thái PENDING chờ Super Admin duyệt để hiển thị lên sàn!',
      court: result.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi tạo sân mới.' });
  }
};

// 6. Lấy danh sách tất cả Sân của Chủ sân (Bao gồm cả sân đang PENDING)
exports.getMyCourts = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM courts WHERE tenant_id = $1 ORDER BY created_at ASC`,
      [req.tenant.id]
    );
    res.json({ success: true, courts: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi tải danh sách sân.' });
  }
};

// 7. Đổi trạng thái Bảo trì Sân (is_under_maintenance)
exports.toggleCourtMaintenance = async (req, res) => {
  const { courtId } = req.params;
  const { isUnderMaintenance } = req.body;

  try {
    const result = await db.query(
      `UPDATE courts SET is_under_maintenance = $1
       WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [Boolean(isUnderMaintenance), courtId, req.tenant.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy sân.' });
    }

    res.json({
      success: true,
      message: 'Đã cập nhật trạng thái bảo trì sân.',
      court: result.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi cập nhật bảo trì sân.' });
  }
};

// 8. Thêm Khung Giá Động (Dynamic Pricing Rule)
exports.createPricingRule = async (req, res) => {
  const tenantId = req.tenant.id;
  const { courtType, startTime, endTime, pricePerHour, daysOfWeek } = req.body;

  if (!courtType || !startTime || !endTime || !pricePerHour || !Array.isArray(daysOfWeek)) {
    return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin khung giờ và giá.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO pricing_rules (tenant_id, court_type, start_time, end_time, price_per_hour, days_of_week)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [tenantId, courtType, startTime, endTime, pricePerHour, daysOfWeek]
    );

    res.status(201).json({
      success: true,
      message: 'Đã thêm cấu hình giá động thành công!',
      rule: result.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi thêm cấu hình giá động.' });
  }
};

// 9. Lấy danh sách Khung Giá Động & Xóa Khung Giá
exports.getMyPricingRules = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM pricing_rules WHERE tenant_id = $1 ORDER BY court_type, start_time ASC`,
      [req.tenant.id]
    );
    res.json({ success: true, pricingRules: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi tải cấu hình giá.' });
  }
};

exports.deletePricingRule = async (req, res) => {
  const { ruleId } = req.params;
  try {
    await db.query(`DELETE FROM pricing_rules WHERE id = $1 AND tenant_id = $2`, [ruleId, req.tenant.id]);
    res.json({ success: true, message: 'Đã xóa khung giá.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi xóa khung giá.' });
  }
};

// 10. Tạo tài khoản Nhân viên Lễ tân (STAFF) cho Cụm sân
exports.createStaffAccount = async (req, res) => {
  const tenantId = req.tenant.id;
  const { fullName, email, phone, password } = req.body;

  try {
    const exist = await db.query(`SELECT id FROM users WHERE email = $1 OR phone = $2`, [email, phone]);
    if (exist.rows.length > 0) {
      return res.status(400).json({ message: 'Email hoặc Số điện thoại đã tồn tại.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await db.query(
      `INSERT INTO users (role, full_name, email, phone, password_hash, is_email_verified, tenant_id)
       VALUES ('STAFF', $1, $2, $3, $4, TRUE, $5)
       RETURNING id, full_name, email, phone, role, created_at`,
      [fullName, email, phone, passwordHash, tenantId]
    );

    res.status(201).json({
      success: true,
      message: 'Đã tạo tài khoản Lễ tân thành công!',
      staff: result.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi tạo tài khoản Lễ tân.' });
  }
};

// 11. Lấy danh sách Lễ tân của Cụm sân
exports.getMyStaffList = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, full_name, email, phone, is_active, created_at
       FROM users WHERE tenant_id = $1 AND role = 'STAFF' ORDER BY created_at DESC`,
      [req.tenant.id]
    );
    res.json({ success: true, staffList: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi tải danh sách Lễ tân.' });
  }
};