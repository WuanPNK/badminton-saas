const db = require('../../config/db');

// 1. LẤY TẤT CẢ DANH SÁCH CHỜ DUYỆT (Chủ sân, Sân mới, Thẻ HSSV)
exports.getPendingApprovals = async (req, res) => {
  try {
    const pendingTenants = await db.query(
      `SELECT t.*, u.full_name AS owner_name, u.email AS owner_email
       FROM tenants t
       JOIN users u ON t.owner_id = u.id
       WHERE t.status = 'PENDING'
       ORDER BY t.created_at DESC`
    );

    const pendingCourts = await db.query(
      `SELECT c.*, t.name AS tenant_name, t.district
       FROM courts c
       JOIN tenants t ON c.tenant_id = t.id
       WHERE c.status = 'PENDING'
       ORDER BY c.created_at DESC`
    );

    const pendingStudents = await db.query(
      `SELECT id, full_name, email, phone, student_status, student_card_url, created_at
       FROM users
       WHERE student_status = 'PENDING_APPROVAL'
       ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      data: {
        pendingTenants: pendingTenants.rows,
        pendingCourts: pendingCourts.rows,
        pendingStudents: pendingStudents.rows
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi tải danh sách chờ duyệt.' });
  }
};

// 2. DUYỆT HOẶC KHÓA TÀI KHOẢN CHỦ SÂN (PENDING -> ACTIVE / LOCKED / REJECTED)
exports.updateTenantStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'ACTIVE', 'LOCKED', 'REJECTED'

  if (!['ACTIVE', 'LOCKED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ message: 'Trạng thái cập nhật không hợp lệ.' });
  }

  try {
    const result = await db.query(
      `UPDATE tenants SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy cụm sân.' });
    }

    res.json({
      success: true,
      message: `Đã cập nhật trạng thái cụm sân thành ${status}.`,
      tenant: result.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi duyệt cụm sân.' });
  }
};

// 3. DUYỆT SÂN MỚI DO CHỦ SÂN TẠO (PENDING -> PUBLISHED / REJECTED)
exports.updateCourtStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'PUBLISHED', 'REJECTED'

  if (!['PUBLISHED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ message: 'Trạng thái sân phải là PUBLISHED hoặc REJECTED.' });
  }

  try {
    const result = await db.query(
      `UPDATE courts SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy sân.' });
    }

    res.json({
      success: true,
      message: `Đã cập nhật trạng thái sân thành ${status}.`,
      court: result.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi duyệt sân.' });
  }
};

// 4. DUYỆT THẺ HỌC SINH / SINH VIÊN (PENDING_APPROVAL -> VERIFIED / REJECTED)
exports.verifyStudentStatus = async (req, res) => {
  const { userId } = req.params;
  const { status } = req.body; // 'VERIFIED' hoặc 'REJECTED'

  if (!['VERIFIED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ message: 'Trạng thái duyệt sinh viên không hợp lệ.' });
  }

  try {
    const result = await db.query(
      `UPDATE users SET student_status = $1 WHERE id = $2 RETURNING id, full_name, email, student_status`,
      [status, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }

    res.json({
      success: true,
      message: status === 'VERIFIED'
        ? 'Đã xác thực thẻ Học sinh/Sinh viên thành công!'
        : 'Đã từ chối thẻ Học sinh/Sinh viên.',
      user: result.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi duyệt thẻ sinh viên.' });
  }
};

// 5. XEM BÁO CÁO DOANH THU NỀN TẢNG SAAS & DANH SÁCH CHỦ SÂN
exports.getPlatformDashboard = async (req, res) => {
  try {
    const revenueRes = await db.query(
      `SELECT COALESCE(SUM(amount_paid), 0) AS total_saas_revenue,
              COUNT(id) AS total_subscriptions
       FROM tenant_subscriptions
       WHERE payment_status = 'PAID'`
    );

    const tenantStats = await db.query(
      `SELECT status, COUNT(id) AS count
       FROM tenants
       GROUP BY status`
    );

    const recentSubscriptions = await db.query(
      `SELECT ts.*, t.name AS tenant_name, sp.name AS plan_name
       FROM tenant_subscriptions ts
       JOIN tenants t ON ts.tenant_id = t.id
       JOIN subscription_plans sp ON ts.plan_id = sp.id
       ORDER BY ts.created_at DESC LIMIT 10`
    );

    res.json({
      success: true,
      data: {
        saasRevenue: revenueRes.rows[0],
        tenantBreakdown: tenantStats.rows,
        recentSubscriptions: recentSubscriptions.rows
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi tải báo cáo doanh thu Super Admin.' });
  }
};

// 6. TẠO GÓI CƯỚC & GHI NHẬN ĐÓNG PHÍ PHẦN MỀM (Phục vụ Demo Doanh thu SaaS)
exports.recordTenantSubscription = async (req, res) => {
  const { tenantId, planName, pricePerMonth, durationMonths } = req.body;

  try {
    // Tạo hoặc lấy gói cước
    const planRes = await db.query(
      `INSERT INTO subscription_plans (name, price_per_month, max_courts)
       VALUES ($1, $2, 20) RETURNING id`,
      [planName || 'Gói Pro SaaS', pricePerMonth || 1500000]
    );
    const planId = planRes.rows[0].id;

    const months = Number(durationMonths) || 1;
    const amountPaid = Number(pricePerMonth || 1500000) * months;

    const subRes = await db.query(
      `INSERT INTO tenant_subscriptions (tenant_id, plan_id, amount_paid, start_date, end_date, payment_status)
       VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + ($4 || ' months')::interval, 'PAID')
       RETURNING *`,
      [tenantId, planId, amountPaid, months]
    );

    res.status(201).json({
      success: true,
      message: 'Đã ghi nhận doanh thu gói cước phần mềm từ Chủ sân.',
      subscription: subRes.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi ghi nhận phí thuê phần mềm.' });
  }
};