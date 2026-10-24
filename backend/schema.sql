-- Kích hoạt extension sinh mã UUID tự động
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Dọn dẹp nếu muốn tạo mới toàn bộ cấu trúc (Idempotent)
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS pos_order_items CASCADE;
DROP TABLE IF EXISTS pos_orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS pricing_rules CASCADE;
DROP TABLE IF EXISTS courts CASCADE;
DROP TABLE IF EXISTS tenant_subscriptions CASCADE;
DROP TABLE IF EXISTS subscription_plans CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;
DROP TABLE IF EXISTS otp_verifications CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP TYPE IF EXISTS role_type CASCADE;
DROP TYPE IF EXISTS approval_status CASCADE;
DROP TYPE IF EXISTS student_status CASCADE;
DROP TYPE IF EXISTS discount_type CASCADE;
DROP TYPE IF EXISTS booking_type CASCADE;
DROP TYPE IF EXISTS booking_status CASCADE;
DROP TYPE IF EXISTS court_type CASCADE;

-- ==========================================
-- 1. KHỞI TẠO CÁC KIỂU DỮ LIỆU CỐ ĐỊNH (ENUMS)
-- ==========================================
CREATE TYPE role_type AS ENUM ('SUPER_ADMIN', 'TENANT_ADMIN', 'STAFF', 'USER');
CREATE TYPE approval_status AS ENUM ('PENDING', 'ACTIVE', 'LOCKED', 'PUBLISHED', 'REJECTED');
CREATE TYPE student_status AS ENUM ('NONE', 'PENDING_APPROVAL', 'VERIFIED', 'REJECTED');
CREATE TYPE discount_type AS ENUM ('NONE', 'SYSTEM_DEFAULT_20', 'CUSTOM_FIXED_OFF', 'CUSTOM_FLAT_RATE');
CREATE TYPE booking_type AS ENUM ('VISUAL', 'WALK_IN', 'EVENT');
CREATE TYPE booking_status AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'PENDING_REFUND', 'REFUNDED', 'CANCELLED', 'EXPIRED');
CREATE TYPE court_type AS ENUM ('STANDARD', 'VIP');

-- ==========================================
-- 2. NHÓM BẢNG DOANH THU CỦA SUPER ADMIN (SAAS)
-- ==========================================

-- Bảng Gói cước phần mềm (Super Admin cấu hình)
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL, -- VD: Gói Cơ Bản, Gói Chuyên Nghiệp
    price_per_month DECIMAL(12, 2) NOT NULL,
    max_courts INT NOT NULL DEFAULT 5,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 3. NHÓM BẢNG NGƯỜI DÙNG & XÁC THỰC OTP
-- ==========================================

-- Bảng Người dùng (Gộp chung 4 vai trò)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role role_type NOT NULL DEFAULT 'USER',
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,

    -- Thông tin xác thực Học sinh / Sinh viên (Dành cho End-User)
    student_status student_status DEFAULT 'NONE',
    student_card_url TEXT,

    -- Thông tin tài khoản ngân hàng nhận hoàn tiền khi hủy sân trước 24h
    bank_name VARCHAR(50),
    bank_account_number VARCHAR(50),
    bank_account_name VARCHAR(100),

    -- Khóa ngoại liên kết Nhân viên/Chủ sân với Cụm sân
    tenant_id UUID, 

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng Lưu mã OTP gửi qua Email (Đăng ký & Quên mật khẩu)
CREATE TABLE otp_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(150) NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    purpose VARCHAR(50) NOT NULL, -- 'REGISTER' hoặc 'RESET_PASSWORD'
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 4. NHÓM BẢNG CHỦ SÂN (TENANT) & CẤU HÌNH
-- ==========================================

-- Bảng Cụm sân (Khách hàng B2B)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(150) NOT NULL,
    district VARCHAR(100) NOT NULL, -- Phục vụ thanh lọc theo Quận trên Marketplace
    address TEXT NOT NULL,
    phone_contact VARCHAR(20) NOT NULL,
    description TEXT,
    status approval_status DEFAULT 'PENDING', -- Phải được Super Admin duyệt mới sang ACTIVE

    -- Công tắc Bật/Tắt tính năng (Feature Toggling do Chủ sân tự quyết)
    enable_vip_courts BOOLEAN DEFAULT FALSE,
    enable_pos_module BOOLEAN DEFAULT FALSE,          -- Bật/tắt bán nước & phụ kiện
    enable_advanced_analytics BOOLEAN DEFAULT FALSE,  -- Bật/tắt báo cáo chuyên sâu

    -- Cấu hình Ưu đãi Học sinh / Sinh viên của riêng Cụm sân
    student_discount_type discount_type DEFAULT 'NONE',
    student_discount_value DECIMAL(12, 2) DEFAULT 0,  -- Số tiền giảm hoặc giá đồng giá

    -- Cấu hình tài khoản nhận tiền VietQR
    qr_bank_name VARCHAR(50),
    qr_account_number VARCHAR(50),
    qr_account_name VARCHAR(100),

    -- Hình ảnh & Điều khoản nội quy của Cụm sân
    images TEXT[] DEFAULT '{}',
    rules TEXT[] DEFAULT '{}',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Gắn khóa ngoại tenant_id cho bảng users
