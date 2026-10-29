const db = require('../../config/db');
const { createNotification } = require('../notification/notificationService');

// 1. LẤY DANH SÁCH CA TRỰC CỦA CỤM SÂN (JOIN NHÂN SỰ ĐƯỢC PHÂN CÔNG)
exports.getTenantShifts = async (req, res) => {
  const tenantId = req.tenant.id;
  try {
    const [shiftsRes, staffRes] = await Promise.all([
      db.query(
        `SELECT s.id, s.name, s.start_time, s.end_time, s.assigned_staff_id, s.notes, s.salary_per_shift, s.is_active, s.created_at,
                u.full_name AS staff_name, u.email AS staff_email, u.phone AS staff_phone, u.is_active AS staff_is_active
         FROM tenant_shifts s
         LEFT JOIN users u ON s.assigned_staff_id = u.id
         WHERE s.tenant_id = $1
         ORDER BY s.start_time ASC`,
        [tenantId]
      ),
      db.query(
        `SELECT id, full_name, email, phone, is_active
         FROM users
         WHERE tenant_id = $1 AND role = 'STAFF'
         ORDER BY full_name ASC`,
        [tenantId]
      ),
    ]);

    res.json({
      success: true,
      shifts: shiftsRes.rows,
      staffList: staffRes.rows,
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách ca:', error);
    res.status(500).json({ message: 'Không thể tải danh sách ca trực.' });
  }
};

// 2. CHỦ SÂN TẠO CA TRỰC MỚI & PHÂN CÔNG NHÂN SỰ
exports.createTenantShift = async (req, res) => {
  const tenantId = req.tenant.id;
  const { name, startTime, endTime, assignedStaffId, notes, salaryPerShift = 0 } = req.body;

  if (!name?.trim() || !startTime || !endTime) {
    return res.status(400).json({ message: 'Vui lòng nhập đầy đủ tên ca, giờ bắt đầu và giờ kết thúc.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO tenant_shifts (tenant_id, name, start_time, end_time, assigned_staff_id, notes, salary_per_shift)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tenantId, name.trim(), startTime, endTime, assignedStaffId || null, notes || null, Number(salaryPerShift) || 0]
    );

    // Gửi thông báo đến nhân viên nếu được phân công trực ca
    if (assignedStaffId) {
      try {
        await createNotification({
          userId: assignedStaffId,
          tenantId,
          type: 'TENANT_STATUS',
          title: `Phân công ca trực: ${name.trim()}`,
          message: `Chủ sân đã phân công bạn phụ trách ${name.trim()} (${startTime} – ${endTime}).`,
          link: '/staff'
        });
      } catch (notifErr) {
        console.warn('Không thể gửi thông báo phân ca:', notifErr.message);
      }
    }

    res.status(201).json({ success: true, message: 'Đã tạo ca trực và lưu thông tin nhân sự thành công!', shift: result.rows[0] });
  } catch (error) {
    console.error('Lỗi tạo ca trực:', error);
    res.status(500).json({ message: 'Không thể tạo ca trực mới.' });
  }
};

// 3. CHỦ SÂN CẬP NHẬT CA TRỰC & THAY ĐỔI NHÂN SỰ
exports.updateTenantShift = async (req, res) => {
  const tenantId = req.tenant.id;
  const { id } = req.params;
  const { name, startTime, endTime, assignedStaffId, notes, salaryPerShift, isActive } = req.body;

  try {
    const currentShift = await db.query(
      'SELECT assigned_staff_id, name, start_time, end_time FROM tenant_shifts WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (currentShift.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy ca trực.' });
    }

    const prevStaffId = currentShift.rows[0].assigned_staff_id;

    const result = await db.query(
      `UPDATE tenant_shifts
       SET name = COALESCE($1, name),
           start_time = COALESCE($2, start_time),
           end_time = COALESCE($3, end_time),
           assigned_staff_id = $4,
           notes = $5,
           salary_per_shift = COALESCE($6, salary_per_shift),
           is_active = COALESCE($7, is_active)
       WHERE id = $8 AND tenant_id = $9
       RETURNING *`,
      [
        name,
        startTime,
        endTime,
        assignedStaffId !== undefined ? (assignedStaffId || null) : prevStaffId,
        notes !== undefined ? (notes || null) : null,
        salaryPerShift !== undefined ? Number(salaryPerShift) : undefined,
        isActive,
        id,
        tenantId,
      ]
    );

    // Gửi thông báo đến nhân viên mới nếu có sự thay đổi
    if (assignedStaffId && assignedStaffId !== prevStaffId) {
      try {
        await createNotification({
          userId: assignedStaffId,
          tenantId,
          type: 'TENANT_STATUS',
          title: `Phân công ca trực mới: ${result.rows[0].name}`,
          message: `Chủ sân đã phân công bạn phụ trách ca ${result.rows[0].name} (${result.rows[0].start_time} – ${result.rows[0].end_time}).`,
          link: '/staff'
        });
      } catch (notifErr) {
        console.warn('Không thể gửi thông báo đổi ca:', notifErr.message);
      }
    }

    res.json({ success: true, message: 'Đã cập nhật ca trực và phân công nhân sự thành công!', shift: result.rows[0] });
  } catch (error) {
    console.error('Lỗi cập nhật ca trực:', error);
    res.status(500).json({ message: 'Không thể cập nhật ca trực.' });
  }
};

// 4. PHÂN CÔNG NHANH NHÂN SỰ VÀO CA TRỰC (1-CLICK ASSIGN)
exports.assignShiftStaff = async (req, res) => {
  const tenantId = req.tenant.id;
  const { id } = req.params;
  const { staffId } = req.body;

  try {
    const result = await db.query(
      `UPDATE tenant_shifts
       SET assigned_staff_id = $1
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      [staffId || null, id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy ca trực.' });
    }

    const shift = result.rows[0];

    if (staffId) {
      const staffUser = await db.query('SELECT full_name FROM users WHERE id = $1', [staffId]);
      const staffName = staffUser.rows[0]?.full_name || 'Nhân viên';

      try {
        await createNotification({
          userId: staffId,
          tenantId,
          type: 'TENANT_STATUS',
          title: `Phân công ca trực: ${shift.name}`,
          message: `Chủ sân đã phân công bạn phụ trách ${shift.name} (${shift.start_time} – ${shift.end_time}).`,
          link: '/staff'
        });
      } catch (notifErr) {
        console.warn('Không thể gửi thông báo phân ca:', notifErr.message);
      }

      return res.json({
        success: true,
        message: `Đã phân công ${staffName} phụ trách ${shift.name}!`,
        shift,
      });
    } else {
      return res.json({
        success: true,
        message: `Đã hủy phân công nhân sự cho ${shift.name}.`,
        shift,
      });
    }
  } catch (error) {
    console.error('Lỗi phân công nhân sự:', error);
    res.status(500).json({ message: 'Không thể phân công nhân sự cho ca trực.' });
  }
};

// 5. CHỦ SÂN XÓA CA TRỰC
exports.deleteTenantShift = async (req, res) => {
  const tenantId = req.tenant.id;
  const { id } = req.params;

  try {
    const result = await db.query(
      'DELETE FROM tenant_shifts WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy ca trực.' });
    }
    res.json({ success: true, message: 'Đã xóa ca trực!' });
  } catch (error) {
    console.error('Lỗi xóa ca trực:', error);
    res.status(500).json({ message: 'Không thể xóa ca trực.' });
  }
};

// 6. BÁO CÁO CHẤM CÔNG & HIỆU SUẤT LỄ TÂN THEO CA TRỰC
exports.getStaffShiftAnalytics = async (req, res) => {
  const tenantId = req.tenant.id;
  try {
    const query = `
      SELECT 
        u.id, 
        u.full_name, 
        u.email, 
        u.phone, 
        u.is_active,
        COUNT(sh.id)::int AS total_shifts_completed,
        COALESCE(SUM(sh.court_cash + sh.pos_cash + sh.court_transfer + sh.pos_transfer), 0)::numeric AS total_revenue_handled,
        COALESCE(SUM(sh.actual_cash), 0)::numeric AS total_actual_cash,
        COUNT(CASE WHEN sh.difference = 0 THEN 1 END)::int AS perfect_matches_count,
        COUNT(CASE WHEN sh.difference != 0 THEN 1 END)::int AS mismatched_count,
        MAX(sh.created_at) AS last_handover_at,
        (
          SELECT json_agg(json_build_object('id', ts.id, 'name', ts.name, 'start_time', ts.start_time, 'end_time', ts.end_time, 'salary_per_shift', ts.salary_per_shift))
          FROM tenant_shifts ts
          WHERE ts.assigned_staff_id = u.id AND ts.tenant_id = $1
        ) AS assigned_shifts
      FROM users u
      LEFT JOIN shift_handovers sh ON u.id = sh.staff_id AND sh.tenant_id = $1
      WHERE u.tenant_id = $1 AND u.role = 'STAFF'
      GROUP BY u.id, u.full_name, u.email, u.phone, u.is_active
      ORDER BY total_shifts_completed DESC, u.full_name ASC
    `;
    const result = await db.query(query, [tenantId]);
    res.json({ success: true, staffAnalytics: result.rows });
  } catch (error) {
    console.error('Lỗi phân tích hiệu suất nhân sự:', error);
    res.status(500).json({ message: 'Không thể tải báo cáo hiệu suất nhân sự.' });
  }
};

// 7. LỄ TÂN XEM TỔNG HỢP TÀI CHÍNH TRONG CA (ĐỂ CHỐT CA)
exports.getShiftFinancialSummary = async (req, res) => {
  const tenantId = req.tenant.id;
  let { date, startTime, endTime, shiftId } = req.query;

  try {
    if (shiftId && (!startTime || !endTime)) {
      const sRes = await db.query(
        'SELECT start_time, end_time FROM tenant_shifts WHERE id = $1 AND tenant_id = $2',
        [shiftId, tenantId]
      );
      if (sRes.rows.length > 0) {
        startTime = sRes.rows[0].start_time.slice(0, 5);
        endTime = sRes.rows[0].end_time.slice(0, 5);
      }
    }

    if (!date || !startTime || !endTime) {
      return res.status(400).json({ message: 'Vui lòng cung cấp ngày, giờ bắt đầu và giờ kết thúc ca.' });
    }

    const startIso = `${date}T${startTime}:00`;
    const endIso = `${date}T${endTime}:59`;

    // 1. Tiền mặt vé sân (Thực thu trong ca)
    const courtCashRes = await db.query(
      `SELECT COALESCE(SUM(final_price), 0) AS total, COUNT(id) AS count
       FROM bookings
       WHERE tenant_id = $1
         AND status IN ('CONFIRMED', 'COMPLETED')
         AND payment_method = 'CASH'
         AND updated_at >= $2 AND updated_at <= $3`,
      [tenantId, startIso, endIso]
    );

    // 2. Chuyển khoản vé sân (VietQR trong ca)
    const courtTransferRes = await db.query(
      `SELECT COALESCE(SUM(final_price), 0) AS total, COUNT(id) AS count
       FROM bookings
       WHERE tenant_id = $1
         AND status IN ('CONFIRMED', 'COMPLETED')
         AND (payment_method = 'TRANSFER' OR payment_method IS NULL)
         AND updated_at >= $2 AND updated_at <= $3`,
      [tenantId, startIso, endIso]
    );

    // 3. Tiền mặt bán hàng POS trong ca
    const posCashRes = await db.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS total, COUNT(id) AS count
       FROM pos_orders
       WHERE tenant_id = $1
         AND status = 'COMPLETED'
         AND payment_method = 'CASH'
         AND created_at >= $2 AND created_at <= $3`,
      [tenantId, startIso, endIso]
    );

    // 4. Chuyển khoản bán hàng POS trong ca
    const posTransferRes = await db.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS total, COUNT(id) AS count
       FROM pos_orders
       WHERE tenant_id = $1
         AND status = 'COMPLETED'
         AND payment_method = 'TRANSFER'
         AND created_at >= $2 AND created_at <= $3`,
      [tenantId, startIso, endIso]
    );

    // 5. Tiền hoàn khách hủy trong ca
    const refundsRes = await db.query(
      `SELECT COALESCE(SUM(final_price), 0) AS total, COUNT(id) AS count
       FROM bookings
       WHERE tenant_id = $1
         AND status = 'REFUNDED'
         AND refunded_at >= $2 AND refunded_at <= $3`,
      [tenantId, startIso, endIso]
    );

    const courtCash = Number(courtCashRes.rows[0].total);
    const courtTransfer = Number(courtTransferRes.rows[0].total);
    const posCash = Number(posCashRes.rows[0].total);
    const posTransfer = Number(posTransferRes.rows[0].total);
    const refundsAmount = Number(refundsRes.rows[0].total);

    const expectedCash = courtCash + posCash; // Tiền mặt trong két lễ tân quản lý
    const totalRevenue = courtCash + courtTransfer + posCash + posTransfer;

    res.json({
      success: true,
      date,
      startTime,
      endTime,
      summary: {
        courtCash,
        courtCashCount: Number(courtCashRes.rows[0].count),
        courtTransfer,
        courtTransferCount: Number(courtTransferRes.rows[0].count),
        posCash,
        posCashCount: Number(posCashRes.rows[0].count),
        posTransfer,
        posTransferCount: Number(posTransferRes.rows[0].count),
        refundsAmount,
        refundsCount: Number(refundsRes.rows[0].count),
        expectedCash,
        totalRevenue
      }
    });
  } catch (error) {
    console.error('Lỗi tính doanh thu ca:', error);
    res.status(500).json({ message: 'Không thể tính toán doanh thu ca trực.' });
  }
};

// 8. LỄ TÂN NỘP BIÊN BẢN CHỐT CA & BÀN GIAO
exports.submitShiftHandover = async (req, res) => {
  const tenantId = req.tenant.id;
  const staffId = req.user.id;
  let {
    shiftId,
    shiftName,
    shiftDate,
    startTime,
    endTime,
    courtCash = 0,
    courtTransfer = 0,
    posCash = 0,
    posTransfer = 0,
    refundsAmount = 0,
    expectedCash = 0,
    actualCash = 0,
    note = '',
    receiverName = ''
  } = req.body;

  try {
    if (shiftId && (!shiftName || !startTime || !endTime)) {
      const sRes = await db.query(
        'SELECT name, start_time, end_time FROM tenant_shifts WHERE id = $1 AND tenant_id = $2',
        [shiftId, tenantId]
      );
      if (sRes.rows.length > 0) {
        shiftName = shiftName || sRes.rows[0].name;
        startTime = startTime || sRes.rows[0].start_time;
        endTime = endTime || sRes.rows[0].end_time;
      }
    }

    if (!shiftName || !shiftDate || !startTime || !endTime) {
      return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ thông tin ca trực.' });
    }

    const numExpected = Number(expectedCash);
    const numActual = Number(actualCash);
    const difference = numActual - numExpected;

    const result = await db.query(
      `INSERT INTO shift_handovers (
        tenant_id, staff_id, shift_id, shift_name, shift_date, start_time, end_time,
        court_cash, court_transfer, pos_cash, pos_transfer, refunds_amount,
        expected_cash, actual_cash, difference, note, receiver_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        tenantId, staffId, shiftId || null, shiftName, shiftDate, startTime, endTime,
        courtCash, courtTransfer, posCash, posTransfer, refundsAmount,
        numExpected, numActual, difference, note?.trim(), receiverName?.trim()
      ]
    );

    // Thông báo cho Chủ sân qua Notification Center
    try {
      const ownerRes = await db.query('SELECT owner_id FROM tenants WHERE id = $1', [tenantId]);
      if (ownerRes.rows.length > 0) {
        const ownerId = ownerRes.rows[0].owner_id;
        const diffText = difference === 0
          ? 'Khớp tiền 100%'
          : difference > 0
          ? `Thừa +${difference.toLocaleString()} ₫`
          : `Thiếu ${difference.toLocaleString()} ₫`;

        const staffName = req.user.full_name || req.user.fullName || 'Lễ tân';
        await createNotification({
          userId: ownerId,
          tenantId,
          type: 'SHIFT_HANDOVER',
          title: `Biên bản chốt ca: ${shiftName}`,
          message: `Lễ tân ${staffName} đã chốt ca ${shiftName} (${shiftDate}). Tiền mặt thực tế: ${numActual.toLocaleString()} ₫ (${diffText}).`,
          link: '/tenant/dashboard?tab=STAFF'
        });
      }
    } catch (notifErr) {
      console.warn('Không thể gửi thông báo chốt ca cho chủ sân:', notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Đã hoàn tất chốt ca và bàn giao thành công!',
      handover: result.rows[0]
    });
  } catch (error) {
    console.error('Lỗi lưu biên bản chốt ca:', error);
    res.status(500).json({ message: 'Không thể lưu biên bản chốt ca.' });
  }
};

