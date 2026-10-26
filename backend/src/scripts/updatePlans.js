const db = require('../config/db');

async function updatePlans() {
  try {
    await db.query(`
      ALTER TABLE tenant_subscriptions
      ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) DEFAULT 'MONTHLY',
      ADD COLUMN IF NOT EXISTS transaction_code VARCHAR(50),
      ADD COLUMN IF NOT EXISTS payment_proof_note TEXT,
      ADD COLUMN IF NOT EXISTS refund_bank_name VARCHAR(50),
      ADD COLUMN IF NOT EXISTS refund_account_number VARCHAR(50),
      ADD COLUMN IF NOT EXISTS refund_account_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
    `);

    console.log('✓ Đã cập nhật thành công các cột bổ sung cho tenant_subscriptions!');
    await db.query(`
      DELETE FROM tenant_subscriptions
      WHERE plan_id IN (SELECT id FROM subscription_plans WHERE name LIKE '%Trải Nghiệm%' OR id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb0');

      DELETE FROM subscription_plans
      WHERE name LIKE '%Trải Nghiệm%' OR id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb0';


      UPDATE subscription_plans
      SET max_courts = 8,
          badge = 'Cụm sân nhỏ (1-8 sân)',
          description = 'Phù hợp cho cụm sân quy mô 1–8 sân, chi phí chỉ từ ~12.000đ/sân/tháng',
          features = '["Quản lý tối đa 8 sân cầu lông", "Đặt lịch trực tuyến 24/7 qua sàn", "Thanh toán chuyển khoản VietQR tự động", "Đơn tại quầy miễn phí 0% phí giao dịch", "Hoa hồng đặt qua App chỉ 5%", "Báo cáo doanh thu cơ bản theo ngày/tháng"]'::jsonb
      WHERE name LIKE '%Khởi Nghiệp%' OR id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';

      UPDATE subscription_plans
      SET max_courts = 16,
          badge = 'Phổ biến nhất (8-16 sân)',
          description = 'Gói phổ biến nhất cho cụm sân 8–16 sân, mở khóa POS và Bảng giá động',
          features = '["Quản lý tối đa 16 sân cầu lông", "Mô-đun Bán hàng & Quản lý tồn kho POS tại quầy", "Cấu hình Bảng giá động Giờ cao điểm / Cuối tuần", "Đơn tại quầy miễn phí 0% phí giao dịch", "Hoa hồng đặt qua App ưu đãi chỉ 3%", "Quản lý và phân quyền tài khoản Lễ tân", "Báo cáo doanh thu & Xuất file Excel đối soát"]'::jsonb
      WHERE name LIKE '%Tiêu Chuẩn%' OR id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2';
    `);

    console.log('✓ Đã cập nhật thành công hạn mức các gói cước trong DB (4 sân -> 8 sân, 8 sân -> 16 sân)!');
    const res = await db.query('SELECT name, max_courts, badge, description FROM subscription_plans ORDER BY max_courts ASC');
    console.table(res.rows);
    process.exit(0);
  } catch (err) {
    console.error('Lỗi cập nhật gói cước:', err);
    process.exit(1);
  }
}

updatePlans();
