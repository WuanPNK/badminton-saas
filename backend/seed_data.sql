-- Kích hoạt pgcrypto để tạo chuỗi mã hóa bcrypt cho mật khẩu '123456'
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Làm sạch dữ liệu cũ nếu có
TRUNCATE TABLE
    reviews,
    pos_order_items,
    pos_orders,
    products,
    bookings,
    pricing_rules,
    courts,
    tenant_subscriptions,
    subscription_plans,
    tenants,
    otp_verifications,
    users
RESTART IDENTITY CASCADE;

-- =========================================================
-- 1. TẠO NGƯỜI DÙNG MẪU (MẬT KHẨU TẤT CẢ LÀ: 123456)
-- =========================================================
INSERT INTO users (id, role, full_name, email, phone, password_hash, is_email_verified, student_status, student_card_url)
VALUES
    -- Super Admin
    ('11111111-1111-1111-1111-111111111111', 'SUPER_ADMIN', 'Quản Trị Viên Nền Tảng', 'superadmin@saas.com', '0901000001', crypt('123456', gen_salt('bf', 10)), TRUE, 'NONE', NULL),

    -- 3 Chủ sân (2 Active, 1 Pending chờ duyệt)
    ('22222222-2222-2222-2222-222222222221', 'TENANT_ADMIN', 'Nguyễn Hoàng Nam (Chủ sân Đông Đô)', 'chusan1@gmail.com', '0902000001', crypt('123456', gen_salt('bf', 10)), TRUE, 'NONE', NULL),
    ('22222222-2222-2222-2222-222222222222', 'TENANT_ADMIN', 'Trần Minh Tuấn (Chủ sân Thái Hà)', 'chusan2@gmail.com', '0902000002', crypt('123456', gen_salt('bf', 10)), TRUE, 'NONE', NULL),
    ('22222222-2222-2222-2222-222222222223', 'TENANT_ADMIN', 'Lê Văn Hùng (Chủ sân Thanh Xuân)', 'chusan3@gmail.com', '0902000003', crypt('123456', gen_salt('bf', 10)), TRUE, 'NONE', NULL),

    -- 6 Nhân viên Lễ tân (Mỗi cụm sân có 2 lễ tân)
    ('33333333-3333-3333-3333-333333333331', 'STAFF', 'Phạm Thu Hà (Lễ tân Đông Đô 1)', 'letan1@gmail.com', '0903000001', crypt('123456', gen_salt('bf', 10)), TRUE, 'NONE', NULL),
    ('33333333-3333-3333-3333-333333333332', 'STAFF', 'Trần Quốc Huy (Lễ tân Đông Đô 2)', 'letan_dongdo2@gmail.com', '0903000012', crypt('123456', gen_salt('bf', 10)), TRUE, 'NONE', NULL),
    ('33333333-3333-3333-3333-333333333333', 'STAFF', 'Nguyễn Hoàng Mai (Lễ tân Thái Hà 1)', 'letan_thaiha1@gmail.com', '0903000021', crypt('123456', gen_salt('bf', 10)), TRUE, 'NONE', NULL),
    ('33333333-3333-3333-3333-333333333334', 'STAFF', 'Lê Anh Tuấn (Lễ tân Thái Hà 2)', 'letan_thaiha2@gmail.com', '0903000022', crypt('123456', gen_salt('bf', 10)), TRUE, 'NONE', NULL),
    ('33333333-3333-3333-3333-333333333335', 'STAFF', 'Vũ Quỳnh Trang (Lễ tân Vũ Trọng Phụng 1)', 'letan_vutrongphung1@gmail.com', '0903000031', crypt('123456', gen_salt('bf', 10)), TRUE, 'NONE', NULL),
    ('33333333-3333-3333-3333-333333333336', 'STAFF', 'Đặng Minh Quân (Lễ tân Vũ Trọng Phụng 2)', 'letan_vutrongphung2@gmail.com', '0903000032', crypt('123456', gen_salt('bf', 10)), TRUE, 'NONE', NULL),

    -- 3 Khách hàng (1 Sinh viên đã duyệt, 1 Sinh viên chờ duyệt, 1 Khách thường)
    ('44444444-4444-4444-4444-444444444441', 'USER', 'Đỗ Minh Đức (Sinh viên)', 'sinhvien@gmail.com', '0904000001', crypt('123456', gen_salt('bf', 10)), TRUE, 'VERIFIED', 'https://placehold.co/600x400?text=The+Sinh+Vien+Minh+Duc'),
    ('44444444-4444-4444-4444-444444444442', 'USER', 'Vũ Thị Mai (Chờ duyệt thẻ SV)', 'chosinhvien@gmail.com', '0904000002', crypt('123456', gen_salt('bf', 10)), TRUE, 'PENDING_APPROVAL', 'https://placehold.co/600x400?text=The+Sinh+Vien+Vu+Thi+Mai'),
    ('44444444-4444-4444-4444-444444444443', 'USER', 'Hoàng Quốc Bảo (Khách thường)', 'khach@gmail.com', '0904000003', crypt('123456', gen_salt('bf', 10)), TRUE, 'NONE', NULL);

