const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

console.log('\n====================================================================');
console.log('🏸 TỰ ĐỘNG KIỂM TRA MÔI TRƯỜNG & KHỞI CHẠY BADMINTON SAAS');
console.log('====================================================================\n');

const backendDir = path.join(__dirname, 'backend');
const frontendDir = path.join(__dirname, 'frontend');

// 1. Kiểm tra file cấu hình .env của Backend
const backendEnv = path.join(backendDir, '.env');
const backendEnvExample = path.join(backendDir, '.env.example');
if (!fs.existsSync(backendEnv) && fs.existsSync(backendEnvExample)) {
  console.log('📌 [1/4] Chưa có file .env, đang tự động copy từ .env.example...');
  fs.copyFileSync(backendEnvExample, backendEnv);
  console.log('✓ Đã tạo file backend/.env thành công!\n');
}

// 2. Kiểm tra thư viện Backend (node_modules)
const backendModules = path.join(backendDir, 'node_modules');
if (!fs.existsSync(backendModules)) {
  console.log('📦 [2/4] Chưa có thư viện Backend, đang tự động cài đặt (npm install)...');
  execSync('npm install', { cwd: backendDir, stdio: 'inherit', shell: true });
  console.log('✓ Cài đặt thư viện Backend hoàn tất!\n');
}

// 3. Kiểm tra thư viện Frontend (node_modules)
const frontendModules = path.join(frontendDir, 'node_modules');
if (!fs.existsSync(frontendModules)) {
  console.log('📦 [3/4] Chưa có thư viện Frontend, đang tự động cài đặt (npm install)...');
  execSync('npm install', { cwd: frontendDir, stdio: 'inherit', shell: true });
  console.log('✓ Cài đặt thư viện Frontend hoàn tất!\n');
}

// 4. Tự động tạo DB & nạp dữ liệu mẫu CSDL lần đầu nếu chưa nạp
const dbFlagFile = path.join(backendDir, '.db_initialized');
if (!fs.existsSync(dbFlagFile)) {
  console.log('🗄️  [4/4] Phát hiện khởi chạy lần đầu, đang tự động nạp CSDL & dữ liệu mẫu...');
  try {
    execSync('node src/scripts/initDb.js', { cwd: backendDir, stdio: 'inherit', shell: true });
    fs.writeFileSync(dbFlagFile, new Date().toISOString(), 'utf8');
    console.log('✓ Tự động nạp CSDL và dữ liệu mẫu hoàn tất 100%!\n');
  } catch (err) {
    console.error('⚠️  Không thể tự động nạp CSDL. Vui lòng đảm bảo PostgreSQL đang bật.');
  }
}

// 5. Khởi chạy đồng thời Backend và Frontend
console.log('====================================================================');
console.log('🚀 ĐANG KHỞI CHẠY ĐỒNG THỜI SERVER VÀ GIAO DIỆN WEB:');
console.log('👉 Giao diện Web:   http://localhost:5173');
console.log('👉 Server Backend:  http://localhost:5000');
console.log('====================================================================\n');

function runProcess(cmd, args, cwd, label, color) {
  const isWin = process.platform === 'win32';
  const child = spawn(cmd, args, { cwd, shell: isWin });

  child.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach((line) => {
      if (line) console.log(`${color}${label}\x1b[0m ${line}`);
    });
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach((line) => {
      if (line) console.error(`${color}${label}\x1b[0m ${line}`);
    });
  });

  return child;
}

const backendProcess = runProcess('npm', ['run', 'dev'], backendDir, '[BACKEND] ', '\x1b[36m');
const frontendProcess = runProcess('npm', ['run', 'dev'], frontendDir, '[FRONTEND]', '\x1b[32m');

function cleanup() {
  console.log('\n🛑 Đang dừng toàn bộ hệ thống...');
  try {
    if (backendProcess) backendProcess.kill();
    if (frontendProcess) frontendProcess.kill();
  } catch (e) {}
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
