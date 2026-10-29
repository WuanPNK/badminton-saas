import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import axiosClient from '../../api/axiosClient';

export default function ShiftHandoverSection({ tenant, staffUser }) {
  const [shifts, setShifts] = useState([]);
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [summaryData, setSummaryData] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const [actualCash, setActualCash] = useState('');
  const [note, setNote] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Lịch sử chốt ca
  const [handovers, setHandovers] = useState([]);
  const [loadingHandovers, setLoadingHandovers] = useState(false);
  const [selectedHandoverModal, setSelectedHandoverModal] = useState(null);

  // 1. Tải danh sách ca trực của cụm sân
  const fetchShifts = async () => {
    try {
      const res = await axiosClient.get('/shifts');
      setShifts(res.data.shifts || []);
      if (res.data.shifts?.length > 0 && !selectedShiftId) {
        // Ưu tiên chọn ca được phân công cho nhân viên này nếu có
        const myAssigned = res.data.shifts.find((s) => s.assigned_staff_id === staffUser?.id);
        if (myAssigned) {
          setSelectedShiftId(myAssigned.id);
        } else {
          const now = new Date();
          const currentHour = now.getHours();
          const matched = res.data.shifts.find((s) => {
            const startH = parseInt(s.start_time.split(':')[0], 10);
            const endH = parseInt(s.end_time.split(':')[0], 10);
            return currentHour >= startH && currentHour < endH;
          });
          setSelectedShiftId(matched ? matched.id : res.data.shifts[0].id);
        }
      }
    } catch (err) {
      console.error('Lỗi tải danh sách ca:', err);
    }
  };

  // 2. Tải lịch sử biên bản chốt ca
  const fetchHandovers = async () => {
    setLoadingHandovers(true);
    try {
      const res = await axiosClient.get('/shifts/handovers');
      setHandovers(res.data.handovers || []);
    } catch (err) {
      console.error('Lỗi tải lịch sử chốt ca:', err);
    } finally {
      setLoadingHandovers(false);
    }
  };

  useEffect(() => {
    fetchShifts();
    fetchHandovers();
  }, []);

  // 3. Tải tổng hợp tài chính khi thay đổi ca trực hoặc ngày
  useEffect(() => {
    const activeShift = shifts.find((s) => s.id === selectedShiftId);
    if (!activeShift || !selectedDate) return;

    const fetchSummary = async () => {
      setLoadingSummary(true);
      try {
        const res = await axiosClient.get('/shifts/summary', {
          params: {
            date: selectedDate,
            startTime: activeShift.start_time,
            endTime: activeShift.end_time,
          },
        });
        setSummaryData(res.data.summary);
      } catch (err) {
        console.error('Lỗi tải tổng hợp ca:', err);
      } finally {
        setLoadingSummary(false);
      }
    };

    fetchSummary();
  }, [selectedShiftId, selectedDate, shifts]);

  const activeShift = shifts.find((s) => s.id === selectedShiftId);
  const expectedCash = summaryData ? summaryData.expectedCash : 0;
  const numActualCash = actualCash !== '' ? Number(actualCash) : expectedCash;
  const difference = numActualCash - expectedCash;

  // 4. Gửi biên bản chốt ca
  const handleSubmitHandover = async (e) => {
    e.preventDefault();
    if (!activeShift) {
      toast.error('Vui lòng chọn ca trực.');
      return;
    }
    if (actualCash === '') {
      toast.error('Vui lòng nhập số tiền mặt thực tế đếm trong két.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await axiosClient.post('/shifts/handover', {
        shiftId: activeShift.id,
        shiftName: `${activeShift.name} (${activeShift.start_time} - ${activeShift.end_time})`,
        shiftDate: selectedDate,
        startTime: activeShift.start_time,
        endTime: activeShift.end_time,
        courtCash: summaryData?.courtCash || 0,
        courtTransfer: summaryData?.courtTransfer || 0,
        posCash: summaryData?.posCash || 0,
        posTransfer: summaryData?.posTransfer || 0,
        refundsAmount: summaryData?.refundsAmount || 0,
        expectedCash,
        actualCash: numActualCash,
        note,
        receiverName,
      });

      toast.success(res.data.message);
      setActualCash('');
      setNote('');
      setReceiverName('');
      fetchHandovers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi nộp biên bản chốt ca.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* KHUNG NỘP BIÊN BẢN CHỐT CA */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-black text-slate-900">
              Chốt Ca Trực & Bàn Giao Tiền Mặt
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Hệ thống tự động thống kê doanh thu vé sân và bán nước POS, đối soát số tiền thực tế trong két.
            </p>
          </div>

          {/* BỘ LỌC NGÀY VÀ CA TRỰC */}
          <div className="flex flex-wrap items-center gap-2">
            <div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
              {shifts.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedShiftId(s.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    selectedShiftId === s.id
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {s.name} ({s.start_time}–{s.end_time})
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* THÔNG TIN NHÂN SỰ PHỤ TRÁCH & GHI CHÚ NHIỆM VỤ */}
        {shifts.find((s) => s.id === selectedShiftId) && (() => {
          const activeS = shifts.find((s) => s.id === selectedShiftId);
          return (
            <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl flex flex-wrap justify-between items-center gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <div>
                  <span className="font-extrabold text-slate-900">
                    {activeS.name} ({activeS.start_time} – {activeS.end_time})
                  </span>
                  <span className="ml-2 text-slate-500">
                    • Nhân sự phụ trách: <strong className="text-emerald-800">{activeS.staff_name || 'Chưa phân công'}</strong>
                  </span>
                </div>
              </div>
              {activeS.notes && (
                <div className="text-[11px] text-slate-600 bg-white px-3 py-1 rounded-xl border border-slate-200 italic">
                  Nhiệm vụ: {activeS.notes}
                </div>
              )}
            </div>
          );
        })()}

        {/* BẢNG THỐNG KÊ TÀI CHÍNH TỰ ĐỘNG TRONG CA */}
        {loadingSummary ? (
          <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <span>Đang tổng hợp dữ liệu doanh thu trong ca...</span>
          </div>
        ) : summaryData ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* VÉ SÂN TIỀN MẶT */}
              <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-2xl space-y-1">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                  Vé Sân (Tiền mặt)
                </span>
                <p className="text-xl font-black text-emerald-900">
                  {Number(summaryData.courtCash).toLocaleString()} ₫
                </p>
                <span className="text-[10px] text-emerald-700 font-semibold">
                  {summaryData.courtCashCount} lượt thu tiền mặt
                </span>
              </div>

              {/* VÉ SÂN CHUYỂN KHOẢN */}
              <div className="bg-blue-50/70 border border-blue-200 p-4 rounded-2xl space-y-1">
                <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">
                  Vé Sân (Chuyển khoản)
                </span>
                <p className="text-xl font-black text-blue-900">
                  {Number(summaryData.courtTransfer).toLocaleString()} ₫
                </p>
                <span className="text-[10px] text-blue-700 font-semibold">
                  {summaryData.courtTransferCount} lượt VietQR online
                </span>
              </div>

              {/* POS BÁN NƯỚC TIỀN MẶT */}
              <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-2xl space-y-1">
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                  Bán Nước POS (Tiền mặt)
                </span>
                <p className="text-xl font-black text-amber-900">
                  {Number(summaryData.posCash).toLocaleString()} ₫
                </p>
                <span className="text-[10px] text-amber-700 font-semibold">
                  {summaryData.posCashCount} hóa đơn tiền mặt
                </span>
              </div>

              {/* POS BÁN NƯỚC CHUYỂN KHOẢN */}
              <div className="bg-purple-50/70 border border-purple-200 p-4 rounded-2xl space-y-1">
                <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wider">
                  Bán Nước POS (VietQR)
                </span>
                <p className="text-xl font-black text-purple-900">
                  {Number(summaryData.posTransfer).toLocaleString()} ₫
                </p>
                <span className="text-[10px] text-purple-700 font-semibold">
                  {summaryData.posTransferCount} hóa đơn quét mã
                </span>
              </div>
            </div>

            {/* TỔNG KẾT TIỀN MẶT KỲ VỌNG */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 rounded-2xl flex flex-wrap justify-between items-center gap-4">
              <div>
                <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                  Tổng tiền mặt hệ thống tính (Kỳ vọng có trong két):
                </span>
                <div className="text-2xl font-black text-emerald-400 mt-0.5">
                  {Number(expectedCash).toLocaleString()} ₫
                </div>
                <p className="text-[11px] text-slate-300 mt-1">
                  (= Tiền mặt vé sân {Number(summaryData.courtCash).toLocaleString()} ₫ + Tiền mặt POS {Number(summaryData.posCash).toLocaleString()} ₫)
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                  Tổng doanh thu ca:
                </span>
                <div className="text-xl font-black text-white">
                  {Number(summaryData.totalRevenue).toLocaleString()} ₫
                </div>
              </div>
            </div>

            {/* FORM ĐỐI SOÁT & BÀN GIAO TIỀN MẶT */}
            <form onSubmit={handleSubmitHandover} className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-4">
              <h4 className="font-extrabold text-sm text-slate-900">
                Đối Soát Tiền Mặt Thực Tế & Bàn Giao
              </h4>

              <div className="grid md:grid-cols-2 gap-4">
                {/* TIỀN MẶT THỰC TẾ TRONG KÉT */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Số tiền mặt thực tế đếm được trong két (₫) *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder={`Ví dụ: ${expectedCash}`}
                    value={actualCash}
                    onChange={(e) => setActualCash(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  {actualCash !== '' && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500">Trạng thái đối soát:</span>
                      {difference === 0 ? (
                        <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-xs font-black">
                          ✓ Khớp 100% - Tuyệt đối không lệch tiền
                        </span>
                      ) : difference > 0 ? (
                        <span className="bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full text-xs font-black">
                          Thừa: +{Number(difference).toLocaleString()} ₫
                        </span>
                      ) : (
                        <span className="bg-red-100 text-red-800 px-2.5 py-0.5 rounded-full text-xs font-black">
                          Thiếu: {Number(difference).toLocaleString()} ₫
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* NGƯỜI NHẬN CA */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tên nhân viên nhận ca sau (hoặc Chủ sân)
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Nguyễn Văn B (Ca tối)"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* GHI CHÚ BÀN GIAO */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ghi chú bàn giao ca (Tồn két lẻ, nhắc nhở ca sau, dặn việc...)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ví dụ: Két có 500k tiền lẻ 10k-20k, sân 4 đèn góc phải hơi chập chờn đã dặn thợ..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold px-6 py-3 rounded-xl text-xs transition shadow-md flex items-center gap-2 cursor-pointer"
                >
                  {submitting ? 'Đang lưu biên bản...' : '✓ Xác Nhận Chốt Ca & Nộp Biên Bản'}
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </div>

      {/* LỊCH SỬ CÁC LẦN CHỐT CA */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-extrabold text-slate-900 text-base">
              Lịch Sử Biên Bản Chốt Ca ({handovers.length})
            </h3>
            <p className="text-xs text-slate-400">
              Đối soát minh bạch các ca trực đã bàn giao gần nhất
            </p>
          </div>
          <button
            type="button"
            onClick={fetchHandovers}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-3 py-1.5 rounded-xl transition"
          >
            ↻ Làm mới
          </button>
        </div>

        {loadingHandovers ? (
          <div className="py-8 text-center text-xs text-slate-400">Đang tải lịch sử...</div>
        ) : handovers.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400 border border-dashed rounded-2xl">
            Chưa có biên bản chốt ca nào được nộp.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-extrabold border-b border-slate-200">
                  <th className="p-3">Ngày & Ca trực</th>
                  <th className="p-3">Lễ tân chốt</th>
                  <th className="p-3 text-right">Tiền mặt hệ thống</th>
                  <th className="p-3 text-right">Tiền mặt thực tế</th>
                  <th className="p-3 text-center">Chênh lệch</th>
                  <th className="p-3">Người nhận</th>
                  <th className="p-3 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {handovers.map((h) => {
                  const diff = Number(h.difference);
                  return (
                    <tr key={h.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-3">
                        <strong className="text-slate-900 block">{h.shift_name}</strong>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {new Date(h.shift_date).toLocaleDateString('vi-VN')}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-slate-700">
                        {h.staff_name}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-800">
                        {Number(h.expected_cash).toLocaleString()} ₫
                      </td>
                      <td className="p-3 text-right font-mono font-black text-slate-900">
                        {Number(h.actual_cash).toLocaleString()} ₫
                      </td>
                      <td className="p-3 text-center">
                        {diff === 0 ? (
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-black">
                            Khớp 100%
                          </span>
                        ) : diff > 0 ? (
                          <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-black">
                            +{diff.toLocaleString()} ₫
                          </span>
                        ) : (
                          <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-[10px] font-black">
                            {diff.toLocaleString()} ₫
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-slate-600">
                        {h.receiver_name || '—'}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedHandoverModal(h)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2.5 py-1 rounded-lg text-[11px] transition"
                        >
                          Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL XEM CHI TIẾT BIÊN BẢN CHỐT CA */}
      {selectedHandoverModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  Biên Bản Chốt Ca Trực
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedHandoverModal.shift_name} • Ngày {new Date(selectedHandoverModal.shift_date).toLocaleDateString('vi-VN')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHandoverModal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center text-sm font-black transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-700">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Lễ tân chốt ca:</span>
                <span className="font-bold text-slate-900">{selectedHandoverModal.staff_name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Vé sân (Tiền mặt):</span>
                <span className="font-bold text-slate-900">{Number(selectedHandoverModal.court_cash).toLocaleString()} ₫</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Bán nước POS (Tiền mặt):</span>
                <span className="font-bold text-slate-900">{Number(selectedHandoverModal.pos_cash).toLocaleString()} ₫</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Tiền mặt kỳ vọng trong két:</span>
                <span className="font-black text-slate-900">{Number(selectedHandoverModal.expected_cash).toLocaleString()} ₫</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Tiền mặt thực tế đếm được:</span>
                <span className="font-black text-emerald-700 text-sm">{Number(selectedHandoverModal.actual_cash).toLocaleString()} ₫</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 items-center">
                <span className="text-slate-500 font-medium">Chênh lệch:</span>
                <span className="font-black text-xs">
                  {Number(selectedHandoverModal.difference) === 0 ? (
                    <span className="text-emerald-600 font-bold">Khớp 100%</span>
                  ) : Number(selectedHandoverModal.difference) > 0 ? (
                    <span className="text-amber-600 font-bold">Thừa +{Number(selectedHandoverModal.difference).toLocaleString()} ₫</span>
                  ) : (
                    <span className="text-red-600 font-bold">Thiếu {Number(selectedHandoverModal.difference).toLocaleString()} ₫</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Người nhận ca sau:</span>
                <span className="font-bold text-slate-900">{selectedHandoverModal.receiver_name || 'Chưa bàn giao'}</span>
              </div>
              {selectedHandoverModal.note && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mt-2">
                  <span className="font-bold text-slate-800 block mb-0.5">Ghi chú bàn giao:</span>
                  <p className="text-slate-600 leading-relaxed">{selectedHandoverModal.note}</p>
                </div>
              )}
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 font-bold text-xs text-slate-700 transition"
              >
                🖨️ In biên bản
              </button>
              <button
                type="button"
                onClick={() => setSelectedHandoverModal(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

