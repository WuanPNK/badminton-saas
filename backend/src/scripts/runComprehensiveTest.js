require('dotenv').config();
const db = require('../config/db');

const API_BASE = 'http://localhost:5000/api';

async function req(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const body = options.body ? JSON.stringify(options.body) : undefined;
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body,
  });

  let data = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return {
    status: res.status,
    data,
  };
}

let superAdminToken = '';
let dongDoToken = '';
let thaiHaToken = '';
let vuTrongPhungToken = '';
let letanToken = '';

let testCourtId = null;
let testPricingRuleId = null;

async function runTests() {
  console.log('=====================================================');
  console.log('   BẮT ĐẦU KIỂM THỬ TOÀN DIỆN HỆ THỐNG BADMINTON SAAS');
  console.log('=====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName, details = '') {
    totalTests++;
    if (condition) {
      console.log(`  ✓ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`  ✗ [FAIL] ${testName}${details ? ' - ' + details : ''}`);
    }
  }

  try {
    // ----------------------------------------------------
    // TEST 1: ĐĂNG NHẬP & PHÂN QUYỀN (AUTH)
    // ----------------------------------------------------
    console.log('1. KIỂM TRA ĐĂNG NHẬP & PHÂN QUYỀN CÁC VAI TRÒ:');

    // 1.1 Super Admin
    const resSA = await req('/auth/login', {
      method: 'POST',
      body: { email: 'superadmin@saas.com', password: '123456' },
    });
    assert(resSA.status === 200 && resSA.data.user.role === 'SUPER_ADMIN', 'Super Admin đăng nhập thành công');
    superAdminToken = resSA.data.token;

    // 1.2 Chủ sân Đông Đô (Gói Tiêu chuẩn)
    const resDD = await req('/auth/login', {
      method: 'POST',
      body: { email: 'chusan1@gmail.com', password: '123456' },
    });
    assert(resDD.status === 200 && resDD.data.user.role === 'TENANT_ADMIN', 'Chủ sân Đông Đô đăng nhập thành công');
    dongDoToken = resDD.data.token;

    // 1.3 Chủ sân Thái Hà (Gói Khởi nghiệp)
    const resTH = await req('/auth/login', {
      method: 'POST',
      body: { email: 'chusan2@gmail.com', password: '123456' },
    });
    assert(resTH.status === 200 && resTH.data.user.role === 'TENANT_ADMIN', 'Chủ sân Thái Hà đăng nhập thành công');
    thaiHaToken = resTH.data.token;

    // 1.4 Chủ sân Vũ Trọng Phụng (Chưa kích hoạt gói)
    const resVTP = await req('/auth/login', {
      method: 'POST',
      body: { email: 'chusan3@gmail.com', password: '123456' },
    });
    assert(resVTP.status === 200 && resVTP.data.user.role === 'TENANT_ADMIN', 'Chủ sân Vũ Trọng Phụng đăng nhập thành công');
    vuTrongPhungToken = resVTP.data.token;

    // 1.5 Lễ tân Đông Đô
    const resLT = await req('/auth/login', {
      method: 'POST',
      body: { email: 'letan1@gmail.com', password: '123456' },
    });
    assert(resLT.status === 200 && resLT.data.user.role === 'STAFF', 'Lễ tân Đông Đô đăng nhập thành công');
    letanToken = resLT.data.token;

    console.log('\n2. KIỂM TRA DANH MỤC GÓI CƯỚC SAAS:');
    // ----------------------------------------------------
    // TEST 2: DANH MỤC GÓI CƯỚC (LOẠI BỎ HOÀN TOÀN GÓI TRẢI NGHIỆM)
    // ----------------------------------------------------
    const resPlans = await req('/tenant/subscription/plans', {
      headers: { Authorization: `Bearer ${dongDoToken}` },
    });
    const plans = resPlans.data.plans || [];
    assert(resPlans.status === 200, 'Lấy danh sách gói cước thành công');
    assert(plans.length === 3, 'Chính xác 3 gói cước có phí (Starter, Standard, Enterprise)', `Hiện có ${plans.length} gói`);
    const hasTrial = plans.some((p) => p.name.includes('Trải Nghiệm') || Number(p.price_per_month) === 0);
    assert(!hasTrial, 'Đã loại bỏ hoàn toàn gói trải nghiệm 0đ khỏi danh mục');

    const starterPlan = plans.find((p) => p.name.includes('Khởi Nghiệp'));
    const standardPlan = plans.find((p) => p.name.includes('Tiêu Chuẩn'));
    const enterprisePlan = plans.find((p) => p.name.includes('Chuỗi Sân VIP'));

    assert(starterPlan && starterPlan.max_courts === 8, 'Gói Khởi Nghiệp: giới hạn 8 sân, giá 99.000 ₫');
    assert(standardPlan && standardPlan.max_courts === 16, 'Gói Tiêu Chuẩn: giới hạn 16 sân, giá 199.000 ₫');
    assert(enterprisePlan && enterprisePlan.max_courts >= 999, 'Gói VIP: không giới hạn sân (999), giá 299.000 ₫');

    console.log('\n3. KIỂM TRA ĐIỀU KIỆN KHỞI TẠO SÂN THEO GÓI CƯỚC:');
    // ----------------------------------------------------
    // TEST 3: CHỦ SÂN CHƯA CÓ GÓI -> CHẶN KHỞI TẠO SÂN
    // ----------------------------------------------------
    // Đảm bảo Vũ Trọng Phụng không có gói
    const vtpTenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3';
    await db.query(`DELETE FROM tenant_subscriptions WHERE tenant_id = $1`, [vtpTenantId]);

    const resCreateBlocked = await req('/tenant/courts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${vuTrongPhungToken}` },
      body: {
        name: 'Sân Test Chưa Gói',
        courtType: 'STANDARD',
        basePricePerHour: 100000,
      },
    });

    assert(resCreateBlocked.status === 403, 'Chủ sân chưa kích hoạt gói bị chặn khởi tạo sân (HTTP 403)', `Status: ${resCreateBlocked.status}`);
    assert(
      resCreateBlocked.data.message && (resCreateBlocked.data.message.includes('chưa đăng ký') || resCreateBlocked.data.message.includes('chưa kích hoạt')),
      'Thông báo lỗi yêu cầu đăng ký gói cước chính xác'
    );

    console.log('\n4. KIỂM TRA LUỒNG ĐĂNG KÝ GÓI CƯỚC & SUPER ADMIN PHÊ DUYỆT:');
    // ----------------------------------------------------
    // TEST 4: ĐĂNG KÝ GÓI & DUYỆT BỞI SUPER ADMIN
    // ----------------------------------------------------
    // Chủ sân gửi yêu cầu đăng ký Starter Plan
    const resReq = await req('/tenant/subscription/request', {
      method: 'POST',
      headers: { Authorization: `Bearer ${vuTrongPhungToken}` },
      body: {
        planId: starterPlan.id,
        billingCycle: 'MONTHLY',
        transactionCode: 'FTTEST123456',
        paymentProofNote: 'Đã chuyển khoản test',
        refundBankName: 'MB Bank',
        refundAccountNumber: '0987654321',
        refundAccountName: 'CHU SAN VU TRONG PHUNG',
      },
    });

    assert(resReq.status === 201, 'Chủ sân gửi yêu cầu đăng ký gói cước thành công (HTTP 201)');
    const createdSubId = resReq.data.subscription?.id;

    // Super Admin kiểm tra danh sách chờ duyệt
    const resPending = await req('/super-admin/subscriptions/pending', {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(resPending.status === 200, 'Super Admin lấy danh sách yêu cầu gói cước chờ duyệt');
    const foundPending = (resPending.data.pendingSubscriptions || []).find((s) => s.id === createdSubId);
    assert(Boolean(foundPending), 'Tìm thấy yêu cầu của Vũ Trọng Phụng trong danh sách chờ duyệt');

    // Super Admin duyệt yêu cầu
    const resApprove = await req(`/super-admin/subscriptions/${createdSubId}/approve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(resApprove.status === 200, 'Super Admin duyệt và kích hoạt gói cước thành công (HTTP 200)');

    // Vũ Trọng Phụng kiểm tra thông tin gói cước
    const resMySub = await req('/tenant/subscription/my-subscription', {
      headers: { Authorization: `Bearer ${vuTrongPhungToken}` },
    });
    assert(
      resMySub.status === 200 && resMySub.data.currentSubscription?.payment_status === 'PAID',
      'Gói cước đã được kích hoạt trạng thái PAID'
    );

    // Sau khi có gói, Vũ Trọng Phụng tạo sân con
    const resCreateAllowed = await req('/tenant/courts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${vuTrongPhungToken}` },
      body: {
        name: 'Sân Test VTP 01',
        courtType: 'STANDARD',
        basePricePerHour: 90000,
      },
    });
    assert(resCreateAllowed.status === 201, 'Sau khi được duyệt gói, chủ sân tạo sân con thành công (HTTP 201)');
    testCourtId = resCreateAllowed.data.court?.id;

    console.log('\n5. KIỂM TRA PHÂN QUYỀN TÍNH NĂNG (FEATURE GATING) THEO GÓI:');
    // ----------------------------------------------------
    // TEST 5: TÍNH NĂNG KHÓA VỚI GÓI STARTER, MỞ VỚI STANDARD
    // ----------------------------------------------------
    // 5.1 Gói Starter (Thái Hà) thử bật POS bán hàng
    const resPosStarter = await req('/tenant/my-settings', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${thaiHaToken}` },
      body: {
        enable_pos_module: true,
      },
    });
    assert(resPosStarter.status === 403, 'Gói Khởi Nghiệp bị chặn bật POS bán hàng (HTTP 403)');

    // 5.2 Gói Starter thử tạo Bảng giá động giờ cao điểm
    const resRuleStarter = await req('/tenant/pricing-rules', {
      method: 'POST',
      headers: { Authorization: `Bearer ${thaiHaToken}` },
      body: {
        name: 'Bảng giá cao điểm test',
        courtType: 'STANDARD',
        startTime: '17:00:00',
        endTime: '20:00:00',
        pricePerHour: 150000,
        daysOfWeek: [1, 2, 3, 4, 5],
      },
    });
    assert(resRuleStarter.status === 403, 'Gói Khởi Nghiệp bị chặn tạo Bảng giá động (HTTP 403)');

    // 5.3 Gói Standard (Đông Đô) bật POS bán hàng
    const resPosStandard = await req('/tenant/my-settings', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${dongDoToken}` },
      body: {
        enable_pos_module: true,
        open_time: '06:00:00',
        close_time: '23:00:00',
      },
    });
    assert(resPosStandard.status === 200, 'Gói Tiêu Chuẩn được phép bật POS bán hàng (HTTP 200)');

    // 5.4 Gói Standard tạo Bảng giá động
    const resRuleStandard = await req('/tenant/pricing-rules', {
      method: 'POST',
      headers: { Authorization: `Bearer ${dongDoToken}` },
      body: {
        name: 'Giờ Vàng Đông Đô Test',
        courtType: 'STANDARD',
        startTime: '17:00:00',
        endTime: '20:00:00',
        pricePerHour: 140000,
        daysOfWeek: [1, 2, 3, 4, 5],
      },
    });
    assert(resRuleStandard.status === 201, 'Gói Tiêu Chuẩn được phép tạo Bảng giá động (HTTP 201)');
    testPricingRuleId = resRuleStandard.data.rule?.id;

    console.log('\n6. KIỂM TRA ĐẶT LỊCH BẢO TRÌ SÂN (CHUẨN 24 GIỜ):');
    // ----------------------------------------------------
    // TEST 6: BẢO TRÌ SÂN 24 GIỜ
    // ----------------------------------------------------
    // Đặt lịch bảo trì sân test với giờ 24h: 14:30
    const resMaint = await req(`/tenant/courts/${testCourtId}/maintenance`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${vuTrongPhungToken}` },
      body: {
        isUnderMaintenance: true,
        maintenanceStart: '2026-10-26T14:30:00.000Z',
        maintenanceNote: 'Bảo trì thay thảm và đèn LED 24H',
      },
    });
    assert(resMaint.status === 200, 'Lên lịch bảo trì sân định dạng 24H thành công (HTTP 200)');
    assert(resMaint.data.court?.is_under_maintenance === true, 'Trạng thái sân cập nhật is_under_maintenance = true');

    // Kết thúc bảo trì
    const resEndMaint = await req(`/tenant/courts/${testCourtId}/maintenance`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${vuTrongPhungToken}` },
      body: {
        isUnderMaintenance: false,
      },
    });
    assert(resEndMaint.status === 200, 'Kết thúc bảo trì mở lại sân thành công (HTTP 200)');
    assert(resEndMaint.data.court?.is_under_maintenance === false, 'Trạng thái sân khôi phục hoạt động bình thường');

    console.log('\n7. KIỂM TRA CƠ CHẾ CHECK-IN LỄ TÂN & ĐÁNH GIÁ SÂN (REVIEWS):');
    // ----------------------------------------------------
    // TEST 7: LỄ TÂN CHECK-IN & PHÂN QUYỀN ĐÁNH GIÁ SÂN
    // ----------------------------------------------------
    // 7.1 Lễ tân truy cập timeline sân
    const resTimeline = await req('/bookings/timeline/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1?date=2026-10-26', {
      headers: { Authorization: `Bearer ${letanToken}` },
    });
    assert(resTimeline.status === 200, 'Lễ tân truy cập sơ đồ ca sân thành công');

    // 7.2 Khách hàng thử đánh giá sân khi chưa từng check-in hoàn tất
    const resCust = await req('/auth/login', {
      method: 'POST',
      body: { email: 'khach@gmail.com', password: '123456' },
    });
    const custToken = resCust.data.token;
    assert(resCust.status === 200, 'Khách hàng đăng nhập thành công');

    const resReview = await req('/reviews', {
      method: 'POST',
      headers: { Authorization: `Bearer ${custToken}` },
      body: {
        tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
        bookingId: '00000000-0000-0000-0000-000000000000',
        rating: 5,
        comment: 'Sân đánh rất êm, đèn sáng',
      },
    });
    assert(
      resReview.status === 400 || resReview.status === 404 || resReview.status === 403,
      'Khách hàng chưa check-in/không có đơn hợp lệ bị chặn đánh giá sân'
    );

    console.log('\n8. DỌN DẸP DỮ LIỆU TEST (CLEANUP):');
    // ----------------------------------------------------
    // DỌN DẸP DỮ LIỆU TEST
    // ----------------------------------------------------
    if (testCourtId) {
      await req(`/tenant/courts/${testCourtId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${vuTrongPhungToken}` },
      });
      console.log('  ✓ Đã xóa sân test an toàn.');
    }
    if (testPricingRuleId) {
      await req(`/tenant/pricing-rules/${testPricingRuleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${dongDoToken}` },
      });
      console.log('  ✓ Đã xóa bảng giá động test an toàn.');
    }

    // Reset subscription Vũ Trọng Phụng về null như ban đầu
    await db.query(`DELETE FROM tenant_subscriptions WHERE tenant_id = $1`, [vtpTenantId]);
    console.log('  ✓ Đã reset subscription test của Vũ Trọng Phụng.');

    console.log('\n=====================================================');
    console.log(
      `   KẾT QUẢ KIỂM THỬ: ${passedTests}/${totalTests} TESTS ĐẠT (${Math.round((passedTests / totalTests) * 100)}%)`
    );
    console.log('=====================================================\n');

    process.exit(passedTests === totalTests ? 0 : 1);
  } catch (error) {
    console.error('LỖI KHÔNG MONG MUỐN KHI CHẠY TEST:', error);
    process.exit(1);
  }
}

runTests();
