const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./modules/auth/authRoutes');
const superAdminRoutes = require('./modules/superAdmin/superAdminRoutes');
const tenantRoutes = require('./modules/tenant/tenantRoutes');
const bookingRoutes = require('./modules/booking/bookingRoutes');
const paymentRoutes = require('./modules/payment/paymentRoutes');
const posRoutes = require('./modules/pos/posRoutes');
const reviewRoutes = require('./modules/review/reviewRoutes');

const app = express();
app.use(cors());
app.use(express.json());

// Định tuyến đầy đủ 7 Modules kiến trúc Modular Monolithic
app.use('/api/auth', authRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/tenant', tenantRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/reviews', reviewRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    message: 'Toàn bộ Backend API hệ thống Đặt sân & POS SaaS đã sẵn sàng 100%!'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server đang lắng nghe tại cổng http://localhost:${PORT}`);
});