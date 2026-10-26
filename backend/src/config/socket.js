const { Server } = require('socket.io');

let io = null;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    // Client tham gia phòng theo cụm sân để nhận cập nhật ô sân thời gian thực
    socket.on('join_tenant', (tenantId) => {
      if (tenantId) {
        socket.join(`tenant_${tenantId}`);
        // console.log(`[Socket.io] Client ${socket.id} joined room tenant_${tenantId}`);
      }
    });

    socket.on('leave_tenant', (tenantId) => {
      if (tenantId) {
        socket.leave(`tenant_${tenantId}`);
      }
    });

    socket.on('disconnect', () => {
      // console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });

  console.log('✓ Socket.io đã được khởi tạo thành công!');
  return io;
};

const getIO = () => {
  return io;
};

/**
 * Phát sự kiện cập nhật trạng thái ô sân tới tất cả khách hàng & lễ tân đang xem cụm sân
 * @param {string} tenantId - ID cụm sân
 * @param {object} payload - Dữ liệu cập nhật { type, booking, bookingId, courtId, date }
 */
const notifyBookingUpdate = (tenantId, payload) => {
  if (io) {
    // Phát tới room riêng của cụm sân
    io.to(`tenant_${tenantId}`).emit('booking_updated', {
      tenantId,
      timestamp: new Date().toISOString(),
      ...payload,
    });
    // Đồng thời phát broadcast toàn cục nếu có dashboard tổng quan
    io.emit('global_booking_activity', {
      tenantId,
      timestamp: new Date().toISOString(),
      ...payload,
    });
  }
};

module.exports = {
  initSocket,
  getIO,
  notifyBookingUpdate,
};
