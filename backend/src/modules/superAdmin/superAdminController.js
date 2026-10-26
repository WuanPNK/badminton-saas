const db = require('../../config/db');
const { cleanupExpiredPendingTenants } = require('../../utils/cleanup');

// 1. LẤY TẤT CẢ DANH SÁCH CHỜ DUYỆT (Chủ sân, Sân mới, Thẻ HSSV)
exports.getPendingApprovals = async (req, res) => {
  try {
    // Tự động dọn dẹp các cụm sân PENDING quá hạn 7 ngày trước khi trả về danh sách
    await cleanupExpiredPendingTenants();
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

    const pendingSubscriptions = await db.query(
      `SELECT ts.*, t.name AS tenant_name, t.district, t.address, t.phone_contact,
              u.full_name AS owner_name, u.email AS owner_email,
              sp.name AS plan_name, sp.max_courts, sp.price_per_month, sp.badge
       FROM tenant_subscriptions ts
       JOIN tenants t ON ts.tenant_id = t.id
       JOIN users u ON t.owner_id = u.id
       JOIN subscription_plans sp ON ts.plan_id = sp.id
       WHERE ts.payment_status = 'PENDING'
       ORDER BY ts.created_at DESC`
    );

    res.json({
      success: true,
      data: {
        pendingTenants: pendingTenants.rows,
        pendingCourts: pendingCourts.rows,
        pendingStudents: pendingStudents.rows,
        pendingSubscriptions: pendingSubscriptions.rows,
      },
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
      tenant: result.rows[0],
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
      court: result.rows[0],
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
      message:
        status === 'VERIFIED'
          ? 'Đã xác thực thẻ Học sinh/Sinh viên thành công!'
          : 'Đã từ chối thẻ Học sinh/Sinh viên.',
      user: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi duyệt thẻ sinh viên.' });
  }
};

// 5. LẤY TẤT CẢ CỤM SÂN (Dành cho Super Admin tra cứu, lọc và phân bổ gói SaaS)
exports.getAllTenants = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT t.*, u.full_name AS owner_name, u.email AS owner_email,
              (SELECT COUNT(*) FROM courts WHERE tenant_id = t.id) AS court_count,
              (SELECT json_build_object(
                  'plan_name', sp.name,
                  'end_date', ts.end_date,
                  'amount_paid', ts.amount_paid,
                  'is_active', ts.end_date >= CURRENT_DATE
                )
               FROM tenant_subscriptions ts
               JOIN subscription_plans sp ON ts.plan_id = sp.id
               WHERE ts.tenant_id = t.id
               ORDER BY ts.end_date DESC LIMIT 1) AS current_subscription
       FROM tenants t
       JOIN users u ON t.owner_id = u.id
       ORDER BY t.created_at DESC`
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi tải danh sách toàn bộ chủ sân.' });
  }
};

// 6. LẤY TẤT CẢ GÓI CƯỚC SAAS
exports.getPlans = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM subscription_plans ORDER BY price_per_month ASC`
    );
    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi tải danh sách gói cước SaaS.' });
  }
};