ALTER TABLE users ADD CONSTRAINT fk_user_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;

-- Bảng Lịch sử đóng tiền thuê phần mềm (Tính doanh thu cho Super Admin)
CREATE TABLE tenant_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    amount_paid DECIMAL(12, 2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    payment_status VARCHAR(30) DEFAULT 'PAID', -- PAID, EXPIRED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 5. NHÓM BẢNG SÂN BÃI & GIÁ ĐỘNG
-- ==========================================

-- Bảng Sân thực tế
CREATE TABLE courts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL, -- VD: Sân 1, Sân VIP A
    type court_type DEFAULT 'STANDARD',
    status approval_status DEFAULT 'PENDING', -- Super Admin duyệt mới chuyển thành PUBLISHED
    is_under_maintenance BOOLEAN DEFAULT FALSE,
    maintenance_start TIMESTAMP,
    maintenance_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng Khung giá động (Chủ sân tự cài đặt mức giá theo khung giờ)
CREATE TABLE pricing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    court_type court_type NOT NULL,
    start_time TIME NOT NULL, -- VD: 05:00:00 hoặc 17:00:00
    end_time TIME NOT NULL,   -- VD: 17:00:00 hoặc 22:00:00
    price_per_hour DECIMAL(12, 2) NOT NULL,
    days_of_week INT[] NOT NULL, -- [1,2,3,4,5,6,7] (1=Thứ 2 ... 7=Chủ Nhật)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 6. NHÓM BẢNG ĐẶT LỊCH, THANH TOÁN & HOÀN TIỀN
-- ==========================================

-- Bảng Đơn đặt sân
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_code VARCHAR(20) UNIQUE NOT NULL, -- Mã ngắn hiển thị trên QR (VD: DS1024)
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    court_id UUID NOT NULL REFERENCES courts(id),
    
    -- Phân loại: Đặt trực quan (Khách tự đặt) vs Vãng lai/Sự kiện (Lễ tân/Chủ sân tạo)
    booking_type booking_type NOT NULL DEFAULT 'VISUAL',
    user_id UUID REFERENCES users(id),        -- Có giá trị nếu khách đặt online
    walk_in_guest_name VARCHAR(100),          -- Dùng khi Lễ tân tạo vé Vãng lai / Sự kiện
    walk_in_guest_phone VARCHAR(20),
    created_by_staff_id UUID REFERENCES users(id),

    -- Thời gian (Chẵn block 30 phút)
    booking_date DATE NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,

    -- Chi tiết tiền sân (Thanh toán 100%)
    original_price DECIMAL(12, 2) NOT NULL,
    discount_applied DECIMAL(12, 2) DEFAULT 0,
    final_price DECIMAL(12, 2) NOT NULL,
    is_student_applied BOOLEAN DEFAULT FALSE,

    -- Trạng thái đơn & Check-in
    status booking_status DEFAULT 'PENDING',
    checked_in_at TIMESTAMP,

    -- Thông tin phục vụ Hoàn tiền thủ công (Khi hủy trước 24h)
    refund_bank_name VARCHAR(50),
    refund_account_number VARCHAR(50),
    refund_account_name VARCHAR(100),
    refunded_at TIMESTAMP,
    refunded_by_staff_id UUID REFERENCES users(id),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 7. NHÓM BẢNG BÁN HÀNG POS & ĐÁNH GIÁ
-- ==========================================

-- Bảng Kho hàng F&B / Phụ kiện
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) DEFAULT 'DRINK', -- DRINK, SHUTTLECOCK, RACKET_RENTAL
    price DECIMAL(12, 2) NOT NULL,
    stock_quantity INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng Hóa đơn POS tại quầy
CREATE TABLE pos_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    staff_id UUID NOT NULL REFERENCES users(id),
    court_id UUID REFERENCES courts(id),     -- Sân đang gọi đồ / thanh toán (Sân 1, Sân 2...)
    booking_id UUID REFERENCES bookings(id), -- Ghép vào ca sân nếu khách mua thêm lúc đang chơi
    total_amount DECIMAL(12, 2) NOT NULL,
    payment_method VARCHAR(30) DEFAULT 'CASH', -- CASH, TRANSFER
    note VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng Chi tiết mặt hàng trong Hóa đơn POS
CREATE TABLE pos_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES pos_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INT NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL
);

-- Bảng Đánh giá Cụm sân (Verified Purchase)
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    booking_id UUID NOT NULL REFERENCES bookings(id) UNIQUE, -- Ràng buộc 1 đơn COMPLETED chỉ đánh giá 1 lần
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
