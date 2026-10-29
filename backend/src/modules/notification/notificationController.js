const db = require('../../config/db');

/**
 * Lấy danh sách thông báo của người dùng hiện tại (kèm số lượng chưa đọc)
 */
const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    // Lấy tối đa 40 thông báo gần nhất
    const { rows: notifications } = await db.query(
      `SELECT * FROM notifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 40`,
      [userId]
    );

    // Đếm số thông báo chưa đọc
    const countResult = await db.query(
      `SELECT COUNT(*)::int AS unread_count 
       FROM notifications 
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );

    const unreadCount = countResult.rows[0]?.unread_count || 0;

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (err) {
    console.error('Lỗi khi lấy thông báo:', err);
    res.status(500).json({ message: 'Không thể tải danh sách thông báo' });
  }
};

/**
 * Đánh dấu 1 thông báo là đã đọc
 */
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await db.query(
      `UPDATE notifications 
       SET is_read = true 
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    res.json({ success: true, message: 'Đã đánh dấu đã đọc' });
  } catch (err) {
    console.error('Lỗi đánh dấu đã đọc:', err);
    res.status(500).json({ message: 'Không thể cập nhật trạng thái thông báo' });
  }
};

/**
 * Đánh dấu toàn bộ thông báo của người dùng là đã đọc
 */
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await db.query(
      `UPDATE notifications 
       SET is_read = true 
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );

    res.json({ success: true, message: 'Đã đánh dấu tất cả thông báo là đã đọc' });
  } catch (err) {
    console.error('Lỗi đánh dấu tất cả đã đọc:', err);
    res.status(500).json({ message: 'Không thể cập nhật thông báo' });
  }
};

/**
 * Xóa 1 thông báo
 */
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await db.query(
      `DELETE FROM notifications 
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    res.json({ success: true, message: 'Đã xóa thông báo' });
  } catch (err) {
    console.error('Lỗi xóa thông báo:', err);
    res.status(500).json({ message: 'Không thể xóa thông báo' });
  }
};

module.exports = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};