// 7. TẠO GÓI CƯỚC SAAS MỚI
exports.createPlan = async (req, res) => {
  const {
    name,
    pricePerMonth,
    maxCourts,
    description,
    features,
    commissionRate,
    badge,
    isFeatured,
  } = req.body;

  if (!name || !pricePerMonth) {
    return res.status(400).json({ message: 'Tên gói và giá cước/tháng là bắt buộc.' });
  }

  try {
    const formattedFeatures = Array.isArray(features)
      ? JSON.stringify(features)
      : JSON.stringify(features ? [features] : []);

    const result = await db.query(
      `INSERT INTO subscription_plans (
        name, price_per_month, max_courts, description, features,
        commission_rate, badge, is_featured, is_active
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, true)
      RETURNING *`,
      [
        name,
        pricePerMonth,
        maxCourts || 20,
        description || '',
        formattedFeatures,
        commissionRate || 0,
        badge || '',
        Boolean(isFeatured),
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Đã tạo gói cước SaaS thành công!',
      plan: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi tạo gói cước.' });
  }
};

// 8. CẬP NHẬT GÓI CƯỚC SAAS
exports.updatePlan = async (req, res) => {
  const { id } = req.params;
  const {
    name,
    pricePerMonth,
    maxCourts,
    description,
    features,
    commissionRate,
    badge,
    isFeatured,
    isActive,
  } = req.body;

  try {
    const formattedFeatures = Array.isArray(features)
      ? JSON.stringify(features)
      : JSON.stringify(features ? [features] : []);

    const result = await db.query(
      `UPDATE subscription_plans
       SET name = COALESCE($1, name),
           price_per_month = COALESCE($2, price_per_month),
           max_courts = COALESCE($3, max_courts),
           description = COALESCE($4, description),
           features = COALESCE($5::jsonb, features),
           commission_rate = COALESCE($6, commission_rate),
           badge = COALESCE($7, badge),
           is_featured = COALESCE($8, is_featured),
           is_active = COALESCE($9, is_active)
       WHERE id = $10
       RETURNING *`,
      [
        name,
        pricePerMonth,
        maxCourts,
        description,
        formattedFeatures,
        commissionRate,
        badge,
        isFeatured,
        isActive,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy gói cước.' });
    }

    res.json({
      success: true,
      message: 'Đã cập nhật gói cước SaaS thành công!',
      plan: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi cập nhật gói cước.' });
  }
};

// 9. XÓA HOẶC TẮT GÓI CƯỚC SAAS
exports.deletePlan = async (req, res) => {
  const { id } = req.params;

  try {
    // Kiểm tra xem đã có hợp đồng nào dùng gói này chưa
    const subCheck = await db.query(
      `SELECT COUNT(*) FROM tenant_subscriptions WHERE plan_id = $1`,
      [id]
    );

    if (parseInt(subCheck.rows[0].count) > 0) {
      // Ẩn gói thay vì xóa vật lý để giữ toàn vẹn dữ liệu
      await db.query(`UPDATE subscription_plans SET is_active = false WHERE id = $1`, [id]);
      return res.json({
        success: true,
        message: 'Gói cước đã có chủ sân sử dụng, hệ thống đã chuyển sang trạng thái Tạm ẩn (Ngừng kích hoạt mới).',
      });
    }

    await db.query(`DELETE FROM subscription_plans WHERE id = $1`, [id]);
    res.json({
      success: true,
      message: 'Đã xóa hoàn toàn gói cước SaaS!',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi xóa gói cước.' });
  }
};

// 10. BÁO CÁO DOANH THU NỀN TẢNG SAAS & DỮ LIỆU BIỂU ĐỒ TRỰC QUAN
exports.getPlatformDashboard = async (req, res) => {
  try {
    // Tổng doanh thu SaaS
    const revenueRes = await db.query(
      `SELECT COALESCE(SUM(amount_paid), 0) AS total_saas_revenue,
              COUNT(id) AS total_subscriptions,
              COALESCE(AVG(amount_paid), 0) AS average_deal
       FROM tenant_subscriptions
       WHERE payment_status = 'PAID'`
    );

    // Doanh thu tháng này
    const thisMonthRes = await db.query(
      `SELECT COALESCE(SUM(amount_paid), 0) AS this_month_revenue,
              COUNT(id) AS this_month_subscriptions
       FROM tenant_subscriptions
       WHERE payment_status = 'PAID'
         AND created_at >= date_trunc('month', CURRENT_DATE)`
    );

    // Số cụm sân theo trạng thái
    const tenantStats = await db.query(
      `SELECT status, COUNT(id) AS count
       FROM tenants
       GROUP BY status`
    );

    // Danh sách hợp đồng thuê phần mềm gần đây
    const recentSubscriptions = await db.query(
      `SELECT ts.*, t.name AS tenant_name, t.district, sp.name AS plan_name, sp.max_courts
       FROM tenant_subscriptions ts
       JOIN tenants t ON ts.tenant_id = t.id
       JOIN subscription_plans sp ON ts.plan_id = sp.id
       ORDER BY ts.created_at DESC LIMIT 15`
    );

    // Tỷ trọng doanh thu theo từng gói cước (Dành cho Biểu đồ Tròn / Donut)
    const planBreakdown = await db.query(
      `SELECT sp.name AS plan_name,
              sp.badge,
              COALESCE(SUM(ts.amount_paid), 0) AS total_amount,
              COUNT(ts.id) AS sub_count
       FROM subscription_plans sp
       LEFT JOIN tenant_subscriptions ts ON sp.id = ts.plan_id AND ts.payment_status = 'PAID'
       GROUP BY sp.id, sp.name, sp.badge
       ORDER BY total_amount DESC`
    );

    // Xếp hạng đóng góp doanh thu của các cụm sân (Top Tenants)
    const tenantRanking = await db.query(
      `SELECT t.id, t.name AS tenant_name, t.district,
              COALESCE(SUM(ts.amount_paid), 0) AS total_paid,
              COUNT(ts.id) AS subscription_count,
              MAX(ts.end_date) AS latest_expiry
       FROM tenants t
       LEFT JOIN tenant_subscriptions ts ON t.id = ts.tenant_id AND ts.payment_status = 'PAID'
       GROUP BY t.id, t.name, t.district
       ORDER BY total_paid DESC LIMIT 10`
    );

    // Chuỗi thời gian doanh thu 6 tháng gần nhất (Dành cho Biểu đồ Cột & Đường Xu hướng)
    // Tạo 6 tháng gần nhất liên tục để chart luôn đầy đủ
    const monthlySeries = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const monthKey = `${year}-${month}`;
      const monthLabel = `T${d.getMonth() + 1}/${year}`;
      monthlySeries.push({ monthKey, monthLabel, totalRevenue: 0, subCount: 0 });
    }

    const monthlyDb = await db.query(
      `SELECT to_char(created_at, 'YYYY-MM') AS month_key,
              COALESCE(SUM(amount_paid), 0) AS total_revenue,
              COUNT(id) AS sub_count
       FROM tenant_subscriptions
       WHERE payment_status = 'PAID'
         AND created_at >= (CURRENT_DATE - interval '6 months')
       GROUP BY month_key
       ORDER BY month_key ASC`
    );

    monthlyDb.rows.forEach((row) => {
      const found = monthlySeries.find((m) => m.monthKey === row.month_key);
      if (found) {
        found.totalRevenue = Number(row.total_revenue || 0);
        found.subCount = Number(row.sub_count || 0);
      }
    });

    // Thống kê số lượng chờ duyệt
    const pendingCountsRes = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM tenants WHERE status = 'PENDING') AS pending_tenants,
        (SELECT COUNT(*) FROM courts WHERE status = 'PENDING') AS pending_courts,
        (SELECT COUNT(*) FROM users WHERE student_status = 'PENDING_APPROVAL') AS pending_students,
        (SELECT COUNT(*) FROM tenant_subscriptions WHERE payment_status = 'PENDING') AS pending_subscriptions
    `);

    res.json({
      success: true,
      data: {
        saasRevenue: {
          total_saas_revenue: Number(revenueRes.rows[0]?.total_saas_revenue || 0),
          total_subscriptions: Number(revenueRes.rows[0]?.total_subscriptions || 0),
          average_deal: Number(revenueRes.rows[0]?.average_deal || 0),
          this_month_revenue: Number(thisMonthRes.rows[0]?.this_month_revenue || 0),
          this_month_subscriptions: Number(thisMonthRes.rows[0]?.this_month_subscriptions || 0),
        },
        monthlyRevenue: monthlySeries,
        planDistribution: planBreakdown.rows.map((p) => ({
          plan_name: p.plan_name,
          badge: p.badge,
          total_amount: Number(p.total_amount || 0),
          sub_count: Number(p.sub_count || 0),
        })),
        tenantRanking: tenantRanking.rows.map((t) => ({
          ...t,
          total_paid: Number(t.total_paid || 0),
          subscription_count: Number(t.subscription_count || 0),
        })),
        tenantBreakdown: tenantStats.rows,
        recentSubscriptions: recentSubscriptions.rows,
        pendingCounts: pendingCountsRes.rows[0] || {
          pending_tenants: 0,
          pending_courts: 0,
          pending_students: 0,
        },
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi tải báo cáo doanh thu Super Admin.' });
  }
};

// 11. GHI NHẬN HỢP ĐỒNG / GIA HẠN GÓI CƯỚC SAAS CHO CHỦ SÂN
exports.recordTenantSubscription = async (req, res) => {
  const { tenantId, planId, planName, pricePerMonth, durationMonths, discountPercent } = req.body;

  if (!tenantId) {
    return res.status(400).json({ message: 'Vui lòng chọn hoặc nhập mã Cụm sân (Tenant ID).' });
  }

  try {
    let resolvedPlanId = planId;

    // Nếu không truyền planId, tìm hoặc tạo gói mới theo tên
    if (!resolvedPlanId) {
      const planCheck = await db.query(
        `SELECT id FROM subscription_plans WHERE name = $1 LIMIT 1`,
        [planName || 'Gói Chuyên Nghiệp (Pro SaaS)']
      );
      if (planCheck.rows.length > 0) {
        resolvedPlanId = planCheck.rows[0].id;
      } else {
        const newPlan = await db.query(
          `INSERT INTO subscription_plans (name, price_per_month, max_courts, description, is_active)
           VALUES ($1, $2, 20, 'Gói cấu hình linh hoạt', true) RETURNING id`,
          [planName || 'Gói Tùy Chỉnh SaaS', pricePerMonth || 1500000]
        );
        resolvedPlanId = newPlan.rows[0].id;
      }
    }

    const months = Math.max(Number(durationMonths) || 1, 1);
    const monthlyRate = Number(pricePerMonth) || 1500000;
    const discount = Math.min(Math.max(Number(discountPercent) || 0, 0), 100);

    const grossAmount = monthlyRate * months;
    const amountPaid = Math.round(grossAmount * (1 - discount / 100));

    const subRes = await db.query(
      `INSERT INTO tenant_subscriptions (tenant_id, plan_id, amount_paid, start_date, end_date, payment_status)
       VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + ($4 || ' months')::interval, 'PAID')
       RETURNING *`,
      [tenantId, resolvedPlanId, amountPaid, months]
    );

    // Nếu cụm sân này đang ở trạng thái PENDING thì tự động kích hoạt ACTIVE luôn
    await db.query(`UPDATE tenants SET status = 'ACTIVE' WHERE id = $1 AND status = 'PENDING'`, [
      tenantId,
    ]);

    res.status(201).json({
      success: true,
      message: `Đã kích hoạt hợp đồng SaaS (${months} tháng) cho cụm sân thành công! Tổng thu: ${amountPaid.toLocaleString()} ₫`,
      subscription: subRes.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi ghi nhận hợp đồng phần mềm.' });
  }
};

// 7. Xuất Dữ Liệu Doanh Thu SaaS Nền Tảng Cho Kế Toán Super Admin (Excel / CSV)
exports.getSuperAdminRevenueExport = async (req, res) => {
  try {
    // 7.1. Tổng quan các chỉ số tài chính SaaS
    const revenueRes = await db.query(
      `SELECT COALESCE(SUM(amount_paid), 0) AS total_saas_revenue,
              COUNT(id) AS total_subscriptions,
              COALESCE(AVG(amount_paid), 0) AS average_deal
       FROM tenant_subscriptions
       WHERE payment_status = 'PAID'`
    );

    const thisMonthRes = await db.query(
      `SELECT COALESCE(SUM(amount_paid), 0) AS this_month_revenue,
              COUNT(id) AS this_month_subscriptions
       FROM tenant_subscriptions
       WHERE payment_status = 'PAID'
         AND created_at >= date_trunc('month', CURRENT_DATE)`
    );

    // 7.2. Toàn bộ sổ cái hợp đồng thuê SaaS (All Subscriptions Ledger)
    const subscriptionsRes = await db.query(
      `SELECT ts.id, ts.amount_paid, ts.start_date, ts.end_date, ts.payment_status, ts.created_at,
              t.name AS tenant_name, t.district, t.address, t.phone_contact,
              u.full_name AS owner_name, u.email AS owner_email,
              sp.name AS plan_name, sp.badge, sp.max_courts
       FROM tenant_subscriptions ts
       JOIN tenants t ON ts.tenant_id = t.id
       LEFT JOIN users u ON t.owner_id = u.id
       JOIN subscription_plans sp ON ts.plan_id = sp.id
       ORDER BY ts.created_at DESC`
    );

    // 7.3. Phân bổ doanh thu theo gói cước
    const planBreakdown = await db.query(
      `SELECT sp.name AS plan_name,
              sp.badge,
              COALESCE(SUM(ts.amount_paid), 0) AS total_amount,
              COUNT(ts.id) AS sub_count
       FROM subscription_plans sp
       LEFT JOIN tenant_subscriptions ts ON sp.id = ts.plan_id AND ts.payment_status = 'PAID'
       GROUP BY sp.id, sp.name, sp.badge
       ORDER BY total_amount DESC`
    );

    // 7.4. Xếp hạng đóng góp của các cụm sân
    const tenantRanking = await db.query(
      `SELECT t.id, t.name AS tenant_name, t.district, t.address,
              COALESCE(SUM(ts.amount_paid), 0) AS total_paid,
              COUNT(ts.id) AS subscription_count,
              MAX(ts.end_date) AS latest_expiry
       FROM tenants t
       LEFT JOIN tenant_subscriptions ts ON t.id = ts.tenant_id AND ts.payment_status = 'PAID'
       GROUP BY t.id, t.name, t.district, t.address
       ORDER BY total_paid DESC`
    );

    // 7.5. Doanh thu theo từng tháng (12 tháng gần nhất)
    const monthlyDb = await db.query(
      `SELECT to_char(created_at, 'YYYY-MM') AS month_key,
              to_char(created_at, 'TMMonth YYYY') AS month_label,
              COALESCE(SUM(amount_paid), 0) AS total_revenue,
              COUNT(id) AS sub_count
       FROM tenant_subscriptions
       WHERE payment_status = 'PAID'
       GROUP BY month_key, month_label
       ORDER BY month_key DESC`
    );

    res.json({
      success: true,
      exportData: {
        exportedAt: new Date().toISOString(),
        platformName: 'Badminton SaaS Multi-Tenant Platform',
        summary: {
          total_saas_revenue: Number(revenueRes.rows[0]?.total_saas_revenue || 0),
          total_subscriptions: Number(revenueRes.rows[0]?.total_subscriptions || 0),
          average_deal: Number(revenueRes.rows[0]?.average_deal || 0),
          this_month_revenue: Number(thisMonthRes.rows[0]?.this_month_revenue || 0),
          this_month_subscriptions: Number(thisMonthRes.rows[0]?.this_month_subscriptions || 0),
        },
        subscriptions: subscriptionsRes.rows,
        planDistribution: planBreakdown.rows.map((p) => ({
          plan_name: p.plan_name,
          badge: p.badge,
          total_amount: Number(p.total_amount || 0),
          sub_count: Number(p.sub_count || 0),
        })),
        tenantRanking: tenantRanking.rows.map((t) => ({
          ...t,
          total_paid: Number(t.total_paid || 0),
          subscription_count: Number(t.subscription_count || 0),
        })),
        monthlyRevenue: monthlyDb.rows.map((m) => ({
          ...m,
          total_revenue: Number(m.total_revenue || 0),
          sub_count: Number(m.sub_count || 0),
        })),
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi trích xuất báo cáo doanh thu SaaS Super Admin.' });
  }
};

// 13. LẤY DANH SÁCH YÊU CẦU ĐĂNG KÝ GÓI CƯỚC CHỜ DUYỆT (CHỦ SÂN GỬI)
exports.getPendingSubscriptions = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT ts.*, t.name AS tenant_name, t.district, t.address, t.phone_contact,
              u.full_name AS owner_name, u.email AS owner_email,
              sp.name AS plan_name, sp.max_courts, sp.price_per_month, sp.badge
       FROM tenant_subscriptions ts
       JOIN tenants t ON ts.tenant_id = t.id
       JOIN users u ON t.owner_id = u.id
       JOIN subscription_plans sp ON ts.plan_id = sp.id
       WHERE ts.payment_status = 'PENDING'
       ORDER BY ts.created_at DESC`
    );

    res.json({
      success: true,
      pendingSubscriptions: result.rows,
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách gói cước chờ duyệt:', error);
    res.status(500).json({ message: 'Lỗi khi tải danh sách gói cước chờ duyệt.' });
  }
};

// 14. PHÊ DUYỆT KÍCH HOẠT GÓI CƯỚC CHO CHỦ SÂN
exports.approveSubscription = async (req, res) => {
  const { id } = req.params;

  try {
    const subCheck = await db.query(
      `SELECT ts.*, sp.name AS plan_name, sp.price_per_month, t.name AS tenant_name, t.status AS tenant_status
       FROM tenant_subscriptions ts
       JOIN subscription_plans sp ON ts.plan_id = sp.id
       JOIN tenants t ON ts.tenant_id = t.id
       WHERE ts.id = $1`,
      [id]
    );

    if (subCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy yêu cầu đăng ký gói cước.' });
    }

    const sub = subCheck.rows[0];

    let intervalString = '1 month';
    if (sub.billing_cycle === '6_MONTHS') {
      intervalString = '6 months';
    } else if (sub.billing_cycle === 'YEARLY') {
      intervalString = '12 months';
    }

    const updateRes = await db.query(
      `UPDATE tenant_subscriptions
       SET payment_status = 'PAID',
           start_date = CURRENT_DATE,
           end_date = CURRENT_DATE + $1::interval,
           approved_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [intervalString, id]
    );

    // Nếu cụm sân này đang ở trạng thái PENDING thì tự động kích hoạt ACTIVE luôn
    if (sub.tenant_status === 'PENDING') {
      await db.query(`UPDATE tenants SET status = 'ACTIVE' WHERE id = $1`, [sub.tenant_id]);
    }

    res.json({
      success: true,
      message: `Đã phê duyệt và kích hoạt thành công ${sub.plan_name} cho cụm sân ${sub.tenant_name}!`,
      subscription: updateRes.rows[0],
    });
  } catch (error) {
    console.error('Lỗi phê duyệt gói cước:', error);
    res.status(500).json({ message: 'Lỗi khi phê duyệt gói cước.' });
  }
};

// 15. TỪ CHỐI DUYỆT GÓI CƯỚC & HOÀN TIỀN VỀ TÀI KHOẢN CHỦ SÂN
exports.rejectSubscription = async (req, res) => {
  const { id } = req.params;
  const { rejectionReason } = req.body;

  try {
    const subCheck = await db.query(
      `SELECT ts.*, sp.name AS plan_name, t.name AS tenant_name
       FROM tenant_subscriptions ts
       JOIN subscription_plans sp ON ts.plan_id = sp.id
       JOIN tenants t ON ts.tenant_id = t.id
       WHERE ts.id = $1`,
      [id]
    );

    if (subCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy yêu cầu đăng ký gói cước.' });
    }

    const sub = subCheck.rows[0];

    const updateRes = await db.query(
      `UPDATE tenant_subscriptions
       SET payment_status = 'REFUNDED',
           refunded_at = NOW(),
           rejection_reason = $1
       WHERE id = $2
       RETURNING *`,
      [rejectionReason || 'Super Admin từ chối phê duyệt gói cước', id]
    );

    const bankInfo = sub.refund_bank_name
      ? `${sub.refund_bank_name} - STK: ${sub.refund_account_number} (${sub.refund_account_name})`
      : 'Tài khoản ngân hàng của chủ sân';

    res.json({
      success: true,
      message: `Đã từ chối gói cước cho cụm sân ${sub.tenant_name}. Hệ thống đã xác nhận hoàn tiền ${Number(sub.amount_paid).toLocaleString()} ₫ về ${bankInfo}.`,
      subscription: updateRes.rows[0],
    });
  } catch (error) {
    console.error('Lỗi từ chối gói cước:', error);
    res.status(500).json({ message: 'Lỗi khi từ chối gói cước.' });
  }
};