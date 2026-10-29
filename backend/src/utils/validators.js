/**
 * Bộ kiểm tra định dạng dữ liệu (Validators) cho Backend Badminton SaaS
 */

/**
 * Kiểm tra định dạng Email hợp lệ
 * Chấp nhận mọi domain hợp lệ: @gmail.com, @st.phenikaa-uni.edu.vn, @sis.hust.edu.vn, @yahoo.com, v.v.
 * Yêu cầu: Có tên người dùng trước @, có @, có tên miền và đuôi tên miền hợp lệ sau dấu chấm, không chứa khoảng trắng.
 */
const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return emailRegex.test(email.trim());
};

/**
 * Kiểm tra số điện thoại di động Việt Nam hợp lệ
 * Quy chuẩn: Đúng 10 chữ số, bắt đầu bằng các đầu số di động 03, 05, 07, 08, 09 (hoặc chuyển từ +84).
 */
const isValidVNPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  const cleanPhone = phone.trim().replace(/\s+/g, '').replace(/^\+84/, '0');
  const phoneRegex = /^(0[35789])[0-9]{8}$/;
  return phoneRegex.test(cleanPhone);
};

/**
 * Chuẩn hóa số điện thoại về định dạng 10 số chuẩn bắt đầu bằng 0
 */
const formatVNPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return '';
  return phone.trim().replace(/\s+/g, '').replace(/^\+84/, '0');
};

module.exports = {
  isValidEmail,
  isValidVNPhone,
  formatVNPhone
};
