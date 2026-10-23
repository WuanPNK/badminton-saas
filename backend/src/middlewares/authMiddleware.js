const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Không tìm thấy mã xác thực truy cập.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role, tenant_id, student_status }
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
  }
};

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
  } catch (err) {
    // Ignore invalid token in optional mode
  }
  next();
};

// Middleware kiểm tra quyền (SUPER_ADMIN, TENANT_ADMIN, STAFF, USER)
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này.' });
    }
    next();
  };
};

module.exports = { verifyToken, optionalAuth, authorizeRoles };