const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function ensureDatabaseExists() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return;

  try {
    const url = new URL(dbUrl);
    const targetDb = url.pathname.replace(/^\//, '');
    if (!targetDb) return;

    const defaultUrl = new URL(dbUrl);
    defaultUrl.pathname = '/postgres';

    const defaultPool = new Pool({ connectionString: defaultUrl.toString() });
    const checkRes = await defaultPool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [targetDb]
    );

    if (checkRes.rows.length === 0) {
      console.log(`[CSDL] Đang tự động tạo mới cơ sở dữ liệu "${targetDb}"...`);
      await defaultPool.query(`CREATE DATABASE "${targetDb}"`);
      console.log(`[CSDL] Đã tạo thành công cơ sở dữ liệu "${targetDb}".`);
    }
    await defaultPool.end();
  } catch (err) {
    // Bỏ qua nếu user không có quyền trên DB postgres mặc định
  }
}

async function initDb() {
  await ensureDatabaseExists();

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Connecting to PostgreSQL...');
    await pool.query('SELECT 1');
    console.log('PostgreSQL connected successfully.');

    const schemaPath = path.join(__dirname, '../../schema.sql');
    const seedPath = path.join(__dirname, '../../seed_data.sql');

    if (fs.existsSync(schemaPath)) {
      console.log('Executing schema.sql (12 tables & ENUMs)...');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schemaSql);
      console.log('schema.sql executed successfully.');
    }

    if (fs.existsSync(seedPath)) {
      console.log('Executing seed_data.sql (sample users, courts, bookings, POS)...');
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      await pool.query(seedSql);
      console.log('seed_data.sql executed successfully.');
    }

    console.log('\nDatabase initialization completed 100%!');
  } catch (error) {
    console.error('Error during database initialization:', error.message);
  } finally {
    await pool.end();
  }
}

initDb();
