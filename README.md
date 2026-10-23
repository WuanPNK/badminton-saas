# Nền Tảng Đặt Lịch Sân Cầu Lông & Quản Lý Đa Chi Nhánh (Badminton SaaS)

> **Đồ Án Chuyên Ngành / Khóa Luận Tốt Nghiệp**  
> Hệ thống Marketplace đặt sân cầu lông trực quan, quản lý vận hành đa cụm sân (Multi-Tenant SaaS) và điểm bán hàng POS.

---

## 🏸 Giới Thiệu Dự Án

Hệ thống được thiết kế nhằm số hóa toàn diện quy trình vận hành sân cầu lông và kết nối người chơi:
- **Người chơi (End-Users)**: Khám phá cụm sân theo quận, xem bảng giá theo khung giờ, đặt sân qua lưới thời gian trực quan 30 phút, thanh toán VietQR và hưởng chính sách ưu đãi Học sinh / Sinh viên.
- **Khách vãng lai (Guest Mode)**: Khám phá thông tin cụm sân, bảng giá và tiện ích mà không bắt buộc phải đăng nhập.
- **Chủ sân (Tenant Admin)**: Quản lý nhiều sân, cấu hình giá động theo giờ cao điểm/cuối tuần, phân quyền nhân viên, quản lý kho hàng quầy nước POS và thống kê doanh thu.
- **Lễ tân (Staff)**: Check-in ca chơi, tạo vé vãng lai tại quầy, bán nước giải khát POS và hoàn tiền khi khách hủy lịch.
- **Quản trị viên hệ thống (Super Admin)**: Phê duyệt hồ sơ đối tác sân mới, xét duyệt thẻ Sinh viên và quản lý các gói cước hệ thống.

---

## 🛠️ Công Nghệ Sử Dụng

| Thành phần | Công nghệ chính |
| :--- | :--- |
| **Frontend** | React 18, Vite, TailwindCSS, React Router v6, React Hot Toast, Axios |
| **Backend** | Node.js, Express.js, PostgreSQL (`pg`), JSON Web Token (JWT), Bcryptjs |
| **Kiến trúc** | Multi-Tenant Architecture, RESTful API, Database Transactions (ACID) |
| **Cơ chế đặc biệt** | Khóa dữ liệu Row-Level Lock (`SELECT ... FOR UPDATE`) chống Race Condition khi đặt sân trùng giờ |

---

## 📋 Yêu Cầu Môi Trường

Trước khi chạy dự án, máy tính cần cài đặt sẵn:
1. **Node.js** (Phiên bản v18.x hoặc mới hơn) & **npm**
2. **PostgreSQL** (Phiên bản v14.x hoặc mới hơn)

---

## 🚀 Hướng Dẫn Khởi Chạy (Chỉ 1 Lệnh Duy Nhất)

Hệ thống đã được tích hợp script tự động hóa toàn diện (`start.js`). Khi Thầy Cô mở dự án lần đầu, chỉ cần mở Terminal tại thư mục gốc và chạy **đúng 1 lệnh duy nhất**:

```bash
npm run dev
```

### ⚡ Hệ thống sẽ tự động xử lý mọi thứ từ A đến Z:
1. **Tự động tạo file cấu hình `.env`**: Sao chép tự động từ `backend/.env.example` nếu chưa tồn tại.
2. **Tự động cài đặt thư viện dependencies**: Tự động phát hiện và chạy `npm install` cho cả Backend và Frontend nếu máy chưa có `node_modules`.
3. **Tự động tạo & nạp CSDL trong lần đầu**: Tự động tạo cơ sở dữ liệu `badminton_saas_db` trên PostgreSQL, khởi tạo 12 bảng và nạp toàn bộ dữ liệu mẫu (sân thi đấu, tài khoản, đơn đặt lịch, kho hàng POS).
4. **Khởi chạy đồng thời cả hai phần**:
   * **Giao diện Web Frontend**: `http://localhost:5173` *(Mở lên là thấy ngay danh sách cụm sân)*
   * **Server Backend API**: `http://localhost:5000`

> 💡 **Lưu ý nhỏ về PostgreSQL**: Đảm bảo dịch vụ PostgreSQL đang chạy trên máy. Nếu mật khẩu PostgreSQL trên máy của Thầy Cô khác `123456`, chỉ cần chỉnh sửa mật khẩu trong file `backend/.env`.

---

## 👥 Danh Sách Tài Khoản Mẫu Thử Nghiệm

Dưới đây là danh sách các tài khoản mẫu đã được khởi tạo sẵn trong cơ sở dữ liệu để phục vụ việc kiểm thử và đưa vào báo cáo đồ án. Tất cả tài khoản đều có mật khẩu chung là: `123456`.

| Vai trò | Email đăng nhập | Mật khẩu | Chức năng nổi bật để chấm điểm |
| :--- | :--- | :---: | :--- |
| **👑 Super Admin** | `superadmin@badminton.vn` | `123456` | Duyệt đối tác cụm sân mới, duyệt ảnh thẻ HSSV, gia hạn gói cước đối tác. |
| **🏟️ Chủ sân (Tenant Admin)** | `tenant1_owner@badminton.vn` | `123456` | Cấu hình bảng giá theo giờ vàng, thiết lập mức giảm HSSV (-20%), quản lý sân, tạo tài khoản lễ tân, thống kê doanh thu. |
| **🧑‍💼 Lễ tân (Staff)** | `staff1@badminton.vn` | `123456` | Check-in ca chơi, tạo đơn đặt lịch cho khách vãng lai, bán nước giải khát POS, duyệt hoàn tiền 100% khi khách hủy lịch. |
| **🎓 Khách hàng HSSV** | `student1@badminton.vn` | `123456` | Tài khoản đã được phê duyệt thẻ Sinh viên, hệ thống tự động áp dụng chiết khấu khi đặt lịch. |
| **🏸 Khách hàng thường** | `user1@badminton.vn` | `123456` | Đặt lịch trực quan theo ô 30 phút, thanh toán VietQR, hủy lịch hoàn tiền, viết nhận xét & chấm sao sân. |

---

## 💡 Điểm Sáng Kỹ Thuật (Key Technical Highlights)

1. **Bảo toàn giao dịch ACID & Chống Race Condition**:
   - Khi đặt sân, hệ thống khởi tạo `BEGIN ... COMMIT` và sử dụng `SELECT ... FOR UPDATE` để khóa hàng dữ liệu của sân.
   - Ngăn chặn hoàn toàn việc 2 khách hàng bấm đặt cùng một khung giờ tại cùng một mili-giây gây trùng lịch (Overbooking).
2. **Khởi tạo dữ liệu mẫu Idempotent**:
   - Script `npm run init-db` an toàn để chạy lại nhiều lần bất kỳ lúc nào mà không bị lỗi trùng khóa chính hoặc trùng định nghĩa kiểu ENUM.
3. **Trải nghiệm người dùng đồng nhất (UX/UI)**:
   - Thay thế 100% hộp thoại cảnh báo mặc định của trình duyệt (`alert()`) bằng thư viện `react-hot-toast` hiện đại.
   - Kiến trúc Component rõ ràng, chia nhỏ các Modal và Thẻ giao diện theo chuẩn React hiện đại.
