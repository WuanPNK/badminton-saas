const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./modules/auth/authRoutes');
const adminRoutes = require('./modules/admin/adminRoutes');
const tenantRoutes = require('./modules/tenant/tenantRoutes');
const bookingRoutes = require('./modules/booking/bookingRoutes');
const paymentRoutes = require('./modules/payment/paymentRoutes');
const posRoutes = require('./modules/pos/posRoutes');
const reviewRoutes = require('./modules/review/reviewRoutes');
const notificationRoutes = require('./modules/notification/notificationRoutes');
const shiftRoutes = require('./modules/shift/shiftRoutes');

const app = express();
app.use(cors());
// Tăng giới hạn payload lên 10MB để nhận dữ liệu ảnh tải lên trực tiếp
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Phục vụ file ảnh tĩnh trong thư mục backend/uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Định tuyến đầy đủ 8 Modules kiến trúc Modular Monolithic
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/super-admin', adminRoutes);
app.use('/api/tenant', tenantRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/shifts', shiftRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    message: 'Toàn bộ Backend API hệ thống Đặt sân & POS SaaS đã sẵn sàng 100%!'
  });
});

const http = require('http');
const { initSocket } = require('./config/socket');
const { cleanupExpiredPendingTenants } = require('./utils/cleanup');

const server = http.createServer(app);
initSocket(server);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server đang lắng nghe tại cổng http://localhost:${PORT}`);
  cleanupExpiredPendingTenants();
});
