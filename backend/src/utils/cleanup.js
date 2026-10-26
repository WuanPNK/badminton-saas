const db = require('../config/db');

/**
 * Tự động xóa các tài khoản Chủ sân (TENANT_ADMIN) và Cụm sân ở trạng thái PENDING
 * đã quá hạn 7 ngày kể từ ngày đăng ký mà chưa được Super Admin phê duyệt.
 */
async function cleanupExpiredPendingTenants() {
  try {
    const expiredRes = await db.query(
      `SELECT t.id AS tenant_id, t.owner_id, t.name, t.created_at
       FROM tenants t
       WHERE t.status = 'PENDING' AND t.created_at < NOW() - INTERVAL '7 days'`
    );

    if (expiredRes.rows.length === 0) return 0;

    console.log(`[CLEANUP] Tìm thấy ${expiredRes.rows.length} hồ sơ cụm sân PENDING quá hạn 7 ngày. Bắt đầu dọn dẹp...`);

    for (const row of expiredRes.rows) {
      // 1. Gỡ liên kết tenant_id trên users
      await db.query(`UPDATE users SET tenant_id = NULL WHERE tenant_id = $1 OR id = $2`, [row.tenant_id, row.owner_id]);
      // 2. Xóa các sân (nếu có)
      await db.query(`DELETE FROM courts WHERE tenant_id = $1`, [row.tenant_id]);
      // 3. Xóa cụm sân
      await db.query(`DELETE FROM tenants WHERE id = $1`, [row.tenant_id]);
      // 4. Xóa tài khoản chủ sân tương ứng
      if (row.owner_id) {
        await db.query(`DELETE FROM users WHERE id = $1`, [row.owner_id]);
      }
      console.log(`[CLEANUP] ✓ Đã xóa cụm sân "${row.name}" (ID: ${row.tenant_id}) do quá hạn 7 ngày.`);
    }

    return expiredRes.rows.length;
  } catch (err) {
    console.error('[CLEANUP] Lỗi trong quá trình dọn dẹp cụm sân quá hạn:', err.message);
    return 0;
  }
}

module.exports = { cleanupExpiredPendingTenants };
