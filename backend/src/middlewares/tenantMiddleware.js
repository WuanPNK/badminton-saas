const db = require('../config/db');

// Kiểm tra tài khoản thuộc về một Cụm sân đang ACTIVE
const verifyActiveTenant = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id;
    if (!tenantId) {
      return res.status(403).json({ message: 'Tài khoản không gắn với cụm sân nào.' });
    }

    const tenantRes = await db.query(`SELECT * FROM tenants WHERE id = $1`, [tenantId]);
    if (tenantRes.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin cụm sân.' });
    }

    const tenant = tenantRes.rows[0];
    if (tenant.status !== 'ACTIVE') {
      return res.status(403).json({
        message: `Cụm sân hiện đang ở trạng thái ${tenant.status}, không thể thao tác.`
      });
    }

    req.tenant = tenant; // Lưu thông tin cụm sân vào request để dùng ở Controller
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi xác thực quyền cụm sân.' });
  }
};

// Kiểm tra Công tắc tính năng (Feature Toggle) của Chủ sân
const requireFeatureToggle = (featureColumn) => {
  return (req, res, next) => {
    if (!req.tenant || !req.tenant[featureColumn]) {
      return res.status(403).json({
        message: `Tính năng (${featureColumn}) hiện đang tắt. Chủ sân vui lòng bật trong phần Cài đặt.`
      });
    }
    next();
  };
};

module.exports = { verifyActiveTenant, requireFeatureToggle };