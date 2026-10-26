const db = require('../config/db');

async function removeTrialPlan() {
  try {
    // 1. Xóa các đăng ký gắn với gói Trải nghiệm
    await db.query(`
      DELETE FROM tenant_subscriptions
      WHERE plan_id IN (
        SELECT id FROM subscription_plans
        WHERE name LIKE '%Trải Nghiệm%' OR id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb0'
      )
    `);

    // 2. Xóa gói Trải nghiệm khỏi danh mục gói cước
    await db.query(`
      DELETE FROM subscription_plans
      WHERE name LIKE '%Trải Nghiệm%' OR id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb0'
    `);

    console.log('✓ Đã xóa hoàn toàn Gói Trải Nghiệm khỏi cơ sở dữ liệu!');

    const res = await db.query(
      'SELECT id, name, price_per_month, max_courts, badge FROM subscription_plans ORDER BY price_per_month ASC'
    );
    console.table(res.rows);
    process.exit(0);
  } catch (err) {
    console.error('Lỗi khi xóa gói trải nghiệm:', err);
    process.exit(1);
  }
}

removeTrialPlan();