-- =========================================================
-- 2. TẠO CỤM SÂN (TENANTS) & GẮN TENANT_ID CHO USER
-- =========================================================
INSERT INTO tenants (
    id, owner_id, name, district, address, phone_contact, description, status,
    enable_vip_courts, enable_pos_module, enable_advanced_analytics,
    student_discount_type, student_discount_value,
    qr_bank_name, qr_account_number, qr_account_name
)
VALUES
    -- Cụm sân 1: Active, bật full tính năng, giảm 20% mặc định hệ thống cho Sinh viên
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
        '22222222-2222-2222-2222-222222222221',
        'Cụm Sân Cầu Lông Đông Đô',
        'Cầu Giấy',
        'Số 85 Trần Thái Tông, Quận Cầu Giấy, Hà Nội',
        '0902000001',
        'Thảm thi đấu tiêu chuẩn BWF, trần cao 11m, có quầy nước và phụ kiện cầu lông.',
        'ACTIVE',
        TRUE, TRUE, TRUE,
        'SYSTEM_DEFAULT_20', 0,
        'MB', '0902000001888', 'NGUYEN HOANG NAM'
    ),
    -- Cụm sân 2: Active, giảm thẳng 30.000đ/ca cho Sinh viên
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
        '22222222-2222-2222-2222-222222222222',
        'CLB Cầu Lông Thái Hà Arena',
        'Đống Đa',
        'Số 102 Chùa Láng, Quận Đống Đa, Hà Nội',
        '0902000002',
        'Sân thoáng mát, chỗ để xe ô tô rộng rãi, ưu đãi riêng cho sinh viên các trường đại học.',
        'ACTIVE',
        FALSE, TRUE, FALSE,
        'CUSTOM_FIXED_OFF', 30000,
        'VCB', '0011009988776', 'TRAN MINH TUAN'
    ),
    -- Cụm sân 3: Đang PENDING chờ Super Admin duyệt mở khóa
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
        '22222222-2222-2222-2222-222222222223',
        'Sân Cầu Lông Vũ Trọng Phụng',
        'Thanh Xuân',
        'Số 45 Vũ Trọng Phụng, Quận Thanh Xuân, Hà Nội',
        '0902000003',
        'Cụm 6 sân thảm mới khai trương.',
        'PENDING',
        FALSE, FALSE, FALSE,
        'NONE', 0,
        'TCB', '1903456789001', 'LE VAN HUNG'
    );

-- Cập nhật tenant_id cho Chủ sân và 6 Lễ tân (Mỗi cụm sân 2 lễ tân)
UPDATE users SET tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1' WHERE id IN ('22222222-2222-2222-2222-222222222221', '33333333-3333-3333-3333-333333333331', '33333333-3333-3333-3333-333333333332');
UPDATE users SET tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2' WHERE id IN ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333334');
UPDATE users SET tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3' WHERE id IN ('22222222-2222-2222-2222-222222222223', '33333333-3333-3333-3333-333333333335', '33333333-3333-3333-3333-333333333336');

-- =========================================================
-- 3. DỮ LIỆU GÓI CƯỚC & DOANH THU PHẦN MỀM CHO SUPER ADMIN
-- =========================================================
INSERT INTO subscription_plans (id, name, price_per_month, max_courts, description, commission_rate, badge, is_featured)
VALUES
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'Gói Khởi Nghiệp (Starter SaaS)', 99000, 8, 'Phù hợp cho cụm sân quy mô nhỏ 1–8 sân, chi phí chỉ từ ~12.000đ/sân/tháng', 5, 'Cụm sân nhỏ (1-8 sân)', FALSE),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'Gói Tiêu Chuẩn (Standard SaaS)', 199000, 16, 'Gói phổ biến nhất cho cụm sân 8–16 sân, mở khóa POS và Bảng giá động', 3, 'Phổ biến nhất (8-16 sân)', TRUE),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'Gói Chuỗi Sân VIP (Enterprise SaaS)', 299000, 999, 'Dành cho cụm sân lớn hoặc chuỗi nhiều cơ sở, miễn phí 100% hoa hồng', 0, 'VIP Không giới hạn', FALSE);