// 9. XEM LỊCH SỬ BIÊN BẢN CHỐT CA (DÀNH CHO CHỦ SÂN & LỄ TÂN)
exports.getShiftHandovers = async (req, res) => {
  const tenantId = req.tenant.id;
  try {
    const result = await db.query(
      `SELECT sh.*, u.full_name AS staff_name, u.email AS staff_email
       FROM shift_handovers sh
       JOIN users u ON sh.staff_id = u.id
       WHERE sh.tenant_id = $1
       ORDER BY sh.created_at DESC
       LIMIT 50`,
      [tenantId]
    );
    res.json({ success: true, handovers: result.rows });
  } catch (error) {
    console.error('Lỗi lấy lịch sử chốt ca:', error);
    res.status(500).json({ message: 'Không thể tải lịch sử bàn giao ca.' });
  }
};

// 10. KIỂM TRA QUYỀN TRUY CẬP CA TRỰC CỦA NHÂN VIÊN LỄ TÂN
exports.checkStaffShiftAccess = async (req, res) => {
  const tenantId = req.tenant.id;
  const user = req.user;

  // Chủ sân (TENANT_ADMIN) có toàn quyền quản lý, giám sát quầy mọi lúc
  if (user.role === 'TENANT_ADMIN') {
    return res.json({
      success: true,
      canAccess: true,
      role: 'TENANT_ADMIN',
      message: 'Chủ sân có quyền truy cập quầy lễ tân mọi lúc.',
    });
  }

  try {
    const result = await db.query(
      `SELECT id, name, start_time, end_time, notes
       FROM tenant_shifts
       WHERE tenant_id = $1 AND assigned_staff_id = $2 AND is_active = true
       ORDER BY start_time ASC`,
      [tenantId, user.id]
    );

    const assignedShifts = result.rows;
    const now = new Date();
    const currentHours = now.getHours();
    const currentMins = now.getMinutes();
    const currentTotalMins = currentHours * 60 + currentMins;
    const currentTimeStr = `${String(currentHours).padStart(2, '0')}:${String(currentMins).padStart(2, '0')}`;

    if (assignedShifts.length === 0) {
      return res.json({
        success: true,
        canAccess: false,
        status: 'NO_SHIFT_ASSIGNED',
        message: 'Bạn chưa được phân công ca trực nào tại cụm sân này.',
        assignedShifts: [],
        currentTime: currentTimeStr,
      });
    }

    let activeShift = null;
    for (const s of assignedShifts) {
      const [startH, startM] = s.start_time.split(':').map(Number);
      const [endH, endM] = s.end_time.split(':').map(Number);
      const startMinutes = startH * 60 + (startM || 0);
      const endMinutes = endH * 60 + (endM || 0);

      let inShift = false;
      if (startMinutes <= endMinutes) {
        inShift = currentTotalMins >= startMinutes && currentTotalMins < endMinutes;
      } else {
        // Ca qua đêm (ví dụ 22:00 -> 06:00)
        inShift = currentTotalMins >= startMinutes || currentTotalMins < endMinutes;
      }

      if (inShift) {
        activeShift = s;
        break;
      }
    }

    if (activeShift) {
      return res.json({
        success: true,
        canAccess: true,
        status: 'IN_SHIFT',
        currentShift: activeShift,
        assignedShifts,
        currentTime: currentTimeStr,
        message: `Đang trong ${activeShift.name} (${activeShift.start_time} – ${activeShift.end_time}).`,
      });
    } else {
      return res.json({
        success: true,
        canAccess: false,
        status: 'OUT_OF_SHIFT',
        assignedShifts,
        currentTime: currentTimeStr,
        message: 'Hiện chưa tới ca trực của bạn.',
      });
    }
  } catch (error) {
    console.error('Lỗi kiểm tra ca trực nhân viên:', error);
    res.status(500).json({ message: 'Không thể kiểm tra ca trực nhân viên.' });
  }
};
