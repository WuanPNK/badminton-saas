import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';

// Danh sách các mốc thời gian cách nhau 30 phút (Từ 05:00 đến 22:00 = 34 block 30 phút)
const TIME_POINTS = [
  '05:00', '05:30', '06:00', '06:30', '07:00', '07:30', '08:00', '08:30',
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
  '21:00', '21:30', '22:00'
];

// Tạo 34 block 30 phút: [{ index: 0, start: '05:00', end: '05:30' }, ...]
const HALF_HOUR_BLOCKS = TIME_POINTS.slice(0, -1).map((t, idx) => ({
  index: idx,
  start: t,
  end: TIME_POINTS[idx + 1],
}));

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export default function TenantBookingPage() {
  const { id: tenantId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tenantDetail, setTenantDetail] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [timeline, setTimeline] = useState({ courts: [], bookings: [] });
  const [selectedCourtId, setSelectedCourtId] = useState('');
  const [startSlot, setStartSlot] = useState('');
  const [endSlot, setEndSlot] = useState('');
  const [pricePreview, setPricePreview] = useState(null);

  // Độ rộng mỗi cột 30 phút (Thanh trượt Zoom giống Hình 7)
  const [cellWidth, setCellWidth] = useState(64);

  // Modal Xem Bảng giá & Thông tin sân ngay trên màn hình đặt lịch
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Modal Thanh toán VietQR 100%
  const [paymentData, setPaymentData] = useState(null);

  // Trạng thái kéo chuột trên lưới (Drag selection)
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [dragStartInfo, setDragStartInfo] = useState(null);
  const [hasDragged, setHasDragged] = useState(false);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsMouseDown(false);
      setDragStartInfo(null);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  useEffect(() => {
    axiosClient.get(`/tenant/marketplace/${tenantId}`).then((res) => {
      setTenantDetail(res.data.data);
    });
  }, [tenantId]);

  const fetchTimeline = async () => {
    try {
      const res = await axiosClient.get(`/bookings/timeline/${tenantId}`, {
        params: { date: selectedDate },
      });
      setTimeline(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTimeline();
    setSelectedCourtId('');
    setStartSlot('');
    setEndSlot('');
    setPricePreview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, selectedDate]);

  // Tự động tính giá ngay khi người dùng chọn các ô 30 phút trên lưới
  useEffect(() => {
    if (!selectedCourtId || !selectedDate || !startSlot || !endSlot) {
      setPricePreview(null);
      return;
    }
    const startIso = `${selectedDate}T${startSlot}:00`;
    const endIso = `${selectedDate}T${endSlot}:00`;

    axiosClient
      .post('/bookings/preview-price', {
        tenantId,
        courtId: selectedCourtId,
        startTime: startIso,
        endTime: endIso,
      })
      .then((res) => setPricePreview(res.data))
      .catch(() => setPricePreview(null));
  }, [tenantId, selectedCourtId, selectedDate, startSlot, endSlot]);

  // Kiểm tra trạng thái của 1 ô 30 phút [block.start, block.end] trên 1 sân
  const getCellBookingState = (court, block) => {
    if (court.is_under_maintenance) {
      return { status: 'MAINTENANCE', label: 'Bảo trì' };
    }

    const blockStartMins = timeToMinutes(block.start);
    const blockEndMins = timeToMinutes(block.end);

    const matchedBooking = timeline.bookings.find((b) => {
      if (b.court_id !== court.id) return false;
      const bStart = new Date(b.start_time);
      const bEnd = new Date(b.end_time);
      const bStartMins = bStart.getHours() * 60 + bStart.getMinutes();
      const bEndMins = bEnd.getHours() * 60 + bEnd.getMinutes();
      return bStartMins < blockEndMins && bEndMins > blockStartMins;
    });

    if (matchedBooking) {
      if (matchedBooking.booking_type === 'EVENT') {
        return { status: 'EVENT', booking: matchedBooking };
      }
      return { status: 'BOOKED', booking: matchedBooking };
    }

    // Kiểm tra xem ô này có đang nằm trong vùng khách đang chọn không
    if (selectedCourtId === court.id && startSlot && endSlot) {
      const selStart = timeToMinutes(startSlot);
      const selEnd = timeToMinutes(endSlot);
      if (blockStartMins >= selStart && blockEndMins <= selEnd) {
        return { status: 'SELECTED' };
      }
    }

    return { status: 'AVAILABLE' };
  };

  // Kiểm tra xem từ blockIndexA đến blockIndexB trên 1 sân có bị vướng lịch đã đặt không
  const isRangeFree = (court, startIdx, endIdx) => {
    for (let i = startIdx; i <= endIdx; i++) {
      const st = getCellBookingState(court, HALF_HOUR_BLOCKS[i]).status;
      if (st === 'BOOKED' || st === 'EVENT' || st === 'MAINTENANCE') {
        return false;
      }
    }
    return true;
  };

  // 1. Nhấn chuột xuống trên 1 ô 30 phút (Hỗ trợ kéo chuột chọn nhiều ô liên tục)
  const handleCellMouseDown = (court, block, e) => {
    if (e.button !== 0) return; // Chỉ nhận chuột trái
    const cellState = getCellBookingState(court, block);
    if (['BOOKED', 'EVENT', 'MAINTENANCE'].includes(cellState.status)) {
      return;
    }

    setIsMouseDown(true);
    setHasDragged(false);
    setDragStartInfo({ courtId: court.id, blockIndex: block.index });
  };

  // 2. Kéo chuột qua các ô kế tiếp trên cùng một hàng sân
  const handleCellMouseEnter = (court, block) => {
    if (!isMouseDown || !dragStartInfo) return;
    if (dragStartInfo.courtId !== court.id) return; // Chỉ kéo trên cùng 1 sân

    if (block.index !== dragStartInfo.blockIndex) {
      setHasDragged(true);
      const startIdx = Math.min(dragStartInfo.blockIndex, block.index);
      const endIdx = Math.max(dragStartInfo.blockIndex, block.index);

      // Kiểm tra nếu toàn bộ dải từ startIdx tới endIdx còn trống
      if (isRangeFree(court, startIdx, endIdx)) {
        setSelectedCourtId(court.id);
        setStartSlot(HALF_HOUR_BLOCKS[startIdx].start);
        setEndSlot(HALF_HOUR_BLOCKS[endIdx].end);
      }
    }
  };

  // 3. Thả chuột kết thúc kéo
  const handleCellMouseUp = (court, block) => {
    if (isMouseDown && hasDragged) {
      const currentStartIdx = HALF_HOUR_BLOCKS.findIndex((b) => b.start === startSlot);
      const currentEndIdx = HALF_HOUR_BLOCKS.findIndex((b) => b.end === endSlot);
      // Nếu chỉ kéo 1 ô (30 phút) -> Tự động chọn 2 ô kế tiếp (1 tiếng) để đáp ứng quy định tối thiểu
      if (currentStartIdx !== -1 && currentEndIdx !== -1 && currentEndIdx - currentStartIdx === 0) {
        const nextBlock = HALF_HOUR_BLOCKS[currentStartIdx + 1];
        if (nextBlock && isRangeFree(court, currentStartIdx, currentStartIdx + 1)) {
          setEndSlot(nextBlock.end);
        }
      }
    }
    setIsMouseDown(false);
    setDragStartInfo(null);
  };

  // 4. Xử lý khi khách bấm click truyền thống (Vẫn giữ nguyên 100% cách bấm cũ)
  const handleCellClick = (court, block) => {
    if (hasDragged) {
      setHasDragged(false);
      return;
    }

    const cellState = getCellBookingState(court, block);
    if (['BOOKED', 'EVENT', 'MAINTENANCE'].includes(cellState.status)) {
      return;
    }

    // Nếu bấm sang sân khác hoặc chưa chọn gì -> Mặc định chọn 2 block liên tiếp (1 tiếng) nếu trống
    if (selectedCourtId !== court.id || !startSlot || !endSlot) {
      const nextBlock = HALF_HOUR_BLOCKS[block.index + 1];
      if (nextBlock && isRangeFree(court, block.index, block.index + 1)) {
        setSelectedCourtId(court.id);
        setStartSlot(block.start);
        setEndSlot(nextBlock.end);
      } else {
        toast.error('Thời lượng đặt sân tối thiểu là 1 tiếng (2 ô 30 phút liên tiếp).');
      }
      return;
    }

    const currentStartIdx = HALF_HOUR_BLOCKS.findIndex((b) => b.start === startSlot);
    const currentEndIdx = HALF_HOUR_BLOCKS.findIndex((b) => b.end === endSlot);

    if (block.index >= currentStartIdx && block.index <= currentEndIdx && currentEndIdx - currentStartIdx === 1) {
      setSelectedCourtId('');
      setStartSlot('');
      setEndSlot('');
      return;
    }

    const newStartIdx = Math.min(currentStartIdx, block.index);
    const newEndIdx = Math.max(currentEndIdx, block.index);

    if (block.index > currentStartIdx) {
      if (!isRangeFree(court, currentStartIdx, block.index)) {
        return toast.error('Không thể chọn nối qua khung giờ đã có người đặt!');
      }
      setEndSlot(block.end);
    } else if (block.index < currentStartIdx) {
      if (!isRangeFree(court, block.index, currentEndIdx)) {
        return toast.error('Không thể chọn nối qua khung giờ đã có người đặt!');
      }
      setStartSlot(block.start);
    } else if (newEndIdx - newStartIdx >= 1) {
      setEndSlot(block.end);
    }
  };

  const handleCreateVisualBooking = async () => {
    if (!user) {
      toast.error('Vui lòng đăng nhập để tiến hành đặt sân và thanh toán!');
      navigate('/login');
      return;
    }

    try {
      const startIso = `${selectedDate}T${startSlot}:00`;
      const endIso = `${selectedDate}T${endSlot}:00`;

      const res = await axiosClient.post('/bookings/visual', {
        tenantId,
        courtId: selectedCourtId,
        bookingDate: selectedDate,
        startTime: startIso,
        endTime: endIso,
      });

      const bookingId = res.data.booking.id;
      const qrRes = await axiosClient.get(`/payments/${bookingId}/info`);
      setPaymentData(qrRes.data.paymentData);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi đặt lịch.');
    }
  };

  // Đóng hoặc Hủy thanh toán VietQR -> Hủy đơn PENDING trên server và giải phóng ô sân ngay lập tức!
  const handleClosePaymentModal = async () => {
    if (paymentData?.bookingId) {
      try {
        await axiosClient.delete(`/bookings/${paymentData.bookingId}/cancel-pending`);
      } catch (err) {
        console.error('Lỗi khi hủy đơn PENDING:', err);
      }
    }
    setPaymentData(null);
    fetchTimeline(); // Lấy lại lịch mới nhất từ server -> Sân sẽ về màu trắng (AVAILABLE) ngay!
  };

  const handleMockConfirmPayment = async () => {
    try {
      const res = await axiosClient.put(`/payments/${paymentData.bookingId}/pay-mock`);
      toast.success(res.data.message);
      setPaymentData(null);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi xác nhận thanh toán.');
    }
  };

  if (!tenantDetail) {
    return <div className="p-12 text-center text-sm text-slate-500">Đang tải bảng lưới đặt lịch...</div>;
  }

  const selectedCourtObj = timeline.courts.find((c) => c.id === selectedCourtId);

  return (
    <div className="min-h-screen bg-[#EBF7F2] flex flex-col justify-between pb-28">
      <div>
        {/* HEADER MÀU XANH ĐẬM CHUẨN HÌNH 7 */}
        <header className="bg-[#046A38] text-white px-4 sm:px-8 py-3.5 shadow-md">
          <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-xs sm:text-sm font-bold hover:text-emerald-200 transition"
            >
              <span className="text-lg">‹</span>
              <span>Quay lại Trang chủ</span>
            </button>

            <h1 className="text-sm sm:text-lg font-extrabold uppercase tracking-wide text-center">
              ĐẶT LỊCH THEO SÂN - TRỰC QUAN ({tenantDetail.tenant.name})
            </h1>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 bg-white/15 px-3 py-1.5 rounded-xl border border-white/20">
                <span className="text-xs font-bold">Ngày:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-white text-xs sm:text-sm font-extrabold focus:outline-none cursor-pointer"
                />
              </div>

              {!user && (
                <button
                  onClick={() => navigate('/login')}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-3.5 py-1.5 rounded-xl text-xs transition shadow-sm"
                >
                  Đăng nhập
                </button>
              )}
            </div>
          </div>

          {/* THANH CHÚ THÍCH TRẠNG THÁI MÀU SẮC (LEGEND NHƯ HÌNH 7) */}
          <div className="max-w-7xl mx-auto pt-3 mt-3 border-t border-white/15 flex flex-wrap justify-between items-center gap-4 text-xs">
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-white border border-slate-300 inline-block shadow-sm"></span>
                <span>Trống</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-[#FF5A5F] inline-block shadow-sm"></span>
                <span>Đã đặt</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-emerald-400 border-2 border-white inline-block shadow-sm"></span>
                <span className="font-bold text-emerald-200">Đang chọn</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-slate-400 inline-block shadow-sm"></span>
                <span>Khoá / Bảo trì</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-purple-400 inline-block shadow-sm flex items-center justify-center text-[10px] font-black text-white">
                  !
                </span>
                <span>Sự kiện</span>
              </div>

              <button
                type="button"
                onClick={() => setShowInfoModal(true)}
                className="text-amber-300 hover:text-amber-200 font-extrabold underline underline-offset-4"
              >
                Xem sân & bảng giá
              </button>
            </div>

            <div className="text-[11px] font-bold bg-white/10 px-3 py-1 rounded-full">
              {user?.studentStatus === 'VERIFIED'
                ? '🎓 Đã kích hoạt tự động giảm giá Học sinh / Sinh viên'
                : 'Tài khoản Khách tiêu chuẩn'}
            </div>
          </div>
        </header>

        {/* DÒNG LƯU Ý HƯỚNG DẪN */}
        <div className="bg-[#FFFBEB] border-b border-amber-200 px-4 py-2 text-center text-xs text-slate-700">
          <strong className="text-amber-700">Lưu ý:</strong> Bấm trực tiếp vào các ô 30 phút màu trắng trên cùng 1 hàng sân để chọn giờ chơi (tối thiểu 2 ô = 1 giờ). Nếu bạn cần đặt lịch cố định tháng hoặc tổ chức giải đấu, vui lòng liên hệ Hotline:{' '}
          <strong className="text-emerald-800">{tenantDetail.tenant.phone_contact}</strong>
        </div>

        {/* ===================================================================== */}
        {/* BẢNG LƯỚI ĐẶT SÂN TRỰC QUAN 30 PHÚT (TIMELINE GRID - HÌNH 7)           */}
        {/* ===================================================================== */}
        <div className="max-w-[98vw] mx-auto mt-4 px-2 sm:px-6">
          <div className="bg-white rounded-2xl shadow-md border border-slate-300 overflow-x-auto">
            <table className="border-collapse select-none w-max min-w-full">
              {/* HÀNG TIÊU ĐỀ MỐC GIỜ 30 PHÚT */}
              <thead>
                <tr className="bg-[#BCE3F5] text-slate-800 text-[11px] font-bold">
                  <th className="sticky left-0 z-20 bg-[#BCE3F5] border-b border-r border-slate-300 px-4 py-3 text-left min-w-[130px] shadow-[2px_0_5px_rgba(0,0,0,0.04)]">
                    Danh sách Sân
                  </th>
                  {HALF_HOUR_BLOCKS.map((block) => (
                    <th
                      key={block.index}
                      style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }}
                      className="border-b border-r border-slate-300/80 py-2.5 text-center font-mono"
                    >
                      {block.start}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* TỪNG HÀNG SÂN CẦU LÔNG */}
              <tbody>
                {timeline.courts.map((court) => (
                  <tr key={court.id} className="hover:bg-slate-50/50">
                    {/* CỘT TÊN SÂN CỐ ĐỊNH BÊN TRÁI */}
                    <td className="sticky left-0 z-10 bg-[#D6F5E3] border-b border-r border-slate-300 px-4 py-3.5 font-extrabold text-xs text-emerald-950 shadow-[2px_0_5px_rgba(0,0,0,0.04)]">
                      <div>{court.name}</div>
                      <span
                        className={`inline-block mt-0.5 text-[10px] px-1.5 py-0.2 rounded font-bold ${
                          court.type === 'VIP'
                            ? 'bg-amber-200 text-amber-900'
                            : 'bg-emerald-200/80 text-emerald-800'
                        }`}
                      >
                        {court.type}
                      </span>
                    </td>

                    {/* 34 Ô LƯỚI 30 PHÚT TRONG NGÀY */}
                    {HALF_HOUR_BLOCKS.map((block) => {
                      const state = getCellBookingState(court, block);

                      let cellClass =
                        'bg-white hover:bg-emerald-50 cursor-pointer';
                      let cellContent = null;

                      if (state.status === 'BOOKED') {
                        cellClass = 'bg-[#FF5A5F] text-white cursor-not-allowed';
                      } else if (state.status === 'EVENT') {
                        cellClass = 'bg-purple-400 text-white cursor-not-allowed';
                        cellContent = <span className="text-[10px] font-bold">Sự kiện</span>;
                      } else if (state.status === 'MAINTENANCE') {
                        cellClass = 'bg-slate-300 text-slate-600 cursor-not-allowed';
                      } else if (state.status === 'SELECTED') {
                        cellClass =
                          'bg-emerald-500 text-white font-bold cursor-pointer ring-1 ring-emerald-700';
                        cellContent = <span className="text-[11px]">✓</span>;
                      }

                      return (
                        <td
                          key={block.index}
                          onMouseDown={(e) => handleCellMouseDown(court, block, e)}
                          onMouseEnter={() => handleCellMouseEnter(court, block)}
                          onMouseUp={() => handleCellMouseUp(court, block)}
                          onClick={() => handleCellClick(court, block)}
                          title={`${court.name} (${block.start} - ${block.end}) - Bấm hoặc kéo chuột để chọn`}
                          style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }}
                          className={`h-12 border-b border-r border-slate-300 text-center align-middle transition-colors select-none ${cellClass}`}
                        >
                          {cellContent}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {timeline.courts.length === 0 && (
                  <tr>
                    <td colSpan={35} className="p-10 text-center text-sm text-slate-500">
                      Cụm sân này hiện chưa có sân nào được mở bán.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* THANH THU PHÓNG KÍCH THƯỚC Ô LƯỚI (ZOOM SLIDER GÓC DƯỚI PHẢI NHƯ HÌNH 7) */}
          <div className="flex flex-wrap justify-between items-center gap-4 mt-4 px-2">
            {selectedCourtId && startSlot && endSlot ? (
              <div className="flex flex-wrap items-center gap-3 bg-white px-4 py-2 rounded-2xl shadow-sm border border-emerald-200 text-xs">
                <span className="font-extrabold text-emerald-900">
                  🏸 Đang chọn: {selectedCourtObj?.name} ({startSlot} → {endSlot})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCourtId('');
                    setStartSlot('');
                    setEndSlot('');
                  }}
                  className="text-red-600 font-bold hover:underline"
                >
                  ✕ Xóa chọn
                </button>
              </div>
            ) : (
              <div className="text-xs text-slate-600 font-medium">
                💡 Mẹo: Bấm vào ô bắt đầu và bấm tiếp vào ô kết thúc trên cùng 1 hàng sân để chọn nhiều block 30 phút.
              </div>
            )}

            <div className="bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200 flex items-center gap-3 ml-auto">
              <span className="text-[11px] font-bold text-slate-500">Thu phóng lưới:</span>
              <input
                type="range"
                min={44}
                max={96}
                value={cellWidth}
                onChange={(e) => setCellWidth(Number(e.target.value))}
                className="w-28 accent-emerald-600 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* THANH TỔNG KẾT GIÁ & NÚT "TIẾP THEO" CỐ ĐỊNH Ở ĐÁY MÀN HÌNH (HÌNH 7)    */}
      {/* ===================================================================== */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 sm:px-8 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] z-30">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="text-xs sm:text-sm">
            {pricePreview ? (
              <div className="flex flex-wrap items-center gap-3 sm:gap-5">
                <div>
                  <span className="text-slate-500">Sân chọn: </span>
                  <strong className="text-slate-900">{selectedCourtObj?.name}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Khung giờ: </span>
                  <strong className="text-emerald-700">
                    {startSlot} - {endSlot} ({pricePreview.totalHours} giờ)
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Giá gốc: </span>
                  <span className="line-through text-slate-400 mr-1">
                    {pricePreview.isStudentApplied
                      ? `${Number(pricePreview.originalPrice).toLocaleString()}đ`
                      : ''}
                  </span>
                  <strong className="text-lg font-black text-emerald-700">
                    {Number(pricePreview.finalPrice).toLocaleString()} ₫
                  </strong>
                  {pricePreview.isStudentApplied && (
                    <span className="ml-2 bg-emerald-100 text-emerald-800 text-[11px] px-2 py-0.5 rounded-full font-bold">
                      🎓 Đã giảm HSSV -{Number(pricePreview.discountApplied).toLocaleString()}đ
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <span className="text-slate-500 font-medium">
                Vui lòng chọn ít nhất 2 ô 30 phút liên tiếp (tối thiểu 1 giờ) trên bảng lưới để tiếp tục.
              </span>
            )}
          </div>

          <button
            onClick={handleCreateVisualBooking}
            disabled={!pricePreview}
            className="w-full sm:w-auto min-w-[240px] bg-[#EAB308] hover:bg-[#CA8A04] disabled:bg-slate-200 disabled:text-slate-400 text-white font-black uppercase tracking-wider py-3.5 px-8 rounded-xl text-sm transition shadow-md"
          >
            TIẾP THEO (THANH TOÁN VIETQR)
          </button>
        </div>
      </div>

      {/* MODAL XEM NHANH BẢNG GIÁ & QUY ĐỊNH SÂN */}
      {showInfoModal && (
        <div
          onClick={() => setShowInfoModal(false)}
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                Bảng giá giờ chơi — {tenantDetail.tenant.name}
              </h3>
              <button
                onClick={() => setShowInfoModal(false)}
                className="text-xs font-bold text-slate-500 hover:text-slate-900"
              >
                ✕ Đóng
              </button>
            </div>

            <table className="w-full text-xs text-center border border-slate-200">
              <thead className="bg-emerald-800 text-white">
                <tr>
                  <th className="p-2.5 border">Loại sân</th>
                  <th className="p-2.5 border">Khung giờ</th>
                  <th className="p-2.5 border">Giá tiêu chuẩn</th>
                </tr>
              </thead>
              <tbody>
                {tenantDetail.pricingRules.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="p-2.5 font-bold border">{r.court_type}</td>
                    <td className="p-2.5 border">
                      {r.start_time.slice(0, 5)} - {r.end_time.slice(0, 5)}
                    </td>
                    <td className="p-2.5 font-extrabold text-emerald-700 border">
                      {Number(r.price_per_hour).toLocaleString()} ₫/giờ
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL MÔ PHỎNG THANH TOÁN VIETQR 100% */}
      {paymentData && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={handleClosePaymentModal}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center text-sm transition"
              title="Hủy đặt sân & Đóng"
            >
              ✕
            </button>

            <h3 className="text-lg font-extrabold text-slate-900">
              Thanh toán 100% Tiền Sân qua VietQR
            </h3>
            <p className="text-xs text-slate-500">
              Mã đơn: <strong>{paymentData.bookingCode}</strong> | Sân:{' '}
              <strong>{paymentData.courtName}</strong>
            </p>

            <img
              src={paymentData.vietQrUrl}
              alt="VietQR Payment"
              className="w-56 h-56 mx-auto border rounded-2xl p-2"
            />

            <div className="bg-slate-50 p-3.5 rounded-2xl text-xs text-left space-y-1.5 border">
              <div>
                Ngân hàng Chủ sân: <strong>{paymentData.bankName}</strong>
              </div>
              <div>
                Số tài khoản: <strong>{paymentData.accountNumber}</strong>
              </div>
              <div>
                Chủ tài khoản: <strong>{paymentData.accountName}</strong>
              </div>
              <div>
                Số tiền (100%):{' '}
                <strong className="text-emerald-700">
                  {Number(paymentData.finalPrice).toLocaleString()} ₫
                </strong>
              </div>
              <div>
                Nội dung CK: <strong className="text-blue-700">{paymentData.transferContent}</strong>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleClosePaymentModal}
                className="flex-1 py-3 border border-slate-300 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 transition"
              >
                ✕ Hủy & Đóng
              </button>
              <button
                type="button"
                onClick={handleMockConfirmPayment}
                className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-xl text-xs shadow-md active:scale-95 transition"
              >
                ✓ Mô phỏng: Đã chuyển khoản 100%
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}