INSERT INTO tenant_subscriptions (tenant_id, plan_id, amount_paid, start_date, end_date, payment_status)
VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 9000000, CURRENT_DATE - INTERVAL '1 month', CURRENT_DATE + INTERVAL '5 months', 'PAID'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 4800000, CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE + INTERVAL '5 months', 'PAID');

-- =========================================================
-- 4. TẠO SÂN BÃI (CÓ SÂN ĐÃ PUBLISHED & SÂN ĐANG PENDING)
-- =========================================================
INSERT INTO courts (id, tenant_id, name, type, status, is_under_maintenance)
VALUES
    -- Các sân thuộc Cụm sân 1 (Đông Đô)
    ('cccccccc-cccc-cccc-cccc-ccccccccccc1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Sân Tiêu Chuẩn 01', 'STANDARD', 'PUBLISHED', FALSE),
    ('cccccccc-cccc-cccc-cccc-ccccccccccc2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Sân Tiêu Chuẩn 02', 'STANDARD', 'PUBLISHED', FALSE),
    ('cccccccc-cccc-cccc-cccc-ccccccccccc3', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Sân Thi Đấu VIP 01', 'VIP', 'PUBLISHED', FALSE),
    ('cccccccc-cccc-cccc-cccc-ccccccccccc4', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Sân Thi Đấu VIP 02 (Mới tạo)', 'VIP', 'PENDING', FALSE),

    -- Các sân thuộc Cụm sân 2 (Thái Hà)
    ('cccccccc-cccc-cccc-cccc-ccccccccccc5', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'Sân A1', 'STANDARD', 'PUBLISHED', FALSE),
    ('cccccccc-cccc-cccc-cccc-ccccccccccc6', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'Sân A2', 'STANDARD', 'PUBLISHED', FALSE);

-- =========================================================
-- 5. CẤU HÌNH KHUNG GIÁ ĐỘNG (DYNAMIC PRICING RULES)
-- =========================================================
INSERT INTO pricing_rules (tenant_id, court_type, start_time, end_time, price_per_hour, days_of_week)
VALUES
    -- Giá động Cụm sân 1 (Đông Đô)
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'STANDARD', '05:00:00', '17:00:00', 80000, ARRAY[1,2,3,4,5,6,7]),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'STANDARD', '17:00:00', '22:00:00', 120000, ARRAY[1,2,3,4,5,6,7]),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'VIP', '05:00:00', '17:00:00', 110000, ARRAY[1,2,3,4,5,6,7]),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'VIP', '17:00:00', '22:00:00', 160000, ARRAY[1,2,3,4,5,6,7]),

    -- Giá động Cụm sân 2 (Thái Hà)
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'STANDARD', '05:00:00', '17:00:00', 70000, ARRAY[1,2,3,4,5,6,7]),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'STANDARD', '17:00:00', '22:00:00', 110000, ARRAY[1,2,3,4,5,6,7]);

