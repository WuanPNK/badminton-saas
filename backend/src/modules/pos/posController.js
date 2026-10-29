const { notifyTenantStaffAndOwner } = require('../notification/notificationService');
const db = require('../../config/db');

// 1. LẤY DANH SÁCH SẢN PHẨM KHO (NƯỚC UỐNG, CẦU LÔNG, THUÊ VỢT)
exports.getProducts = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM products
       WHERE tenant_id = $1 AND is_active = TRUE
       ORDER BY category ASC, name ASC`,
      [req.tenant.id]
    );
    res.json({ success: true, products: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi tải danh sách sản phẩm POS.' });
  }
};

// 2. CHỦ SÂN THÊM SẢN PHẨM MỚI VÀO KHO
exports.createProduct = async (req, res) => {
  const { name, category, price, stockQuantity } = req.body;
  // category: 'DRINK' | 'SHUTTLECOCK' | 'RACKET_RENTAL'

  if (!name || price === undefined) {
    return res.status(400).json({ message: 'Vui lòng nhập tên sản phẩm và đơn giá.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO products (tenant_id, name, category, price, stock_quantity)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        req.tenant.id,
        name,
        category || 'DRINK',
        Number(price),
        Number(stockQuantity || 0)
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Đã thêm sản phẩm vào kho POS thành công!',
      product: result.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi thêm sản phẩm.' });
  }
};

// 3. CẬP NHẬT GIÁ HOẶC NHẬP THÊM TỒN KHO
exports.updateProduct = async (req, res) => {
  const { productId } = req.params;
  const { name, category, price, stockQuantity, isActive } = req.body;

  try {
    const result = await db.query(
      `UPDATE products SET
        name = COALESCE($1, name),
        category = COALESCE($2, category),
        price = COALESCE($3, price),
        stock_quantity = COALESCE($4, stock_quantity),
        is_active = COALESCE($5, is_active)
       WHERE id = $6 AND tenant_id = $7 RETURNING *`,
      [name, category, price, stockQuantity, isActive, productId, req.tenant.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm.' });
    }

    res.json({
      success: true,
      message: 'Đã cập nhật sản phẩm thành công!',
      product: result.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi cập nhật sản phẩm.' });
  }
};

// 3b. XÓA SẢN PHẨM KHỎI KHO POS (KIỂM TRA LỊCH SỬ HÓA ĐƠN ĐỂ TRÁNH MẤT TOÀN VẸN)
exports.deleteProduct = async (req, res) => {
  const { productId } = req.params;
  try {
    const inUse = await db.query(
      `SELECT 1 FROM pos_order_items WHERE product_id = $1 LIMIT 1`,
      [productId]
    );

    if (inUse.rows.length > 0) {
      await db.query(
        `UPDATE products SET is_active = FALSE WHERE id = $1 AND tenant_id = $2`,
        [productId, req.tenant.id]
      );
      return res.json({
        success: true,
        message: 'Mặt hàng này đã có trong lịch sử hóa đơn, hệ thống đã chuyển sang trạng thái Ngừng kinh doanh (Ẩn khỏi kho).'
      });
    }

    await db.query(`DELETE FROM products WHERE id = $1 AND tenant_id = $2`, [
      productId,
      req.tenant.id
    ]);

    res.json({ success: true, message: 'Đã xóa mặt hàng khỏi kho POS!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi xóa sản phẩm.' });
  }
};

// 4. LỄ TÂN / CHỦ SÂN TẠO HÓA ĐƠN BÁN HÀNG TẠI QUẦY (CHECKOUT POS BẰNG TRANSACTION)
exports.createPosOrder = async (req, res) => {
  const tenantId = req.tenant.id;
  const staffId = req.user.id;
  const { bookingId, courtId, note, paymentMethod, items } = req.body;
  // items: [{ productId, quantity }, ...]

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Giỏ hàng POS đang trống.' });
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN'); // Bắt đầu Transaction

    let totalAmount = 0;
    const verifiedItems = [];

    // Kiểm tra từng mặt hàng và khóa dòng dữ liệu (FOR UPDATE) để tránh âm kho
    for (const item of items) {
      const prodRes = await client.query(
        `SELECT id, name, price, stock_quantity
         FROM products
         WHERE id = $1 AND tenant_id = $2 AND is_active = TRUE
         FOR UPDATE`,
        [item.productId, tenantId]
      );

      if (prodRes.rows.length === 0) {
        throw new Error('Một sản phẩm trong giỏ hàng không tồn tại hoặc đã ngừng bán.');
      }

      const product = prodRes.rows[0];
      const qty = Number(item.quantity);

      if (qty <= 0) {
        throw new Error(`Số lượng mua của "${product.name}" không hợp lệ.`);
      }

      if (product.stock_quantity < qty) {
        throw new Error(
          `Sản phẩm "${product.name}" chỉ còn ${product.stock_quantity} trong kho, không đủ số lượng yêu cầu (${qty}).`
        );
      }

      // Trừ tồn kho
      await client.query(
        `UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2`,
        [qty, product.id]
      );

      const unitPrice = Number(product.price);
      totalAmount += unitPrice * qty;

      verifiedItems.push({
        productId: product.id,
        quantity: qty,
        unitPrice
      });
    }

    // Tạo hóa đơn tổng (pos_orders) kèm thông tin Sân đang thanh toán
    const orderRes = await client.query(
      `INSERT INTO pos_orders (tenant_id, staff_id, booking_id, court_id, note, total_amount, payment_method)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [tenantId, staffId, bookingId || null, courtId || null, note || null, totalAmount, paymentMethod || 'CASH']
    );

    const newOrder = orderRes.rows[0];

    // Lưu chi tiết từng món (pos_order_items)
    for (const vItem of verifiedItems) {
      await client.query(
        `INSERT INTO pos_order_items (order_id, product_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [newOrder.id, vItem.productId, vItem.quantity, vItem.unitPrice]
      );
    }

    await client.query('COMMIT'); // Chốt giao dịch thành công

    // Kiểm tra cảnh báo tồn kho thấp (dưới 5 sản phẩm)
    (async () => {
      try {
        for (const item of verifiedItems) {
          const prodRes = await db.query('SELECT name, stock_quantity FROM products WHERE id = $1', [item.productId]);
          if (prodRes.rows.length > 0 && prodRes.rows[0].stock_quantity <= 5) {
            notifyTenantStaffAndOwner(tenantId, {
              type: 'POS_LOW_STOCK',
              title: 'Cảnh báo sắp hết hàng POS',
              message: `Sản phẩm "${prodRes.rows[0].name}" chỉ còn ${prodRes.rows[0].stock_quantity} món trong kho. Vui lòng nhập thêm.`,
              link: '/staff',
            });
          }
        }
      } catch (err) {
        console.error('Lỗi kiểm tra tồn kho cảnh báo:', err);
      }
    })();

    res.status(201).json({
      success: true,
      message: 'Thanh toán hóa đơn POS và trừ kho thành công!',
      order: newOrder
    });
  } catch (error) {
    await client.query('ROLLBACK'); // Hoàn tác toàn bộ nếu có lỗi
    res.status(400).json({ message: error.message || 'Lỗi khi tạo hóa đơn POS.' });
  } finally {
    client.release();
  }
};

// 5. XEM LỊCH SỬ HÓA ĐƠN POS TẠI QUẦY (KÈM CHI TIẾT MÓN VÀ THÔNG TIN HỦY)
exports.getPosOrders = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT po.*, 
              u.full_name AS staff_name,
              cu.full_name AS cancelled_by_name,
              b.booking_code, 
              c.name AS court_name,
              COALESCE(
                (
                  SELECT json_agg(
                    json_build_object(
                      'product_id', poi.product_id,
                      'product_name', p.name,
                      'quantity', poi.quantity,
                      'unit_price', poi.unit_price,
                      'total_item_price', (poi.quantity * poi.unit_price)
                    )
                  )
                  FROM pos_order_items poi
                  JOIN products p ON poi.product_id = p.id
                  WHERE poi.order_id = po.id
                ), '[]'::json
              ) AS items
       FROM pos_orders po
       JOIN users u ON po.staff_id = u.id
       LEFT JOIN users cu ON po.cancelled_by = cu.id
       LEFT JOIN bookings b ON po.booking_id = b.id
       LEFT JOIN courts c ON po.court_id = c.id
       WHERE po.tenant_id = $1
       ORDER BY po.created_at DESC LIMIT 100`,
      [req.tenant.id]
    );

    res.json({ success: true, orders: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi tải lịch sử hóa đơn POS.' });
  }
};

// 6. BÁO CÁO DOANH THU & PHÂN TÍCH DÀNH CHO CHỦ SÂN (TENANT ANALYTICS)
exports.getTenantAnalytics = async (req, res) => {
  const tenantId = req.tenant.id;

  try {
    // 6.1. Doanh thu tiền sân (Từ các đơn CONFIRMED và COMPLETED)
    const bookingStats = await db.query(
      `SELECT
         COALESCE(SUM(final_price) FILTER (WHERE status IN ('CONFIRMED', 'COMPLETED')), 0) AS court_revenue,
         COUNT(id) FILTER (WHERE status IN ('CONFIRMED', 'COMPLETED')) AS paid_bookings_count,
         COUNT(id) FILTER (WHERE status = 'PENDING_REFUND') AS pending_refund_count,
         COALESCE(SUM(final_price) FILTER (WHERE status = 'REFUNDED'), 0) AS total_refunded_amount
       FROM bookings
       WHERE tenant_id = $1`,
      [tenantId]
    );

    // 6.2. Doanh thu bán hàng POS (Chỉ tính các đơn chưa bị hủy)
    const posStats = await db.query(
      `SELECT
         COALESCE(SUM(total_amount) FILTER (WHERE status != 'CANCELLED' OR status IS NULL), 0) AS pos_revenue,
         COUNT(id) FILTER (WHERE status != 'CANCELLED' OR status IS NULL) AS total_pos_orders
       FROM pos_orders
       WHERE tenant_id = $1`,
      [tenantId]
    );

    // 6.3. Nếu Chủ sân bật công tắc "Báo cáo chuyên sâu" (enable_advanced_analytics = TRUE)
    let advancedData = null;
    if (req.tenant.enable_advanced_analytics) {
      const revenueByCourt = await db.query(
        `SELECT c.name AS court_name, c.type,
                COUNT(b.id) AS total_bookings,
                COALESCE(SUM(b.final_price), 0) AS revenue
         FROM courts c
         LEFT JOIN bookings b ON c.id = b.court_id AND b.status IN ('CONFIRMED', 'COMPLETED')
         WHERE c.tenant_id = $1
         GROUP BY c.id
         ORDER BY revenue DESC`,
        [tenantId]
      );

      const topProducts = await db.query(
        `SELECT p.name, p.category,
                COALESCE(SUM(poi.quantity), 0) AS total_sold,
                COALESCE(SUM(poi.quantity * poi.unit_price), 0) AS revenue
         FROM products p
         JOIN pos_order_items poi ON p.id = poi.product_id
         JOIN pos_orders po ON poi.order_id = po.id
         WHERE p.tenant_id = $1 AND (po.status != 'CANCELLED' OR po.status IS NULL)
         GROUP BY p.id
         ORDER BY total_sold DESC LIMIT 5`,
        [tenantId]
      );

      advancedData = {
        revenueByCourt: revenueByCourt.rows,
        topProducts: topProducts.rows
      };
    }

    const courtRev = Number(bookingStats.rows[0].court_revenue);
    const posRev = Number(posStats.rows[0].pos_revenue);
    const totalRev = courtRev + posRev;

    // 6.4. Dữ liệu biểu đồ 7 ngày gần nhất (Daily Revenue Trend - loại trừ đơn bị hủy)
    const paidBookingsAll = await db.query(
      `SELECT start_time, final_price, status
       FROM bookings
       WHERE tenant_id = $1 AND status IN ('CONFIRMED', 'COMPLETED')`,
      [tenantId]
    );

    const paidPosAll = await db.query(
      `SELECT created_at, total_amount
       FROM pos_orders
       WHERE tenant_id = $1 AND (status != 'CANCELLED' OR status IS NULL)`,
      [tenantId]
    );

    const dayMap = {};
    const dayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const last7Days = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split('T')[0];
      const item = {
        date: dateKey,
        dayLabel: dayLabels[d.getDay()],
        displayDate: `${d.getDate()}/${d.getMonth() + 1}`,
        courtRevenue: 0,
        posRevenue: 0,
        totalRevenue: 0,
        bookingCount: 0
      };
      dayMap[dateKey] = item;
      last7Days.push(item);
    }

    paidBookingsAll.rows.forEach((b) => {
      const bDate = new Date(b.start_time);
      const dateKey = bDate.toISOString().split('T')[0];
      if (dayMap[dateKey]) {
        const val = Number(b.final_price) || 0;
        dayMap[dateKey].courtRevenue += val;
        dayMap[dateKey].totalRevenue += val;
        dayMap[dateKey].bookingCount += 1;
      }
    });

    paidPosAll.rows.forEach((p) => {
      const pDate = new Date(p.created_at);
      const dateKey = pDate.toISOString().split('T')[0];
      if (dayMap[dateKey]) {
        const val = Number(p.total_amount) || 0;
        dayMap[dateKey].posRevenue += val;
        dayMap[dateKey].totalRevenue += val;
      }
    });

    // 6.5. Dữ liệu phân bổ khung giờ cao điểm (Peak Hours Distribution)
    const timeSlots = [
      { slot: '05:00 - 09:00', title: 'Sáng sớm', count: 0 },
      { slot: '09:00 - 14:00', title: 'Ban ngày', count: 0 },
      { slot: '14:00 - 17:00', title: 'Chiều', count: 0 },
      { slot: '17:00 - 20:00', title: 'Giờ vàng 🔥', count: 0 },
      { slot: '20:00 - 22:00', title: 'Tối muộn', count: 0 }
    ];

    paidBookingsAll.rows.forEach((b) => {
      const bDate = new Date(b.start_time);
      const hour = bDate.getHours();
      if (hour >= 5 && hour < 9) timeSlots[0].count++;
      else if (hour >= 9 && hour < 14) timeSlots[1].count++;
      else if (hour >= 14 && hour < 17) timeSlots[2].count++;
      else if (hour >= 17 && hour < 20) timeSlots[3].count++;
      else if (hour >= 20 && hour <= 22) timeSlots[4].count++;
    });

    res.json({
      success: true,
      summary: {
        totalRevenue: totalRev,
        courtRevenue: courtRev,
        posRevenue: posRev,
        paidBookingsCount: Number(bookingStats.rows[0].paid_bookings_count),
        pendingRefundCount: Number(bookingStats.rows[0].pending_refund_count),
        totalRefundedAmount: Number(bookingStats.rows[0].total_refunded_amount),
        totalPosOrders: Number(posStats.rows[0].total_pos_orders)
      },
      chartData: {
        dailyTrends: last7Days,
        timeSlots,
        revenueSplit: {
          courtPercent: totalRev > 0 ? Math.round((courtRev / totalRev) * 100) : 100,
          posPercent: totalRev > 0 ? Math.round((posRev / totalRev) * 100) : 0,
        }
      },
      advancedAnalyticsEnabled: req.tenant.enable_advanced_analytics,
      advancedData
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi tải báo cáo thống kê cụm sân.' });
  }
};

// 7. LỄ TÂN / CHỦ SÂN HỦY HÓA ĐƠN POS VÀ HOÀN TRẢ TỒN KHO (TRANSACTION)
// Khóa thời gian 30 phút đối với Lễ tân (STAFF)
exports.cancelPosOrder = async (req, res) => {
  const { orderId } = req.params;
  const { reason } = req.body;
  const tenantId = req.tenant.id;
  const userId = req.user.id;
  const userRole = req.user.role;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lấy thông tin đơn hàng và khóa dòng dữ liệu
    const orderRes = await client.query(
      `SELECT * FROM pos_orders WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
      [orderId, tenantId]
    );

    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Không tìm thấy hóa đơn POS.' });
    }

    const order = orderRes.rows[0];

    if (order.status === 'CANCELLED') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Hóa đơn này đã được hủy trước đó.' });
    }

    // 2. Kiểm tra khóa thời gian 30 phút nếu người thực hiện là STAFF
    const createdAt = new Date(order.created_at);
    const now = new Date();
    const diffMinutes = (now - createdAt) / (1000 * 60);

    if (userRole === 'STAFF' && diffMinutes > 30) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        message: `Đã quá thời hạn 30 phút kể từ khi tạo đơn (${Math.round(diffMinutes)} phút trước). Nhân viên lễ tân không thể tự ý hủy đơn này nữa, vui lòng liên hệ Chủ sân để xử lý.`
      });
    }

    // 3. Lấy danh sách sản phẩm trong hóa đơn để hoàn trả kho
    const itemsRes = await client.query(
      `SELECT product_id, quantity FROM pos_order_items WHERE order_id = $1`,
      [orderId]
    );

    for (const item of itemsRes.rows) {
      await client.query(
        `UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2 AND tenant_id = $3`,
        [item.quantity, item.product_id, tenantId]
      );
    }

    // 4. Cập nhật trạng thái đơn hàng thành CANCELLED
    const updateRes = await client.query(
      `UPDATE pos_orders
       SET status = 'CANCELLED',
           cancelled_at = NOW(),
           cancelled_by = $1,
           cancel_reason = $2
       WHERE id = $3
       RETURNING *`,
      [userId, reason || 'Nhập sai hóa đơn / Lễ tân yêu cầu hủy', orderId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Đã hủy hóa đơn POS và tự động hoàn trả số lượng hàng vào kho!',
      order: updateRes.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Lỗi khi hủy đơn POS:', error);
    res.status(500).json({ message: error.message || 'Lỗi khi hủy hóa đơn POS.' });
  } finally {
    client.release();
  }
};

// 8. LỄ TÂN / CHỦ SÂN CHỈNH SỬA HÓA ĐƠN POS (TRANSACTION & KHÓA THỜI GIAN 30 PHÚT)
exports.updatePosOrder = async (req, res) => {
  const { orderId } = req.params;
  const { courtId, note, items } = req.body;
  const tenantId = req.tenant.id;
  const userRole = req.user.role;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      message: 'Hóa đơn phải có ít nhất 1 sản phẩm. Nếu khách không mua nữa, vui lòng sử dụng tính năng Hủy Hóa Đơn.'
    });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Khóa và lấy thông tin hóa đơn hiện tại
    const orderRes = await client.query(
      `SELECT * FROM pos_orders WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
      [orderId, tenantId]
    );

    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Không tìm thấy hóa đơn POS.' });
    }

    const order = orderRes.rows[0];

    if (order.status === 'CANCELLED') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Không thể chỉnh sửa hóa đơn đã bị hủy.' });
    }

    // 2. Kiểm tra khóa thời gian 30 phút đối với Lễ tân (STAFF)
    const createdAt = new Date(order.created_at);
    const now = new Date();
    const diffMinutes = (now - createdAt) / (1000 * 60);

    if (userRole === 'STAFF' && diffMinutes > 30) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        message: `Đã quá thời hạn 30 phút kể từ khi tạo đơn (${Math.round(diffMinutes)} phút trước). Nhân viên lễ tân không thể tự ý sửa đơn này nữa, vui lòng liên hệ Chủ sân để xử lý.`
      });
    }

    // 3. Hoàn trả tạm thời số lượng các mặt hàng cũ vào kho để tính lại tồn kho chuẩn
    const oldItemsRes = await client.query(
      `SELECT product_id, quantity FROM pos_order_items WHERE order_id = $1`,
      [orderId]
    );
    for (const oldItem of oldItemsRes.rows) {
      await client.query(
        `UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2 AND tenant_id = $3`,
        [oldItem.quantity, oldItem.product_id, tenantId]
      );
    }

    // 4. Kiểm tra và trừ kho theo danh sách món mới
    let totalAmount = 0;
    const verifiedItems = [];

    for (const item of items) {
      const prodRes = await client.query(
        `SELECT id, name, price, stock_quantity
         FROM products
         WHERE id = $1 AND tenant_id = $2 AND is_active = TRUE
         FOR UPDATE`,
        [item.productId, tenantId]
      );

      if (prodRes.rows.length === 0) {
        throw new Error('Một sản phẩm trong đơn chỉnh sửa không tồn tại hoặc đã ngừng bán.');
      }

      const product = prodRes.rows[0];
      const qty = Number(item.quantity);

      if (qty <= 0) {
        throw new Error(`Số lượng của "${product.name}" không hợp lệ.`);
      }

      if (product.stock_quantity < qty) {
        throw new Error(
          `Sản phẩm "${product.name}" hiện chỉ còn ${product.stock_quantity} trong kho, không đủ số lượng (${qty}).`
        );
      }

      // Trừ kho mới
      await client.query(
        `UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2`,
        [qty, product.id]
      );

      const unitPrice = Number(product.price);
      totalAmount += unitPrice * qty;

      verifiedItems.push({
        productId: product.id,
        quantity: qty,
        unitPrice
      });
    }

    // 5. Cập nhật bảng chi tiết mặt hàng (Xóa cũ, ghi mới)
    await client.query(`DELETE FROM pos_order_items WHERE order_id = $1`, [orderId]);

    for (const vItem of verifiedItems) {
      await client.query(
        `INSERT INTO pos_order_items (order_id, product_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [orderId, vItem.productId, vItem.quantity, vItem.unitPrice]
      );
    }

    // 6. Cập nhật bảng hóa đơn tổng pos_orders
    const updatedOrderRes = await client.query(
      `UPDATE pos_orders
       SET total_amount = $1,
           court_id = $2,
           note = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [totalAmount, courtId || null, note || null, orderId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Đã cập nhật hóa đơn POS và điều chỉnh tồn kho thành công!',
      order: updatedOrderRes.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Lỗi khi chỉnh sửa đơn POS:', error);
    res.status(400).json({ message: error.message || 'Lỗi khi chỉnh sửa hóa đơn POS.' });
  } finally {
    client.release();
  }
};