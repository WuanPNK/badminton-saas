const db = require('../../config/db');
const { sendSocketNotification } = require('../../config/socket');

/**
 * Tạo một thông báo mới cho người dùng
 */
const createNotification = async ({ userId, tenantId = null, type, title, message, link = null }) => {
  try {
    if (!userId) return null;
    const result = await db.query(
      `INSERT INTO notifications (user_id, tenant_id, type, title, message, link)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, tenantId, type, title, message, link]
    );
    const notification = result.rows[0];

    // Phát sự kiện real-time qua socket.io nếu user đang online
    sendSocketNotification(userId, notification);

    return notification;
  } catch (err) {
    console.error('[NotificationService] Lỗi khi tạo thông báo:', err);
    return null;
  }
};

/**
 * Gửi thông báo cho danh sách user_id
 */
const notifyUsers = async (userIds, { tenantId = null, type, title, message, link = null }) => {
  if (!Array.isArray(userIds) || userIds.length === 0) return [];
  const results = [];
  for (const uid of userIds) {
    const notif = await createNotification({ userId: uid, tenantId, type, title, message, link });
    if (notif) results.push(notif);
  }
  return results;
};

/**
 * Gửi thông báo cho toàn bộ Nhân viên và Chủ sân của một cơ sở
 */
const notifyTenantStaffAndOwner = async (tenantId, { type, title, message, link = null }) => {
  try {
    if (!tenantId) return [];
    const { rows } = await db.query(
      `SELECT DISTINCT id FROM users 
       WHERE tenant_id = $1 OR id = (SELECT owner_id FROM tenants WHERE id = $1)`,
      [tenantId]
    );
    const userIds = rows.map(r => r.id);
    return await notifyUsers(userIds, { tenantId, type, title, message, link });
  } catch (err) {
    console.error('[NotificationService] Lỗi thông báo cụm sân:', err);
    return [];
  }
};

/**
 * Gửi thông báo cho toàn bộ Super Admin
 */
const notifyAdmins = async ({ type, title, message, link = null }) => {
  try {
    const { rows } = await db.query(`SELECT id FROM users WHERE role = 'ADMIN'`);
    const userIds = rows.map(r => r.id);
    return await notifyUsers(userIds, { tenantId: null, type, title, message, link });
  } catch (err) {
    console.error('[NotificationService] Lỗi thông báo Admin:', err);
    return [];
  }
};

module.exports = {
  createNotification,
  notifyUsers,
  notifyTenantStaffAndOwner,
  notifyAdmins,
};

