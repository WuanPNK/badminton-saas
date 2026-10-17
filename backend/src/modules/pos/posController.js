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

// 4. LỄ TÂN / CHỦ SÂN TẠO HÓA ĐƠN BÁN HÀNG TẠI QUẦY (CHECKOUT POS BẰNG TRANSACTION)
exports.createPosOrder = async (req, res) => {
  const tenantId = req.tenant.id;
  const staffId = req.user.id;
  const { bookingId, paymentMethod, items } = req.body;
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

    // Tạo hóa đơn tổng (pos_orders)
    const orderRes = await client.query(
      `INSERT INTO pos_orders (tenant_id, staff_id, booking_id, total_amount, payment_method)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [tenantId, staffId, bookingId || null, totalAmount, paymentMethod || 'CASH']
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

// 5. XEM LỊCH SỬ HÓA ĐƠN POS TẠI QUẦY
exports.getPosOrders = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT po.*, u.full_name AS staff_name, b.booking_code
       FROM pos_orders po
       JOIN users u ON po.staff_id = u.id
       LEFT JOIN bookings b ON po.booking_id = b.id
       WHERE po.tenant_id = $1
       ORDER BY po.created_at DESC LIMIT 50`,
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

    // 6.2. Doanh thu bán hàng POS (Nước uống / Phụ kiện)
    const posStats = await db.query(
      `SELECT
         COALESCE(SUM(total_amount), 0) AS pos_revenue,
         COUNT(id) AS total_pos_orders
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
         WHERE p.tenant_id = $1
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

    res.json({
      success: true,
      summary: {
        totalRevenue: courtRev + posRev,
        courtRevenue: courtRev,
        posRevenue: posRev,
        paidBookingsCount: Number(bookingStats.rows[0].paid_bookings_count),
        pendingRefundCount: Number(bookingStats.rows[0].pending_refund_count),
        totalRefundedAmount: Number(bookingStats.rows[0].total_refunded_amount),
        totalPosOrders: Number(posStats.rows[0].total_pos_orders)
      },
      advancedAnalyticsEnabled: req.tenant.enable_advanced_analytics,
      advancedData
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi khi tải báo cáo thống kê cụm sân.' });
  }
};