-- =========================================================
-- 6. KHO HÀNG POS (NƯỚC UỐNG & CẦU LÔNG) CỦA CỤM SÂN 1
-- =========================================================
INSERT INTO products (id, tenant_id, name, category, price, stock_quantity)
VALUES
    ('dddddddd-dddd-dddd-dddd-ddddddddddd1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Nước điện giải Revive ướp lạnh', 'DRINK', 15000, 120),
    ('dddddddd-dddd-dddd-dddd-ddddddddddd2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Nước khoáng Aquafina 500ml', 'DRINK', 10000, 200),
    ('dddddddd-dddd-dddd-dddd-ddddddddddd3', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Ống cầu lông Hải Yến S90 (12 quả)', 'SHUTTLECOCK', 245000, 40),
    ('dddddddd-dddd-dddd-dddd-ddddddddddd4', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Thuê vợt Yonex Astrox (Theo ca)', 'RACKET_RENTAL', 40000, 15);

-- =========================================================
-- 7. ĐƠN ĐẶT SÂN MẪU (6 ĐƠN ĐỦ MỌI KỊCH BẢN KIỂM THỬ)
-- =========================================================
INSERT INTO bookings (
    id, booking_code, tenant_id, court_id, booking_type, user_id,
    walk_in_guest_name, walk_in_guest_phone, created_by_staff_id,
    booking_date, start_time, end_time,
    original_price, discount_applied, final_price, is_student_applied, status,
    refund_bank_name, refund_account_number, refund_account_name
)
VALUES
    -- Đơn 1: Đã hoàn tất (COMPLETED) của Sinh viên -> Có thể bấm nút "Viết đánh giá sân" ngay trên giao diện
    (
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1',
        'DS100001',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
        'cccccccc-cccc-cccc-cccc-ccccccccccc1',
        'VISUAL',
        '44444444-4444-4444-4444-444444444441',
        NULL, NULL, NULL,
        CURRENT_DATE - INTERVAL '1 day',
        (CURRENT_DATE - INTERVAL '1 day') + TIME '18:00:00',
        (CURRENT_DATE - INTERVAL '1 day') + TIME '20:00:00',
        240000, 48000, 192000, TRUE, 'COMPLETED',
        NULL, NULL, NULL
    ),
    -- Đơn 2: Đã thanh toán (CONFIRMED) vào 2 ngày tới (> 24h) -> Sinh viên có thể test "Hủy sân & Nhận hoàn tiền 100%"
    (
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2',
        'DS100002',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
        'cccccccc-cccc-cccc-cccc-ccccccccccc3',
        'VISUAL',
        '44444444-4444-4444-4444-444444444441',
        NULL, NULL, NULL,
        CURRENT_DATE + INTERVAL '2 days',
        (CURRENT_DATE + INTERVAL '2 days') + TIME '17:00:00',
        (CURRENT_DATE + INTERVAL '2 days') + TIME '19:00:00',
        320000, 64000, 256000, TRUE, 'CONFIRMED',
        NULL, NULL, NULL
    ),
    -- Đơn 3: Đang chờ hoàn tiền (PENDING_REFUND) -> Lễ tân mở Tab "Yêu cầu hoàn tiền" bấm xác nhận được ngay
    (
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3',
        'DS100003',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
        'cccccccc-cccc-cccc-cccc-ccccccccccc2',
        'VISUAL',
        '44444444-4444-4444-4444-444444444443',
        NULL, NULL, NULL,
        CURRENT_DATE + INTERVAL '3 days',
        (CURRENT_DATE + INTERVAL '3 days') + TIME '19:00:00',
        (CURRENT_DATE + INTERVAL '3 days') + TIME '21:00:00',
        240000, 0, 240000, FALSE, 'PENDING_REFUND',
        'Techcombank', '1903888999000', 'HOANG QUOC BAO'
    ),
    -- Đơn 4: Vé vãng lai (WALK_IN) trong ngày hôm nay do Lễ tân tạo
    (
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee4',
        'WL200004',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
        'cccccccc-cccc-cccc-cccc-ccccccccccc1',
        'WALK_IN',
        NULL,
        'Nhóm vãng lai Anh Khoa (Ghép 6 người)', '0912345678',
        '33333333-3333-3333-3333-333333333331',
        CURRENT_DATE,
        CURRENT_DATE + TIME '17:30:00',
        CURRENT_DATE + TIME '19:30:00',
        240000, 0, 240000, FALSE, 'CONFIRMED',
        NULL, NULL, NULL
    ),
    -- Đơn 5: Khách thường đã chơi xong ở Cụm sân 1 (Sân VIP 01)
    (
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee5',
        'DS100005',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
        'cccccccc-cccc-cccc-cccc-ccccccccccc3',
        'VISUAL',
        '44444444-4444-4444-4444-444444444443',
        NULL, NULL, NULL,
        CURRENT_DATE - INTERVAL '2 days',
        (CURRENT_DATE - INTERVAL '2 days') + TIME '19:00:00',
        (CURRENT_DATE - INTERVAL '2 days') + TIME '21:00:00',
        320000, 0, 320000, FALSE, 'COMPLETED',
        NULL, NULL, NULL
    ),
    -- Đơn 6: Khách Sinh viên đã chơi xong ở Cụm sân 2 (Thái Hà Arena)
    (
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee6',
        'DS100006',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
        'cccccccc-cccc-cccc-cccc-ccccccccccc5',
        'VISUAL',
        '44444444-4444-4444-4444-444444444441',
        NULL, NULL, NULL,
        CURRENT_DATE - INTERVAL '3 days',
        (CURRENT_DATE - INTERVAL '3 days') + TIME '18:00:00',
        (CURRENT_DATE - INTERVAL '3 days') + TIME '20:00:00',
        220000, 30000, 190000, TRUE, 'COMPLETED',
        NULL, NULL, NULL
    );

-- =========================================================
-- 8. TẠO DỮ LIỆU HÓA ĐƠN BÁN HÀNG POS (pos_orders & pos_order_items)
-- =========================================================
INSERT INTO pos_orders (id, tenant_id, staff_id, booking_id, total_amount, payment_method, created_at)
VALUES
    -- Hóa đơn POS 1: Gắn với ca chơi DS100001 (Mua 1 ống cầu Hải Yến + 4 chai Revive)
    (
        'ffffffff-ffff-ffff-ffff-fffffffffff1',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
        '33333333-3333-3333-3333-333333333331',
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1',
        305000,
        'TRANSFER',
        CURRENT_TIMESTAMP - INTERVAL '1 day'
    ),
    -- Hóa đơn POS 2: Gắn với ca chơi DS100005 (Mua 2 ống cầu Hải Yến + 2 lượt thuê vợt + 4 chai Aquafina)
    (
        'ffffffff-ffff-ffff-ffff-fffffffffff2',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
        '33333333-3333-3333-3333-333333333331',
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee5',
        610000,
        'CASH',
        CURRENT_TIMESTAMP - INTERVAL '2 days'
    ),
    -- Hóa đơn POS 3: Khách mua lẻ tại quầy không gắn booking (6 chai Revive + 3 chai Aquafina)
    (
        'ffffffff-ffff-ffff-ffff-fffffffffff3',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
        '33333333-3333-3333-3333-333333333331',
        NULL,
        120000,
        'CASH',
        CURRENT_TIMESTAMP - INTERVAL '1 day'
    );

-- Chi tiết từng mặt hàng trong hóa đơn POS
INSERT INTO pos_order_items (id, order_id, product_id, quantity, unit_price)
VALUES
    -- Hàng trong Hóa đơn 1 (Tổng = 305.000đ)
    (uuid_generate_v4(), 'ffffffff-ffff-ffff-ffff-fffffffffff1', 'dddddddd-dddd-dddd-dddd-ddddddddddd3', 1, 245000), -- 1 ống cầu Hải Yến
    (uuid_generate_v4(), 'ffffffff-ffff-ffff-ffff-fffffffffff1', 'dddddddd-dddd-dddd-dddd-ddddddddddd1', 4, 15000),  -- 4 chai Revive

    -- Hàng trong Hóa đơn 2 (Tổng = 610.000đ)
    (uuid_generate_v4(), 'ffffffff-ffff-ffff-ffff-fffffffffff2', 'dddddddd-dddd-dddd-dddd-ddddddddddd3', 2, 245000), -- 2 ống cầu Hải Yến
    (uuid_generate_v4(), 'ffffffff-ffff-ffff-ffff-fffffffffff2', 'dddddddd-dddd-dddd-dddd-ddddddddddd4', 2, 40000),  -- 2 lượt thuê vợt
    (uuid_generate_v4(), 'ffffffff-ffff-ffff-ffff-fffffffffff2', 'dddddddd-dddd-dddd-dddd-ddddddddddd2', 4, 10000),  -- 4 chai Aquafina

    -- Hàng trong Hóa đơn 3 (Tổng = 120.000đ)
    (uuid_generate_v4(), 'ffffffff-ffff-ffff-ffff-fffffffffff3', 'dddddddd-dddd-dddd-dddd-ddddddddddd1', 6, 15000),  -- 6 chai Revive
    (uuid_generate_v4(), 'ffffffff-ffff-ffff-ffff-fffffffffff3', 'dddddddd-dddd-dddd-dddd-ddddddddddd2', 3, 10000);  -- 3 chai Aquafina

-- =========================================================
-- 9. TẠO ĐÁNH GIÁ SÂN MẪU (REVIEWS) TỪ CÁC CA CHƠI ĐÃ HOÀN TẤT
-- =========================================================
INSERT INTO reviews (id, tenant_id, user_id, booking_id, rating, comment)
VALUES
    (
        uuid_generate_v4(),
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
        '44444444-4444-4444-4444-444444444443',
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee5',
        5,
        'Sân VIP thi đấu thảm rất bám, trần cao thoáng mát không bị lóa đèn, lễ tân phục vụ nước tận tình!'
    ),
    (
        uuid_generate_v4(),
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
        '44444444-4444-4444-4444-444444444441',
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee6',
        5,
        'CLB có bãi để xe ô tô rộng rãi, sinh viên được giảm thẳng 30k/ca chơi nên giá rất mềm. Chắc chắn sẽ rủ bạn bè quay lại!'
    );
