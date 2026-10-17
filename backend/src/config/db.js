const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('connect', () => {
  console.log('✓ Kết nối PostgreSQL thành công!');
});

pool.on('error', (err) => {
  console.error('Lỗi kết nối PostgreSQL:', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool, // Xuất thêm pool để dùng Transaction (BEGIN / COMMIT / ROLLBACK)
};