/**
 * Kiểm tra thời gian đặt có chẵn block 30 phút (:00 hoặc :30) và tối thiểu 60 phút không
 */
function validateTimeBlocks(startTimeStr, endTimeStr) {
  const start = new Date(startTimeStr);
  const end = new Date(endTimeStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { valid: false, message: 'Định dạng thời gian không hợp lệ.' };
  }

  if (end <= start) {
    return { valid: false, message: 'Giờ kết thúc phải lớn hơn giờ bắt đầu.' };
  }

  const startMinutes = start.getMinutes();
  const endMinutes = end.getMinutes();

  if (
    ![0, 30].includes(startMinutes) ||
    ![0, 30].includes(endMinutes) ||
    start.getSeconds() !== 0 ||
    end.getSeconds() !== 0
  ) {
    return {
      valid: false,
      message: 'Thời gian đặt sân bắt buộc phải chẵn theo các mốc 30 phút (ví dụ: 17:00, 17:30).'
    };
  }

  const diffMinutes = (end - start) / (1000 * 60);
  if (diffMinutes < 60) {
    return { valid: false, message: 'Thời gian đặt sân tối thiểu là 1 tiếng (2 block 30 phút).' };
  }

  return { valid: true, start, end, totalHours: diffMinutes / 60 };
}

/**
 * Chuyển chuỗi "HH:MM:SS" hoặc "HH:MM" thành tổng số phút tính từ 00:00
 */
function timeStringToMinutes(timeStr) {
  const parts = timeStr.split(':').map(Number);
  return parts[0] * 60 + parts[1];
}

/**
 * Tính toán chi tiết tiền sân theo từng block 30 phút và áp dụng ưu đãi Sinh viên
 */
function calculateBookingPrice({
  start,
  end,
  courtType,
  pricingRules,
  tenant,
  isVerifiedStudent
}) {
  const DEFAULT_PRICE_PER_HOUR = 80000; // Giá mặc định nếu chủ sân chưa cấu hình khung giờ đó
  let originalPrice = 0;

  // Chuyển đổi ngày trong tuần của JS (0=CN, 1=T2...6=T7) sang chuẩn DB (1=T2...7=CN)
  const jsDay = start.getDay();
  const dbDayOfWeek = jsDay === 0 ? 7 : jsDay;

  // Duyệt qua từng block 30 phút từ start đến end
  let cursor = new Date(start);
  while (cursor < end) {
    const blockMinutesFromMidnight = cursor.getHours() * 60 + cursor.getMinutes();

    // Tìm rule khớp với loại sân, ngày trong tuần và khung giờ
    const matchedRule = pricingRules.find((rule) => {
      if (rule.court_type !== courtType) return false;
      if (!rule.days_of_week.includes(dbDayOfWeek)) return false;

      const ruleStartMins = timeStringToMinutes(rule.start_time);
      const ruleEndMins = timeStringToMinutes(rule.end_time);

      return blockMinutesFromMidnight >= ruleStartMins && blockMinutesFromMidnight < ruleEndMins;
    });

    const hourlyRate = matchedRule ? Number(matchedRule.price_per_hour) : DEFAULT_PRICE_PER_HOUR;
    originalPrice += hourlyRate / 2; // Mỗi block 30 phút bằng 1/2 giá 1 giờ

    // Tiến thêm 30 phút
    cursor = new Date(cursor.getTime() + 30 * 60 * 1000);
  }

  // Xử lý Ưu đãi Học sinh / Sinh viên (Chỉ áp dụng khi tài khoản đã VERIFIED)
  let discountApplied = 0;
  let isStudentApplied = false;
  const totalHours = (end - start) / (1000 * 60 * 60);

  if (isVerifiedStudent && tenant.student_discount_type !== 'NONE') {
    const discountType = tenant.student_discount_type;
    const discountVal = Number(tenant.student_discount_value || 0);

    if (discountType === 'SYSTEM_DEFAULT_20') {
      discountApplied = Math.round(originalPrice * 0.2);
      isStudentApplied = true;
    } else if (discountType === 'CUSTOM_FIXED_OFF' && discountVal > 0) {
      discountApplied = Math.min(originalPrice, discountVal);
      isStudentApplied = true;
    } else if (discountType === 'CUSTOM_FLAT_RATE' && discountVal > 0) {
      const studentFlatTotal = discountVal * totalHours;
      if (studentFlatTotal < originalPrice) {
        discountApplied = originalPrice - studentFlatTotal;
        isStudentApplied = true;
      }
    }
  }

  const finalPrice = Math.max(0, originalPrice - discountApplied);

  return {
    originalPrice,
    discountApplied,
    finalPrice,
    isStudentApplied
  };
}

module.exports = {
  validateTimeBlocks,
  calculateBookingPrice
};