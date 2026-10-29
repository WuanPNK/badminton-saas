import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import axiosClient from '../../api/axiosClient';
import TimeSelect24 from '../common/TimeSelect24';

export default function TenantShiftManager() {
  const [shifts, setShifts] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [handovers, setHandovers] = useState([]);
  const [loadingHandovers, setLoadingHandovers] = useState(false);

  // Báo cáo hiệu suất & chấm công nhân sự
  const [staffAnalytics, setStaffAnalytics] = useState([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Form thêm / sửa ca trực toàn diện
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [shiftForm, setShiftForm] = useState({
    name: '',
    startTime: '05:00',
    endTime: '14:00',
    assignedStaffId: '',
    notes: '',
  });
  const [savingShift, setSavingShift] = useState(false);

  // Modal phân công nhanh nhân sự 1 chạm
  const [quickAssignShift, setQuickAssignShift] = useState(null);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [savingAssign, setSavingAssign] = useState(false);

  // Modal xem chi tiết biên bản bàn giao
  const [viewHandover, setViewHandover] = useState(null);

  const fetchShifts = async () => {
    setLoadingShifts(true);
    try {
      const res = await axiosClient.get('/shifts');
      setShifts(res.data.shifts || []);
      setStaffList(res.data.staffList || []);
    } catch (err) {
      console.error('Lỗi tải ca trực:', err);
    } finally {
      setLoadingShifts(false);
    }
  };

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

  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const res = await axiosClient.get('/shifts/staff-analytics');
      setStaffAnalytics(res.data.staffAnalytics || []);
    } catch (err) {
      console.error('Lỗi tải hiệu suất nhân sự:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    fetchShifts();
    fetchHandovers();
    fetchAnalytics();
  }, []);

  // Mở modal thêm ca mới
  const handleOpenCreateShift = () => {
    setEditingShift(null);
    setShiftForm({
      name: '',
      startTime: '05:00',
      endTime: '14:00',
      assignedStaffId: staffList.length > 0 ? staffList[0].id : '',
      notes: '',
    });
    setShowShiftModal(true);
  };

  // Mở modal sửa ca
  const handleOpenEditShift = (shift) => {
    setEditingShift(shift);
    setShiftForm({
      name: shift.name,
      startTime: shift.start_time,
      endTime: shift.end_time,
      assignedStaffId: shift.assigned_staff_id || '',
      notes: shift.notes || '',
    });
    setShowShiftModal(true);
  };

  // Mở modal phân công nhanh 1 chạm
  const handleOpenQuickAssign = (shift) => {
    setQuickAssignShift(shift);
    setSelectedStaffId(shift.assigned_staff_id || '');
  };

  // Lưu phân công nhanh
  const handleSaveQuickAssign = async () => {
    if (!quickAssignShift) return;
    setSavingAssign(true);
    try {
      const res = await axiosClient.patch(`/shifts/${quickAssignShift.id}/assign`, {
        staffId: selectedStaffId || null,
      });
      toast.success(res.data.message);
      setQuickAssignShift(null);
      fetchShifts();
      fetchAnalytics();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể phân công nhân sự.');
    } finally {
      setSavingAssign(false);
    }
  };

  // Lưu ca trực (thêm mới hoặc cập nhật)
  const handleSaveShift = async (e) => {
    e.preventDefault();
    if (!shiftForm.name.trim()) {
      toast.error('Vui lòng nhập tên ca trực.');
      return;
    }
    setSavingShift(true);
    try {
      if (editingShift) {
        const res = await axiosClient.put(`/shifts/${editingShift.id}`, shiftForm);
        toast.success(res.data.message);
      } else {
        const res = await axiosClient.post('/shifts', shiftForm);
        toast.success(res.data.message);
      }
      setShowShiftModal(false);
      fetchShifts();
      fetchAnalytics();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi lưu ca trực.');
    } finally {
      setSavingShift(false);
    }
  };

  // Xóa ca trực
  const handleDeleteShift = async (id, name) => {
    if (!window.confirm(`Bạn có chắc muốn xóa ca trực "${name}"?`)) return;
    try {
      const res = await axiosClient.delete(`/shifts/${id}`);
      toast.success(res.data.message);
      fetchShifts();
      fetchAnalytics();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể xóa ca trực.');
    }
  };

  return (
    <div className="space-y-6 pt-4 border-t border-slate-200">
      {/* ========================================================= */}
      {/* KHU VỰC 1: QUẢN LÝ CA TRỰC & PHÂN CÔNG NHÂN SỰ */}
      {/* ========================================================= */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-5">
        <div className="flex flex-wrap justify-between items-center gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-slate-900 text-base">
                Quản Lý Ca Trực & Phân Công Nhân Sự ({shifts.length})
              </h3>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                {staffList.length} Nhân viên lễ tân
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Thiết lập khung giờ làm việc, phân công lễ tân trực ca và giao việc nhiệm vụ quầy
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenCreateShift}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <span>+ Thêm ca trực mới</span>
          </button>
        </div>

        {loadingShifts ? (
          <div className="py-8 text-center text-xs text-slate-400">Đang tải danh sách ca trực...</div>
        ) : shifts.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400 border border-dashed rounded-2xl space-y-2">
            <p>Chưa có ca trực nào được thiết lập.</p>
            <button
              onClick={handleOpenCreateShift}
              className="text-emerald-700 font-bold hover:underline"
            >
              + Bấm vào đây để tạo ca trực đầu tiên
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {shifts.map((s) => (
              <div
                key={s.id}
                className="p-5 rounded-3xl border border-slate-200/90 bg-slate-50/70 hover:bg-white hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-4"
              >
                {/* HEADER CA */}
                <div className="space-y-2.5">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="font-black text-sm text-slate-900 block">
                        {s.name}
                      </span>
                      <div className="inline-flex items-center gap-1 text-xs font-mono font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md mt-1">
                        <span>⏰ {s.start_time} – {s.end_time}</span>
                      </div>
                    </div>

                  </div>

                  {/* THÔNG TIN NHÂN SỰ PHỤ TRÁCH (TRỌNG TÂM QUẢN LÝ NHÂN SỰ) */}
                  <div className="pt-2 border-t border-slate-200/60">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                      Nhân Sự Phụ Trách:
                    </div>

                    {s.assigned_staff_id && s.staff_name ? (
                      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                            {s.staff_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <strong className="text-slate-900 text-xs font-black block truncate">
                              {s.staff_name}
                            </strong>
                            <div className="text-[11px] text-slate-500 truncate">
                              {s.staff_phone || s.staff_email || 'Lễ tân trực ca'}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenQuickAssign(s)}
                          className="shrink-0 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer"
                          title="Đổi nhân viên phụ trách ca"
                        >
                          ⇄ Đổi
                        </button>
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl flex items-center justify-between gap-2">
                        <div className="text-[11px] font-bold text-amber-800 flex items-center gap-1.5">
                          <span>⚠️ Chưa phân công</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenQuickAssign(s)}
                          className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black text-[11px] px-2.5 py-1 rounded-lg transition shadow-xs cursor-pointer"
                        >
                          + Phân công ngay
                        </button>
                      </div>
                    )}
                  </div>

                  {/* NHIỆM VỤ / CHECKLIST CÔNG VIỆC TRONG CA */}
                  {s.notes && (
                    <div className="bg-slate-100/70 p-2.5 rounded-xl text-[11px] text-slate-600">
                      <span className="font-bold text-slate-800 block text-[10px] uppercase tracking-wider mb-0.5">
                        Nhiệm vụ bàn giao:
                      </span>
                      <p className="line-clamp-2 italic">{s.notes}</p>
                    </div>
                  )}
                </div>

                {/* THAO TÁC SỬA / XÓA CA */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => handleOpenEditShift(s)}
                    className="flex-1 bg-white border border-slate-300 hover:bg-slate-100 py-1.5 rounded-xl text-slate-700 font-bold text-xs transition shadow-xs cursor-pointer text-center"
                  >
                    ✏️ Sửa & Phân công
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteShift(s.id, s.name)}
                    className="px-3 py-1.5 text-red-500 hover:bg-red-50 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* KHU VỰC 2: BẢNG TỔNG HỢP CHẤM CÔNG & HIỆU SUẤT LỄ TÂN */}
      {/* ========================================================= */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-slate-900 text-base">
                Bảng Tổng Hợp Chấm Công & Hiệu Suất Nhân Sự ({staffAnalytics.length})
              </h3>
              <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                Theo dõi nhân viên
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Tổng số ca đã trực, doanh thu quản lý và tỷ lệ khớp két tiền mặt của từng nhân viên lễ tân
            </p>
          </div>
          <button
            type="button"
            onClick={fetchAnalytics}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-3 py-1.5 rounded-xl transition cursor-pointer"
          >
            ↻ Làm mới số liệu
          </button>
        </div>

        {loadingAnalytics ? (
          <div className="py-8 text-center text-xs text-slate-400">Đang tải số liệu hiệu suất...</div>
        ) : staffAnalytics.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 border border-dashed rounded-2xl">
            Chưa có dữ liệu chấm công cho nhân viên nào.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-extrabold border-b border-slate-200">
                  <th className="p-3">Nhân viên Lễ tân</th>
                  <th className="p-3">Ca phân công hiện tại</th>
                  <th className="p-3 text-center">Số ca đã chốt</th>
                  <th className="p-3 text-right">Tổng tiền thực thu</th>
                  <th className="p-3 text-center">Độ chuẩn xác két</th>
                  <th className="p-3">Lần chốt gần nhất</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffAnalytics.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50/70 transition">
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-black text-xs flex items-center justify-center shrink-0">
                          {st.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <strong className="text-slate-900 block font-black">
                            {st.full_name}
                          </strong>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {st.phone || st.email}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      {st.assigned_shifts && st.assigned_shifts.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {st.assigned_shifts.map((ash) => (
                            <span
                              key={ash.id}
                              className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold px-2 py-0.5 rounded-md text-[10px]"
                            >
                              {ash.name} ({ash.start_time}–{ash.end_time})
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">
                          Chưa gán ca cố định
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center font-bold text-slate-800">
                      <span className="bg-slate-100 px-2.5 py-1 rounded-lg">
                        {st.total_shifts_completed} ca
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-black text-emerald-800">
                      {Number(st.total_actual_cash).toLocaleString()} ₫
                    </td>
                    <td className="p-3 text-center">
                      <div className="space-y-0.5">
                        <span className="bg-emerald-100 text-emerald-800 font-black px-2 py-0.5 rounded-full text-[10px]">
                          ✓ {st.perfect_matches_count} lần khớp 100%
                        </span>
                        {st.mismatched_count > 0 && (
                          <span className="block text-[10px] text-red-600 font-bold">
                            ⚠️ {st.mismatched_count} lần lệch tiền
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-slate-500 text-[11px]">
                      {st.last_handover_at ? (
                        <span>
                          {new Date(st.last_handover_at).toLocaleDateString('vi-VN')}{' '}
                          {new Date(st.last_handover_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : (
                        <span className="italic text-slate-400">Chưa nộp biên bản</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* KHU VỰC 3: ĐỐI SOÁT BIÊN BẢN CHỐT CA & TIỀN KÉT THỰC TẾ */}
      {/* ========================================================= */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-extrabold text-slate-900 text-base">
              Lịch Sử Chốt Ca & Đối Soát Tiền Mặt ({handovers.length})
            </h3>
            <p className="text-xs text-slate-400">
              Kiểm tra chênh lệch tiền mặt thực tế do nhân viên lễ tân nộp sau mỗi ca
            </p>
          </div>
          <button
            type="button"
            onClick={fetchHandovers}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-3 py-1.5 rounded-xl transition cursor-pointer"
          >
            ↻ Làm mới
          </button>
        </div>

        {loadingHandovers ? (
          <div className="py-8 text-center text-xs text-slate-400">Đang tải lịch sử...</div>
        ) : handovers.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400 border border-dashed rounded-2xl">
            Chưa có biên bản chốt ca nào từ nhân viên.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-extrabold border-b border-slate-200">
                  <th className="p-3">Ngày & Ca trực</th>
                  <th className="p-3">Lễ tân nộp</th>
                  <th className="p-3 text-right">Tiền hệ thống</th>
                  <th className="p-3 text-right">Tiền thực tế</th>
                  <th className="p-3 text-center">Chênh lệch</th>
                  <th className="p-3">Người nhận ca</th>
                  <th className="p-3 text-center">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {handovers.map((h) => {
                  const diff = Number(h.difference);
                  return (
                    <tr key={h.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-3">
                        <strong className="text-slate-900 block font-black">{h.shift_name}</strong>
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
                          <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-[10px] font-black">
                            ✓ Khớp 100%
                          </span>
                        ) : diff > 0 ? (
                          <span className="bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full text-[10px] font-black">
                            Thừa +{diff.toLocaleString()} ₫
                          </span>
                        ) : (
                          <span className="bg-red-100 text-red-800 px-2.5 py-0.5 rounded-full text-[10px] font-black">
                            Thiếu {diff.toLocaleString()} ₫
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-slate-600">
                        {h.receiver_name || '—'}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => setViewHandover(h)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          Xem
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

      {/* ========================================================= */}
      {/* MODAL PHÂN CÔNG NHANH NHÂN SỰ 1 CHẠM */}
      {/* ========================================================= */}
      {quickAssignShift && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-start pb-2 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  Phân Công Nhân Sự
                </span>
                <h3 className="font-black text-slate-900 text-base mt-1">
                  {quickAssignShift.name} ({quickAssignShift.start_time} – {quickAssignShift.end_time})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setQuickAssignShift(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center text-sm font-black transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Chọn nhân viên lễ tân phụ trách ca trực này. Nhân viên sẽ nhận được thông báo phân ca tự động:
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {staffList.map((st) => {
                const isSelected = selectedStaffId === st.id;
                return (
                  <div
                    key={st.id}
                    onClick={() => setSelectedStaffId(st.id)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:bg-slate-50 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                        isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {st.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <strong className="text-slate-900 text-xs font-bold block">
                          {st.full_name}
                        </strong>
                        <span className="text-[11px] text-slate-500">
                          {st.phone || st.email}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-emerald-700 font-black text-xs">✓ Chọn</span>
                    )}
                  </div>
                );
              })}

              {staffList.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                  Chưa có nhân viên lễ tân nào được tạo tài khoản.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
              {selectedStaffId && (
                <button
                  type="button"
                  onClick={() => setSelectedStaffId('')}
                  className="text-red-500 hover:bg-red-50 text-xs font-bold px-3 py-2 rounded-xl transition cursor-pointer"
                >
                  Hủy phân công ca này
                </button>
              )}
              <div className="flex-1 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setQuickAssignShift(null)}
                  className="px-4 py-2 border rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  disabled={savingAssign}
                  onClick={handleSaveQuickAssign}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-xs font-black transition shadow-sm cursor-pointer"
                >
                  {savingAssign ? 'Đang lưu...' : 'Xác nhận phân công'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL THÊM / CHỈNH SỬA CA TRỰC TOÀN DIỆN */}
      {/* ========================================================= */}
      {showShiftModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveShift}
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4"
          >
            <div className="flex justify-between items-start pb-2 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  {editingShift ? 'Chỉnh Sửa Ca Trực' : 'Thêm Ca Trực Mới'}
                </span>
                <h3 className="font-black text-slate-900 text-base mt-1">
                  {editingShift ? editingShift.name : 'Thiết Lập Khung Giờ & Phân Công Nhân Sự'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShiftModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center text-sm font-black transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tên ca trực <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Ca Sáng, Ca Chiều, Ca Tối, Ca Cuối Tuần..."
                  value={shiftForm.name}
                  onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Giờ bắt đầu ca <span className="text-red-500">*</span>
                  </label>
                  <TimeSelect24
                    value={shiftForm.startTime}
                    onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })}
                    className="w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Giờ kết thúc ca <span className="text-red-500">*</span>
                  </label>
                  <TimeSelect24
                    value={shiftForm.endTime}
                    onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })}
                    className="w-full"
                    required
                  />
                </div>
              </div>

              {/* PHÂN CÔNG NHÂN SỰ PHỤ TRÁCH */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nhân viên Lễ tân phụ trách ca:
                </label>
                <select
                  value={shiftForm.assignedStaffId}
                  onChange={(e) => setShiftForm({ ...shiftForm, assignedStaffId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="">-- Chưa phân công nhân viên --</option>
                  {staffList.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.full_name} ({st.phone || st.email})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Nhân viên được chọn sẽ tự động thấy ca trực này trên trang làm việc của mình.
                </p>
              </div>



              {/* NHIỆM VỤ & GHI CHÚ GIAO VIỆC */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nhiệm vụ bàn giao & Ghi chú cho lễ tân:
                </label>
                <textarea
                  rows={2}
                  placeholder="Ví dụ: Kiểm tra đèn sân, đối soát số lượng vợt thuê, bổ sung nước giải khát, đếm két cuối ca..."
                  value={shiftForm.notes}
                  onChange={(e) => setShiftForm({ ...shiftForm, notes: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowShiftModal(false)}
                className="flex-1 py-2.5 border rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={savingShift}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs transition shadow-sm cursor-pointer"
              >
                {savingShift ? 'Đang lưu...' : editingShift ? 'Lưu cập nhật' : 'Tạo ca trực'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL XEM CHI TIẾT BIÊN BẢN CHỐT CA */}
      {/* ========================================================= */}
      {viewHandover && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-start pb-2 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  Chi Tiết Biên Bản Bàn Giao
                </span>
                <h3 className="font-black text-slate-900 text-base mt-1">
                  {viewHandover.shift_name} ({viewHandover.start_time} – {viewHandover.end_time})
                </h3>
                <p className="text-xs text-slate-500">
                  Ngày trực: {new Date(viewHandover.shift_date).toLocaleDateString('vi-VN')} • Nhân viên: <strong className="text-slate-800">{viewHandover.staff_name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewHandover(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center text-sm font-black transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Tiền mặt vé sân:</span>
                  <span className="font-bold text-slate-900">{Number(viewHandover.court_cash).toLocaleString()} ₫</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Chuyển khoản VietQR vé sân:</span>
                  <span className="font-bold text-slate-900">{Number(viewHandover.court_transfer).toLocaleString()} ₫</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tiền mặt bán nước POS:</span>
                  <span className="font-bold text-slate-900">{Number(viewHandover.pos_cash).toLocaleString()} ₫</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Chuyển khoản VietQR POS:</span>
                  <span className="font-bold text-slate-900">{Number(viewHandover.pos_transfer).toLocaleString()} ₫</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Hoàn tiền hủy sân trong ca:</span>
                  <span className="font-bold">-{Number(viewHandover.refunds_amount).toLocaleString()} ₫</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2">
                <div className="flex justify-between font-bold text-emerald-950">
                  <span>Tiền mặt hệ thống tính (Két):</span>
                  <span>{Number(viewHandover.expected_cash).toLocaleString()} ₫</span>
                </div>
                <div className="flex justify-between font-black text-sm text-emerald-900">
                  <span>Tiền mặt thực tế đếm được:</span>
                  <span>{Number(viewHandover.actual_cash).toLocaleString()} ₫</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-emerald-200/60">
                  <span className="font-bold">Chênh lệch:</span>
                  <span className="font-black text-xs">
                    {Number(viewHandover.difference) === 0 ? (
                      <span className="text-emerald-700 bg-white px-2 py-0.5 rounded font-black">✓ Khớp tiền 100%</span>
                    ) : Number(viewHandover.difference) > 0 ? (
                      <span className="text-amber-800 bg-white px-2 py-0.5 rounded font-black">Thừa +{Number(viewHandover.difference).toLocaleString()} ₫</span>
                    ) : (
                      <span className="text-red-700 bg-white px-2 py-0.5 rounded font-black">Thiếu {Number(viewHandover.difference).toLocaleString()} ₫</span>
                    )}
                  </span>
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <div className="text-slate-600">
                  <strong>Người nhận bàn giao ca:</strong> {viewHandover.receiver_name || '—'}
                </div>
                {viewHandover.note && (
                  <div className="p-3 bg-slate-100 rounded-xl text-slate-700 italic">
                    Ghi chú bàn giao: "{viewHandover.note}"
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setViewHandover(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
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
