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
             t.student_discount_type, t.student_discount_value, t.images, t.rules,
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
              t.images, t.rules,
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
      `SELECT id, name, type, is_under_maintenance, maintenance_start, maintenance_note
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

// 6b. Cập nhật thông tin Sân (Tên & Phân loại)
exports.updateCourt = async (req, res) => {
  const { courtId } = req.params;
  const { name, type } = req.body;
  const tenantId = req.tenant.id;

  if (!name) {
    return res.status(400).json({ message: 'Vui lòng nhập tên sân.' });
  }

  if (type === 'VIP' && !req.tenant.enable_vip_courts) {
    return res.status(403).json({
      message: 'Bạn cần bật công tắc "Sử dụng Sân VIP" trong phần Cài đặt trước khi chọn phân loại VIP.'
    });
  }

  try {
    const result = await db.query(
      `UPDATE courts SET name = $1, type = $2
       WHERE id = $3 AND tenant_id = $4 RETURNING *`,
      [name, type || 'STANDARD', courtId, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy sân.' });
    }

    res.json({
      success: true,
      message: 'Đã cập nhật thông tin sân thành công!',
      court: result.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi cập nhật sân.' });
  }
};

// 6c. Xóa Sân (Kiểm tra lịch tương lai)
exports.deleteCourt = async (req, res) => {
  const { courtId } = req.params;
  const tenantId = req.tenant.id;

  try {
    const futureBookings = await db.query(
      `SELECT id FROM bookings
       WHERE court_id = $1 AND status IN ('PENDING', 'CONFIRMED') AND end_time > NOW()
       LIMIT 1`,
      [courtId]
    );

    if (futureBookings.rows.length > 0) {
      return res.status(400).json({
        message: 'Không thể xóa sân này vì đang có khách đặt lịch trong tương lai. Vui lòng xử lý lịch trước.'
      });
    }

    await db.query(`DELETE FROM courts WHERE id = $1 AND tenant_id = $2`, [courtId, tenantId]);

    res.json({ success: true, message: 'Đã xóa sân thành công!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi xóa sân.' });
  }
};

// 7. Lên lịch Bảo trì Sân (Kiểm tra lịch khách đã đặt trước, hỗ trợ chọn thời gian bắt đầu)
exports.scheduleCourtMaintenance = async (req, res) => {
  const { courtId } = req.params;
  const { isUnderMaintenance, maintenanceStart, maintenanceNote } = req.body;
  const tenantId = req.tenant.id;

  try {
    const courtRes = await db.query(
      `SELECT * FROM courts WHERE id = $1 AND tenant_id = $2`,
      [courtId, tenantId]
    );
    if (courtRes.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy sân.' });
    }

    if (isUnderMaintenance) {
      const startTime = maintenanceStart ? new Date(maintenanceStart) : new Date();

      // Kiểm tra xem đã có khách đặt lịch trong hoặc sau thời điểm bảo trì này chưa
      const conflictRes = await db.query(
        `SELECT b.id, b.booking_code, b.start_time, b.end_time,
                COALESCE(u.full_name, b.walk_in_guest_name, 'Khách hàng') AS customer_name
         FROM bookings b
         LEFT JOIN users u ON b.user_id = u.id
         WHERE b.court_id = $1
           AND b.status IN ('CONFIRMED', 'COMPLETED', 'PENDING')
           AND b.end_time > $2
         ORDER BY b.start_time ASC
         LIMIT 1`,
        [courtId, startTime]
      );

      if (conflictRes.rows.length > 0) {
        const conflict = conflictRes.rows[0];
        const conflictTime = new Date(conflict.start_time).toLocaleString('vi-VN');
        return res.status(400).json({
          message: `Không thể bảo trì sân này vì đã có khách (${conflict.customer_name} - mã đơn #${conflict.booking_code}) đặt trước vào lúc ${conflictTime}. Vui lòng liên hệ hỗ trợ hoặc dời lịch khách trước khi kích hoạt bảo trì!`
        });
      }

      const updated = await db.query(
        `UPDATE courts
         SET is_under_maintenance = TRUE,
             maintenance_start = $1,
             maintenance_note = $2
         WHERE id = $3 AND tenant_id = $4
         RETURNING *`,
        [startTime, maintenanceNote || 'Bảo trì kỹ thuật sân', courtId, tenantId]
      );

      return res.json({
        success: true,
        message: 'Đã lên lịch bảo trì sân thành công. Khách hàng sẽ không thể đặt khung giờ bảo trì này nữa.',
        court: updated.rows[0]
      });
    } else {
      // Kết thúc bảo trì -> Mở lại sân
      const updated = await db.query(
        `UPDATE courts
         SET is_under_maintenance = FALSE,
             maintenance_start = NULL,
             maintenance_note = NULL
         WHERE id = $1 AND tenant_id = $2
         RETURNING *`,
        [courtId, tenantId]
      );

      return res.json({
        success: true,
        message: 'Đã hoàn tất bảo trì sân. Sân đã được mở lại phục vụ khách bình thường.',
        court: updated.rows[0]
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi cập nhật trạng thái bảo trì sân.' });
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

// 8b. Cập nhật Khung Giá Động
exports.updatePricingRule = async (req, res) => {
  const { ruleId } = req.params;
  const { courtType, startTime, endTime, pricePerHour, daysOfWeek } = req.body;
  const tenantId = req.tenant.id;

  try {
    const result = await db.query(
      `UPDATE pricing_rules
       SET court_type = COALESCE($1, court_type),
           start_time = COALESCE($2, start_time),
           end_time = COALESCE($3, end_time),
           price_per_hour = COALESCE($4, price_per_hour),
           days_of_week = COALESCE($5, days_of_week)
       WHERE id = $6 AND tenant_id = $7 RETURNING *`,
      [courtType, startTime, endTime, pricePerHour, daysOfWeek, ruleId, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy khung giá.' });
    }

    res.json({
      success: true,
      message: 'Đã cập nhật khung giá động thành công!',
      rule: result.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi cập nhật khung giá.' });
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

// 12. Cập nhật thông tin Lễ tân & Đổi mật khẩu
exports.updateStaffAccount = async (req, res) => {
  const { id } = req.params;
  const { fullName, phone, password, isActive } = req.body;
  const tenantId = req.tenant.id;

  try {
    const staffRes = await db.query(
      `SELECT * FROM users WHERE id = $1 AND tenant_id = $2 AND role = 'STAFF'`,
      [id, tenantId]
    );

    if (staffRes.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản lễ tân.' });
    }

    let passwordHash = staffRes.rows[0].password_hash;
    if (password && password.trim().length > 0) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(password, salt);
    }

    const updated = await db.query(
      `UPDATE users
       SET full_name = COALESCE($1, full_name),
           phone = COALESCE($2, phone),
           password_hash = $3,
           is_active = COALESCE($4, is_active)
       WHERE id = $5 AND tenant_id = $6
       RETURNING id, full_name, email, phone, is_active, created_at`,
      [fullName, phone, passwordHash, isActive, id, tenantId]
    );

    res.json({
      success: true,
      message: 'Đã cập nhật thông tin lễ tân thành công!',
      staff: updated.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi cập nhật tài khoản lễ tân.' });
  }
};

// 13. Xóa hoặc Vô hiệu hóa tài khoản Lễ tân
exports.deleteStaffAccount = async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenant.id;

  try {
    const staffRes = await db.query(
      `SELECT * FROM users WHERE id = $1 AND tenant_id = $2 AND role = 'STAFF'`,
      [id, tenantId]
    );
    if (staffRes.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản lễ tân.' });
    }

    // Kiểm tra xem lễ tân đã tạo hóa đơn POS hay vé vãng lai chưa
    const usedRes = await db.query(
      `SELECT 1 FROM bookings WHERE created_by_staff_id = $1
       UNION
       SELECT 1 FROM pos_orders WHERE staff_id = $1 LIMIT 1`,
      [id]
    );

    if (usedRes.rows.length > 0) {
      await db.query(`UPDATE users SET is_active = FALSE WHERE id = $1`, [id]);
      return res.json({
        success: true,
        message: 'Tài khoản lễ tân này đã có lịch sử tạo đơn, hệ thống đã chuyển sang trạng thái Vô hiệu hóa để bảo đảm toàn vẹn dữ liệu.'
      });
    }

    await db.query(`DELETE FROM users WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    res.json({ success: true, message: 'Đã xóa tài khoản lễ tân thành công!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi xóa tài khoản lễ tân.' });
  }
};

// 14. Chủ sân tự xem toàn bộ Đánh giá & Nhận xét của Cụm sân mình
exports.getMyReviews = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.id, r.rating, r.comment, r.created_at,
              u.full_name AS user_name, u.email AS user_email,
              b.booking_code, c.name AS court_name
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       LEFT JOIN bookings b ON r.booking_id = b.id
       LEFT JOIN courts c ON b.court_id = c.id
       WHERE r.tenant_id = $1
       ORDER BY r.created_at DESC`,
      [req.tenant.id]
    );

    const statsRes = await db.query(
      `SELECT COALESCE(ROUND(AVG(rating), 1), 0) AS avg_rating,
              COUNT(id) AS total_reviews,
              COUNT(id) FILTER (WHERE rating = 5) AS count_5,
              COUNT(id) FILTER (WHERE rating = 4) AS count_4,
              COUNT(id) FILTER (WHERE rating = 3) AS count_3,
              COUNT(id) FILTER (WHERE rating = 2) AS count_2,
              COUNT(id) FILTER (WHERE rating = 1) AS count_1
       FROM reviews WHERE tenant_id = $1`,
      [req.tenant.id]
    );

    res.json({
      success: true,
      reviews: result.rows,
      stats: statsRes.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi tải đánh giá của sân.' });
  }
};

// 15. Cập nhật Hình ảnh, Điều khoản & Thông tin cụm sân
exports.updateVenueDetails = async (req, res) => {
  const tenantId = req.tenant.id;
  const { name, district, address, phoneContact, description, images, rules } = req.body;

  try {
    const result = await db.query(
      `UPDATE tenants SET
        name = COALESCE($1, name),
        district = COALESCE($2, district),
        address = COALESCE($3, address),
        phone_contact = COALESCE($4, phone_contact),
        description = COALESCE($5, description),
        images = COALESCE($6, images),
        rules = COALESCE($7, rules)
       WHERE id = $8 RETURNING *`,
      [name, district, address, phoneContact, description, images, rules, tenantId]
    );

    res.json({
      success: true,
      message: 'Đã cập nhật thông tin, hình ảnh và điều khoản sân thành công!',
      tenant: result.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi cập nhật thông tin cụm sân.' });
  }
};

// 16. Xuất Dữ Liệu Báo Cáo Doanh Thu Phục Vụ Kế Toán Đối Soát (Excel / CSV)
exports.getTenantRevenueExport = async (req, res) => {
  const tenantId = req.tenant.id;

  try {
    // 16.1. Thông tin Cụm sân
    const tenantRes = await db.query(
      `SELECT t.id, t.name, t.district, t.address, t.phone_contact,
              t.qr_bank_name, t.qr_account_number, t.qr_account_name,
              t.enable_vip_courts, t.enable_pos_module, t.enable_advanced_analytics,
              u.full_name AS owner_name, u.email AS owner_email
       FROM tenants t
       LEFT JOIN users u ON t.owner_id = u.id
       WHERE t.id = $1`,
      [tenantId]
    );

    // 16.2. Thống kê tổng hợp doanh thu
    const bookingStats = await db.query(
      `SELECT
         COALESCE(SUM(final_price) FILTER (WHERE status IN ('CONFIRMED', 'COMPLETED')), 0) AS court_revenue,
         COUNT(id) FILTER (WHERE status IN ('CONFIRMED', 'COMPLETED')) AS paid_bookings_count,
         COUNT(id) FILTER (WHERE status = 'PENDING_REFUND') AS pending_refund_count,
         COALESCE(SUM(final_price) FILTER (WHERE status = 'REFUNDED'), 0) AS total_refunded_amount
       FROM bookings
       WHERE tenant_id = $1`,
      [tenantId]
    );

    const posStats = await db.query(
      `SELECT
         COALESCE(SUM(total_amount), 0) AS pos_revenue,
         COUNT(id) AS total_pos_orders
       FROM pos_orders
       WHERE tenant_id = $1`,
      [tenantId]
    );

    // 16.3. Chi tiết toàn bộ đơn đặt sân (Bookings Ledger)
    const bookingsRes = await db.query(
      `SELECT
         b.id,
         b.booking_code,
         b.booking_type,
         b.booking_date,
         b.start_time,
         b.end_time,
         b.original_price,
         b.discount_applied,
         b.final_price,
         b.is_student_applied,
         b.status,
         b.created_at,
         b.checked_in_at,
         c.name AS court_name,
         c.type AS court_type,
         COALESCE(u.full_name, b.walk_in_guest_name, 'Khách vãng lai') AS customer_name,
         COALESCE(u.phone, b.walk_in_guest_phone, '') AS customer_phone,
         u.email AS customer_email,
         staff.full_name AS staff_name
       FROM bookings b
       JOIN courts c ON b.court_id = c.id
       LEFT JOIN users u ON b.user_id = u.id
       LEFT JOIN users staff ON b.created_by_staff_id = staff.id
       WHERE b.tenant_id = $1
       ORDER BY b.start_time DESC`,
      [tenantId]
    );

    // 16.4. Chi tiết toàn bộ hóa đơn POS (POS Orders Ledger)
    const posOrdersRes = await db.query(
      `SELECT
         po.id,
         po.total_amount,
         po.payment_method,
         po.note,
         po.created_at,
         u.full_name AS staff_name,
         c.name AS court_name,
         b.booking_code,
         COALESCE(
           (SELECT string_agg(p.name || ' (x' || poi.quantity || ')', '; ')
            FROM pos_order_items poi
            JOIN products p ON poi.product_id = p.id
            WHERE poi.order_id = po.id),
           'Hóa đơn dịch vụ'
         ) AS items_detail
       FROM pos_orders po
       JOIN users u ON po.staff_id = u.id
       LEFT JOIN courts c ON po.court_id = c.id
       LEFT JOIN bookings b ON po.booking_id = b.id
       WHERE po.tenant_id = $1
       ORDER BY po.created_at DESC`,
      [tenantId]
    );

    // 16.5. Hiệu suất khai thác theo sân (Revenue by Court)
    const courtPerformanceRes = await db.query(
      `SELECT
         c.name AS court_name,
         c.type AS court_type,
         COUNT(b.id) FILTER (WHERE b.status IN ('CONFIRMED', 'COMPLETED')) AS total_bookings,
         COALESCE(SUM(b.final_price) FILTER (WHERE b.status IN ('CONFIRMED', 'COMPLETED')), 0) AS total_revenue
       FROM courts c
       LEFT JOIN bookings b ON c.id = b.court_id
       WHERE c.tenant_id = $1
       GROUP BY c.id, c.name, c.type
       ORDER BY total_revenue DESC`,
      [tenantId]
    );

    const courtRev = Number(bookingStats.rows[0].court_revenue);
    const posRev = Number(posStats.rows[0].pos_revenue);
    const totalRev = courtRev + posRev;

    res.json({
      success: true,
      exportData: {
        exportedAt: new Date().toISOString(),
        tenant: tenantRes.rows[0] || {},
        summary: {
          totalRevenue: totalRev,
          courtRevenue: courtRev,
          posRevenue: posRev,
          paidBookingsCount: Number(bookingStats.rows[0].paid_bookings_count),
          posOrdersCount: Number(posStats.rows[0].total_pos_orders),
          pendingRefundCount: Number(bookingStats.rows[0].pending_refund_count),
          totalRefundedAmount: Number(bookingStats.rows[0].total_refunded_amount),
        },
        bookings: bookingsRes.rows,
        posOrders: posOrdersRes.rows,
        courtPerformance: courtPerformanceRes.rows,
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi trích xuất dữ liệu báo cáo kế toán.' });
  }
};