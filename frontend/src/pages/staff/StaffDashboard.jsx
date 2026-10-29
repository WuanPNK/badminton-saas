import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';
import TimeSelect24 from '../../components/common/TimeSelect24';
import NotificationBell from '../../components/common/NotificationBell';
import socket from '../../config/socket';
import { isValidVNPhone, sanitizePhoneInput } from '../../utils/validators';
import CourtTimelineGrid from '../../components/staff/CourtTimelineGrid';
import ExtendBookingModal from '../../components/staff/ExtendBookingModal';
import ShiftHandoverSection from '../../components/staff/ShiftHandoverSection';

export default function StaffDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState('OPERATIONS');
  const [tenant, setTenant] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [timeline, setTimeline] = useState({ courts: [], bookings: [] });
  const [refundRequests, setRefundRequests] = useState([]);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [posOrders, setPosOrders] = useState([]);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  // Modal Sửa Hóa Đơn
  const [showEditModal, setShowEditModal] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState(null);
  const [editItems, setEditItems] = useState([]);
  const [editCourtId, setEditCourtId] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editingOrder, setEditingOrder] = useState(false);
  const [selectedAddProductId, setSelectedAddProductId] = useState('');

  // Modal Quét / Nhập QR Check-in Nhanh (Đề xuất 4)
  const [showQuickCheckInModal, setShowQuickCheckInModal] = useState(false);
  const [qrInputCode, setQrInputCode] = useState('');
  const [quickCheckInLoading, setQuickCheckInLoading] = useState(false);
  const [lastCheckInResult, setLastCheckInResult] = useState(null);

  const [staffBooking, setStaffBooking] = useState({
    courtId: '',
    courtIds: [],
    bookingType: 'EVENT',
    guestName: '',
    guestPhone: '',
    startTime: '17:00',
    endTime: '19:00',
    customPrice: '',
  });

  const [posCourtId, setPosCourtId] = useState('');
  const [posNote, setPosNote] = useState('');
  const [eventPricePreview, setEventPricePreview] = useState(null);
  const [extendModalBooking, setExtendModalBooking] = useState(null);
  const [selectedGridBooking, setSelectedGridBooking] = useState(null);
  const [viewMode, setViewMode] = useState('GRID');
  const [shiftAccess, setShiftAccess] = useState(null);

  // Tự động cập nhật currentTime mỗi 30s để đếm lùi thời gian khóa 30 phút chính xác
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Tự động tính giá vé Sự kiện thời gian thực (giảm 20% khi đặt trên 3 sân)
  useEffect(() => {
    if (!tenant?.id || !staffBooking.courtIds || staffBooking.courtIds.length === 0) {
      setEventPricePreview(null);
      return;
    }
    const fetchPreview = async () => {
      try {
        const startIso = `${selectedDate}T${staffBooking.startTime}:00`;
        const endIso = `${selectedDate}T${staffBooking.endTime}:00`;
        const res = await axiosClient.post('/bookings/preview-price', {
          tenantId: tenant.id,
          courtIds: staffBooking.courtIds,
          startTime: startIso,
          endTime: endIso,
          isEvent: true,
        });
        setEventPricePreview(res.data);
      } catch (e) {
        setEventPricePreview(null);
      }
    };
    fetchPreview();
  }, [tenant?.id, staffBooking.courtIds, staffBooking.startTime, staffBooking.endTime, selectedDate]);

  const loadInitial = async () => {
    try {
      const [statusRes, setRes] = await Promise.all([
        axiosClient.get('/shifts/my-status'),
        axiosClient.get('/tenant/my-settings'),
      ]);
      setShiftAccess(statusRes.data);
      const t = setRes.data.tenant;
      setTenant(t);

      const tlRes = await axiosClient.get(`/bookings/timeline/${t.id}`, {
        params: { date: selectedDate },
      });
      setTimeline(tlRes.data);
      if (tlRes.data.courts.length > 0 && !staffBooking.courtId) {
        setStaffBooking((prev) => ({
          ...prev,
          courtId: tlRes.data.courts[0].id,
          courtIds: [tlRes.data.courts[0].id],
        }));
      }

      const refRes = await axiosClient.get('/payments/refund-requests');
      setRefundRequests(refRes.data.refundRequests || []);

      if (t.enable_pos_module) {
        const [prodRes, ordersRes] = await Promise.all([
          axiosClient.get('/pos/products'),
          axiosClient.get('/pos/orders'),
        ]);
        setProducts(prodRes.data.products || []);
        setPosOrders(ordersRes.data.orders || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadInitial();
  }, [selectedDate]);

  // Đề xuất 3: Đồng bộ trạng thái thời gian thực bằng Socket.io cho Lễ tân
  useEffect(() => {
    if (!tenant?.id) return;

    socket.emit('join_tenant', tenant.id);

    const handleBookingUpdate = (payload) => {
      loadInitial();

      if (payload.type === 'BOOKING_CONFIRMED') {
        toast.success(`Khách vừa thanh toán vé #${payload.booking?.booking_code || ''}!`, {
          duration: 4000,
        });
      } else if (payload.type === 'BOOKING_CREATED') {
        toast('Có khách đang đặt giữ chỗ trên ứng dụng.', {
          duration: 3000,
        });
      } else if (payload.type === 'BOOKING_CANCELLED') {
        toast('Một ca đặt sân đã được hủy / giải phóng chỗ.', {
          duration: 3000,
        });
      } else if (payload.type === 'BOOKING_CHECKED_IN') {
        toast.success(`Check-in thành công: #${payload.booking?.booking_code || ''}`, {
          duration: 3000,
        });
      }
    };

    socket.on('booking_updated', handleBookingUpdate);

    return () => {
      socket.emit('leave_tenant', tenant.id);
      socket.off('booking_updated', handleBookingUpdate);
    };
  }, [tenant?.id, selectedDate]);

  // Đề xuất 4: Xử lý Check-in nhanh 1 giây qua mã QR hoặc mã vé
  const handleQuickCheckIn = async (e) => {
    if (e) e.preventDefault();
    if (!qrInputCode.trim()) {
      toast.error('Vui lòng nhập hoặc quét mã vé!');
      return;
    }

    setQuickCheckInLoading(true);
    try {
      const res = await axiosClient.post('/bookings/quick-check-in', {
        code: qrInputCode.trim(),
      });
      toast.success(res.data.message);
      setLastCheckInResult(res.data.booking);
      setQrInputCode('');
      loadInitial();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi thực hiện check-in nhanh.');
    } finally {
      setQuickCheckInLoading(false);
    }
  };


  const handleCreateStaffBooking = async (e) => {
    e.preventDefault();
    try {
      const startIso = `${selectedDate}T${staffBooking.startTime}:00`;
      const endIso = `${selectedDate}T${staffBooking.endTime}:00`;

      if (staffBooking.bookingType === 'EVENT' && (!staffBooking.courtIds || staffBooking.courtIds.length === 0)) {
        toast.error('Vui lòng chọn ít nhất 1 sân để tổ chức sự kiện!');
        return;
      }

      if (staffBooking.guestPhone && !isValidVNPhone(staffBooking.guestPhone)) {
        toast.error('Số điện thoại không đúng định dạng Việt Nam (10 số, bắt đầu bằng 03, 05, 07, 08, 09)!');
        return;
      }

      const res = await axiosClient.post('/bookings/staff-create', {
        courtId: staffBooking.courtId,
        courtIds: staffBooking.bookingType === 'EVENT' ? staffBooking.courtIds : undefined,
        bookingType: 'EVENT',
        guestName: staffBooking.guestName,
        guestPhone: staffBooking.guestPhone,
        bookingDate: selectedDate,
        startTime: startIso,
        endTime: endIso,
        customPrice: staffBooking.customPrice || undefined,
      });

      toast.success(res.data.message);
      setStaffBooking((prev) => ({
        ...prev,
        guestName: '',
        guestPhone: '',
        customPrice: '',
        courtIds: timeline.courts.length > 0 ? [timeline.courts[0].id] : [],
      }));
      loadInitial();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi tạo vé.');
    }
  };

  const handleOperation = async (bookingId, action) => {
    try {
      const res = await axiosClient.put(`/bookings/${bookingId}/operation`, { action });
      toast.success(res.data.message);
      loadInitial();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi thao tác.');
    }
  };

  const handleConfirmRefunded = async (bookingId) => {
    try {
      const res = await axiosClient.put(`/payments/${bookingId}/confirm-refund`);
      toast.success(res.data.message);
      loadInitial();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi xác nhận hoàn tiền.');
    }
  };

  // ĐỀ XUẤT 1: THÊM VÀO GIỎ HÀNG KÈM THEO DÕI TỒN KHO & GIỚI HẠN
  const addToCart = (prod) => {
    setCart((prev) => {
      const found = prev.find((i) => i.productId === prod.id);
      if (found) {
        if (found.quantity >= prod.stock_quantity) {
          toast.error(`Kho chỉ còn ${prod.stock_quantity} sản phẩm "${prod.name}"!`);
          return prev;
        }
        return prev.map((i) => (i.productId === prod.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        {
          productId: prod.id,
          name: prod.name,
          price: prod.price,
          quantity: 1,
          stock_quantity: prod.stock_quantity,
        },
      ];
    });
  };

  // ĐỀ XUẤT 1: XÓA 1 MÓN KHỎI GIỎ HÀNG 1 CHẠM
  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  // ĐỀ XUẤT 1: TĂNG / GIẢM SỐ LƯỢNG KÈM KIỂM SOÁT TỒN KHO
  const updateCartQty = (productId, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId !== productId) return item;
          const nextQty = item.quantity + delta;
          if (nextQty > item.stock_quantity) {
            toast.error(`Kho chỉ còn ${item.stock_quantity} sản phẩm "${item.name}"!`);
            return item;
          }
          return { ...item, quantity: nextQty };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  // ĐỀ XUẤT 1: NHẬP TRỰC TIẾP SỐ LƯỢNG BẰNG Ô INPUT SỐ
  const updateCartQtyDirect = (productId, val) => {
    const parsed = parseInt(val, 10);
    setCart((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        if (isNaN(parsed) || parsed <= 0) {
          return { ...item, quantity: 1 };
        }
        if (parsed > item.stock_quantity) {
          toast.error(`Kho chỉ còn ${item.stock_quantity} sản phẩm "${item.name}"!`);
          return { ...item, quantity: item.stock_quantity };
        }
        return { ...item, quantity: parsed };
      })
    );
  };

  // ĐỀ XUẤT 3: TÍNH TOÁN KHÓA THỜI GIAN 30 PHÚT SAU KHI TẠO ĐƠN
  const getOrderTimeStatus = (createdAt) => {
    const created = new Date(createdAt);
    const diffMs = currentTime - created;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const isWithin30 = diffMinutes <= 30;
    const remainingMinutes = Math.max(0, 30 - diffMinutes);
    return { diffMinutes, isWithin30, remainingMinutes };
  };

  // ĐỀ XUẤT 3: MỞ MODAL HỦY ĐƠN (KIỂM TRA QUYỀN VÀ KHÓA 30 PHÚT)
  const handleOpenCancelModal = (order) => {
    const { isWithin30, diffMinutes } = getOrderTimeStatus(order.created_at);
    if (user?.role === 'STAFF' && !isWithin30) {
      toast.error(
        `Đơn hàng này đã quá hạn 30 phút (${diffMinutes} phút trước). Lễ tân không thể hủy, vui lòng liên hệ Chủ sân (Admin)!`
      );
      return;
    }
    setOrderToCancel(order);
    setCancelReason('');
    setShowCancelModal(true);
  };

  // ĐỀ XUẤT 3: GỌI API HỦY HÓA ĐƠN & TỰ ĐỘNG HOÀN TRẢ KHO
  const handleConfirmCancelOrder = async (e) => {
    e.preventDefault();
    if (!orderToCancel) return;

    setCancelling(true);
    try {
      const res = await axiosClient.put(`/pos/orders/${orderToCancel.id}/cancel`, {
        reason: cancelReason.trim() || 'Lễ tân hủy hóa đơn sai',
      });
      toast.success(res.data.message || 'Đã hủy hóa đơn và hoàn kho thành công!');
      setShowCancelModal(false);
      setOrderToCancel(null);
      setCancelReason('');
      loadInitial();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi hủy hóa đơn.');
    } finally {
      setCancelling(false);
    }
  };

  // MỞ MODAL CHỈNH SỬA HÓA ĐƠN POS (KIỂM TRA KHÓA 30 PHÚT)
  const handleOpenEditModal = (order) => {
    const { isWithin30, diffMinutes } = getOrderTimeStatus(order.created_at);
    if (user?.role === 'STAFF' && !isWithin30) {
      toast.error(
        `Đơn hàng này đã quá hạn 30 phút (${diffMinutes} phút trước). Lễ tân không thể sửa đơn, vui lòng liên hệ Chủ sân (Admin)!`
      );
      return;
    }
    setOrderToEdit(order);
    setEditCourtId(order.court_id || '');
    setEditNote(order.note || '');

    // Tính toán maxStock có thể chọn: Tồn kho hiện tại trong danh mục + số lượng đang được giữ bởi đơn này
    const initialItems = (order.items || []).map((it) => {
      const prod = products.find((p) => p.id === it.product_id);
      const currentStock = prod ? Number(prod.stock_quantity) : 0;
      const initialQty = Number(it.quantity) || 1;
      return {
        productId: it.product_id,
        name: it.product_name,
        price: Number(it.unit_price),
        quantity: initialQty,
        initialQty: initialQty,
        maxStock: currentStock + initialQty,
      };
    });
    setEditItems(initialItems);
    setSelectedAddProductId('');
    setShowEditModal(true);
  };

  // THÊM MÓN VÀO ĐƠN ĐANG SỬA
  const handleAddItemToEditOrder = (productId) => {
    if (!productId) return;
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    setEditItems((prev) => {
      const existing = prev.find((item) => item.productId === productId);
      if (existing) {
        if (existing.quantity >= existing.maxStock) {
          toast.error(`Kho chỉ còn ${existing.maxStock} sản phẩm "${existing.name}"!`);
          return prev;
        }
        return prev.map((item) =>
          item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      if (prod.stock_quantity <= 0) {
        toast.error(`Sản phẩm "${prod.name}" đã hết hàng trong kho!`);
        return prev;
      }
      return [
        ...prev,
        {
          productId: prod.id,
          name: prod.name,
          price: Number(prod.price),
          quantity: 1,
          initialQty: 0,
          maxStock: Number(prod.stock_quantity),
        },
      ];
    });
    setSelectedAddProductId('');
  };

  // CẬP NHẬT SỐ LƯỢNG MÓN ĐANG SỬA (NÚT + / -)
  const updateEditItemQty = (productId, delta) => {
    setEditItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        const nextQty = item.quantity + delta;
        if (nextQty > item.maxStock) {
          toast.error(`Kho chỉ còn tối đa ${item.maxStock} sản phẩm "${item.name}"!`);
          return item;
        }
        if (nextQty <= 0) return item;
        return { ...item, quantity: nextQty };
      })
    );
  };

  // GÕ SỐ LƯỢNG TRỰC TIẾP TRONG MODAL SỬA
  const updateEditItemQtyDirect = (productId, val) => {
    const parsed = parseInt(val, 10);
    setEditItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        if (isNaN(parsed) || parsed <= 0) return { ...item, quantity: 1 };
        if (parsed > item.maxStock) {
          toast.error(`Kho chỉ còn tối đa ${item.maxStock} sản phẩm "${item.name}"!`);
          return { ...item, quantity: item.maxStock };
        }
        return { ...item, quantity: parsed };
      })
    );
  };

  // XÓA MÓN KHỎI ĐƠN ĐANG SỬA
  const removeEditItem = (productId) => {
    if (editItems.length <= 1) {
      toast.error('Hóa đơn phải có ít nhất 1 món. Nếu muốn hủy toàn bộ đơn, hãy chọn "Hủy đơn"!');
      return;
    }
    setEditItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  // LƯU CẬP NHẬT HÓA ĐƠN
  const handleSaveEditOrder = async (e) => {
    e.preventDefault();
    if (!orderToEdit) return;
    if (editItems.length === 0) {
      toast.error('Hóa đơn phải có ít nhất 1 món!');
      return;
    }

    setEditingOrder(true);
    try {
      const res = await axiosClient.put(`/pos/orders/${orderToEdit.id}`, {
        courtId: editCourtId || null,
        note: editNote || null,
        items: editItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      });

      toast.success(res.data.message || 'Đã cập nhật hóa đơn thành công!');
      setShowEditModal(false);
      setOrderToEdit(null);
      loadInitial();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi cập nhật hóa đơn.');
    } finally {
      setEditingOrder(false);
    }
  };

  const handleCheckoutPos = async () => {
    if (cart.length === 0) return;
    try {
      const res = await axiosClient.post('/pos/orders', {
        courtId: posCourtId || null,
        note: posNote || null,
        paymentMethod: 'CASH',
        items: cart.map((c) => ({ productId: c.productId, quantity: c.quantity })),
      });
      toast.success(res.data.message);
      setCart([]);
      setPosNote('');
      loadInitial();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi thanh toán.');
    }
  };

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // CHẶN NHÂN VIÊN LỄ TÂN KHI NGOÀI CA TRỰC ĐƯỢC PHÂN CÔNG
  if (shiftAccess && !shiftAccess.canAccess && user?.role === 'STAFF') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border border-slate-100 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-20 h-20 rounded-3xl bg-amber-50 text-amber-500 mx-auto flex items-center justify-center text-4xl shadow-inner border border-amber-200/80">
            ⏳
          </div>

          <div className="space-y-2">
            <span className="inline-block bg-amber-100 text-amber-900 text-[11px] font-black px-3.5 py-1 rounded-full uppercase tracking-wider">
              {shiftAccess.status === 'NO_SHIFT_ASSIGNED' ? 'Chưa phân công ca' : 'Chưa tới ca trực'}
            </span>
            <h2 className="text-2xl font-black text-slate-900">
              {shiftAccess.status === 'NO_SHIFT_ASSIGNED' ? 'Bạn Chưa Được Phân Công Ca Trực' : 'Chưa Tới Giờ Vào Ca Trực'}
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Xin chào <strong className="text-slate-800">{user?.fullName}</strong>. Để đảm bảo an toàn vận hành sân và minh bạch bàn giao két tiền, hệ thống chỉ mở quyền thao tác quầy lễ tân khi bạn đang trong đúng ca trực được chủ sân phân công.
            </p>
          </div>

          {shiftAccess.assignedShifts && shiftAccess.assignedShifts.length > 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-2.5">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Lịch trực được phân công của bạn tại {tenant?.name || 'cụm sân'}:
              </div>
              {shiftAccess.assignedShifts.map((s) => (
                <div key={s.id} className="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center shadow-xs">
                  <div>
                    <strong className="text-slate-900 font-extrabold text-xs block">{s.name}</strong>
                    <span className="text-[11px] text-emerald-800 font-bold font-mono">
                      ⏰ {s.start_time} – {s.end_time}
                    </span>
                  </div>
                  <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 font-extrabold px-2 py-0.5 rounded">
                    Chưa tới ca
                  </span>
                </div>
              ))}
              <div className="text-[11px] text-slate-500 text-center pt-1 font-medium">
                🕒 Đồng hồ hệ thống hiện tại: <strong className="text-slate-800 font-mono">{shiftAccess.currentTime}</strong>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 font-medium">
              Tài khoản của bạn hiện chưa được chủ sân gán vào bất kỳ ca trực nào. Vui lòng liên hệ chủ sân để được xếp lịch trực.
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/');
              }}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-2xl font-bold text-xs transition cursor-pointer"
            >
              Đăng xuất
            </button>
            <button
              type="button"
              onClick={() => loadInitial()}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-2xl font-black text-xs transition shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              ↻ Tải lại kiểm tra
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16">
      {/* HEADER QUẦY LỄ TÂN */}
      <header className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-slate-900 text-white px-6 py-4 shadow-md sticky top-0 z-40 border-b border-emerald-900/60">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight">Quầy Lễ Tân — {tenant.name}</h1>
              <p className="text-xs text-emerald-200/80">
                Nhân viên ca trực: <strong className="text-white">{user?.fullName}</strong> ({user?.role === 'STAFF' ? 'Lễ tân' : user?.role === 'TENANT_ADMIN' ? 'Chủ sân' : user?.role === 'ADMIN' ? 'Quản trị viên' : user?.role})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <NotificationBell />
            {user?.role === 'TENANT_ADMIN' && (
              <button
                onClick={() => navigate('/tenant')}
                className="bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm active:scale-95"
              >
                ← Về Quản trị Chủ sân
              </button>
            )}
            <button
              onClick={() => { logout(); navigate('/'); }}
              className="bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        {/* TABS */}
        <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-100 mb-6">
          <button
            onClick={() => setTab('OPERATIONS')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition ${
              tab === 'OPERATIONS' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            1. Trực Lịch Sân & Tạo Vé
          </button>
          <button
            onClick={() => setTab('REFUNDS')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              tab === 'REFUNDS' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>2. Yêu cầu Hoàn tiền</span>
            {refundRequests.length > 0 && (
              <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[10px] font-extrabold">
                {refundRequests.length}
              </span>
            )}
          </button>
          {tenant.enable_pos_module && (
            <button
              onClick={() => setTab('POS')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition ${
                tab === 'POS' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              3. Bán Hàng Tại Quầy
            </button>
          )}
          <button
            onClick={() => setTab('SHIFTS')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              tab === 'SHIFTS' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>4. Chốt Ca & Bàn Giao</span>
          </button>
        </div>

        {/* TAB 1: TRỰC SÂN & TẠO VÉ */}
        {tab === 'OPERATIONS' && (
          <div className="grid lg:grid-cols-12 gap-6 items-start">
            {/* DANH SÁCH CA ĐẶT */}
            <div className="lg:col-span-8 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="font-extrabold text-slate-900 text-base">Danh sách ca chơi trong ngày</h2>
                  <p className="text-xs text-slate-500">Check-in khách đến sân và xác nhận hoàn tất ca chơi</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setViewMode('GRID')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                        viewMode === 'GRID' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Sơ đồ ma trận thời gian thực (05:00 - 22:00)"
                    >
                      <span>📊 Sơ đồ lưới</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('LIST')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                        viewMode === 'LIST' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Danh sách ca dạng thẻ dọc"
                    >
                      <span>📋 Danh sách thẻ</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setLastCheckInResult(null);
                      setShowQuickCheckInModal(true);
                    }}
                    className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 transition cursor-pointer"
                  >
                    <span>Quét / Nhập QR Check-in (1s)</span>
                  </button>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {viewMode === 'GRID' ? (
                <CourtTimelineGrid
                  courts={timeline.courts}
                  bookings={timeline.bookings}
                  selectedDate={selectedDate}
                  onSelectBooking={(b) => setSelectedGridBooking(b)}
                  onQuickCheckIn={(id) => handleOperation(id, 'CHECK_IN')}
                  onQuickComplete={(id) => handleOperation(id, 'COMPLETE')}
                  onQuickExtend={(b) => setExtendModalBooking(b)}
                />
              ) : (
                <div className="space-y-3">
                {timeline.bookings.map((b) => {
                  const courtObj = timeline.courts.find((c) => c.id === b.court_id);
                  const now = new Date();
                  const startTime = new Date(b.start_time);
                  const endTime = new Date(b.end_time);
                  const windowStart = new Date(startTime.getTime() - 15 * 60 * 1000); // 15 phút trước giờ chơi

                  const isCheckedIn = Boolean(b.is_checked_in || b.checked_in_at);
                  const isPastEndTime = now >= endTime;
                  const isCompleted = b.status === 'COMPLETED' || isPastEndTime;
                  const isWithinWindow = now >= windowStart && now <= endTime;
                  const isTooEarly = now < windowStart;

                  return (
                    <div
                      key={b.id}
                      className="p-4 border border-slate-100 rounded-2xl bg-slate-50/70 hover:bg-white hover:shadow-sm transition flex flex-wrap justify-between items-center gap-4 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-extrabold text-slate-900 bg-white border px-2 py-0.5 rounded">
                            #{b.booking_code}
                          </span>
                          <span className="font-bold text-slate-800">
                            {courtObj ? courtObj.name : 'Sân'}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                            b.booking_type === 'EVENT'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {b.booking_type === 'EVENT' ? 'Sự kiện' : 'Đặt trực tuyến'}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                            isCompleted
                              ? 'bg-blue-100 text-blue-800'
                              : b.status === 'CONFIRMED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}>
                            {isCompleted ? 'Đã hoàn thành' : b.status === 'CONFIRMED' ? 'Đã xác nhận' : b.status === 'PENDING' ? 'Chờ thanh toán' : b.status === 'CANCELLED' ? 'Đã hủy' : b.status === 'PENDING_REFUND' ? 'Chờ hoàn tiền' : b.status === 'REFUNDED' ? 'Đã hoàn tiền' : b.status}
                          </span>
                        </div>
                        <p className="text-slate-600 font-medium pt-0.5">
                          {startTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })} →{' '}
                          {endTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })}
                          {b.walk_in_guest_name && <span className="ml-2 text-purple-900 font-semibold">• Sự kiện: {b.walk_in_guest_name}</span>}
                        </p>
                      </div>

                      {/* CỘT THAO TÁC CHECK-IN (NÚT CHỈ HIỆN MÀU TỪ 15 PHÚT TRƯỚC GIỜ CHƠI ĐẾN HẾT GIỜ) */}
                      <div className="flex items-center gap-2">
                        {isCheckedIn ? (
                          <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 px-3.5 py-2 rounded-xl font-black flex items-center gap-1.5 shadow-sm text-xs">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Đã Check-in ({new Date(b.checked_in_at || b.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })})
                          </span>
                        ) : isWithinWindow ? (
                          <button
                            onClick={() => handleOperation(b.id, 'CHECK_IN')}
                            className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-4 py-2 rounded-xl font-extrabold transition shadow-md flex items-center gap-1.5 text-xs animate-pulse"
                            title="Bấm để xác nhận khách đã đến sân check-in"
                          >
                            <span>Khách Check-In</span>
                          </button>
                        ) : isTooEarly ? (
                          <div className="flex flex-col items-end">
                            <button
                              disabled
                              className="bg-slate-100 text-slate-400 border border-slate-200 px-3.5 py-2 rounded-xl font-bold text-xs cursor-not-allowed flex items-center gap-1.5 opacity-80"
                              title={`Chỉ mở check-in từ 15 phút trước giờ chơi (từ ${windowStart.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })})`}
                            >
                              <span>Khách Check-In</span>
                            </button>
                            <span className="text-[10px] text-slate-400 mt-0.5 font-medium">
                              Mở lúc {windowStart.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic bg-slate-100 px-2.5 py-1 rounded-lg">
                            Không check-in (Quá giờ)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {timeline.bookings.length === 0 && (
                  <div className="text-center py-10 text-slate-400 text-xs">
                    Chưa có ca đặt sân nào trong ngày {selectedDate}.
                  </div>
                )}
              </div>
              )}
            </div>

            {/* FORM ĐẶT VÉ SỰ KIỆN / GIẢI ĐẤU (EVENT) */}
            <form
              onSubmit={handleCreateStaffBooking}
              className="lg:col-span-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4 lg:sticky lg:top-4"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700 bg-purple-100 px-2.5 py-1 rounded-full">
                    🏆 Giải Đấu & Sự Kiện
                  </span>
                  <span className="text-[11px] text-slate-400 font-semibold">
                    Lễ tân / Quản lý
                  </span>
                </div>
                <h2 className="font-extrabold text-slate-900 text-base mt-2">Đặt Vé Sự Kiện / Giải Đấu</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Đặt đồng thời nhiều sân cho sự kiện. <strong>Đặt trên 3 sân tự động giảm 20% tổng tiền</strong>.
                </p>
              </div>

              {/* CHỌN CÁC SÂN SỰ KIỆN */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Chọn các Sân tổ chức Sự kiện:
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = timeline.courts.map((c) => c.id);
                      setStaffBooking((prev) => ({
                        ...prev,
                        courtIds: prev.courtIds?.length === allIds.length ? [] : allIds,
                      }));
                    }}
                    className="text-[11px] text-purple-700 hover:underline font-bold"
                  >
                    {staffBooking.courtIds?.length === timeline.courts.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả sân'}
                  </button>
                </div>

                <div className="space-y-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl max-h-48 overflow-y-auto">
                  {timeline.courts.map((c) => {
                    const isChecked = staffBooking.courtIds?.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition select-none ${
                          isChecked
                            ? 'bg-purple-50 border-purple-400 text-purple-950 font-bold shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked || false}
                          onChange={() => {
                            setStaffBooking((prev) => {
                              const exists = prev.courtIds?.includes(c.id);
                              const updated = exists
                                ? prev.courtIds.filter((id) => id !== c.id)
                                : [...(prev.courtIds || []), c.id];
                              return { ...prev, courtIds: updated };
                            });
                          }}
                          className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                        />
                        <span className="font-bold">{c.name}</span>
                        <span className="text-[10px] bg-slate-200/80 px-1.5 py-0.5 rounded ml-auto text-slate-700 font-semibold">
                          {c.type === 'VIP' ? 'Sân VIP' : 'Tiêu chuẩn'}
                        </span>
                      </label>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between mt-1.5 text-[11px]">
                  <span className="text-purple-900 font-bold">
                    Đã chọn: <strong>{staffBooking.courtIds?.length || 0}</strong>/{timeline.courts.length} sân
                  </span>
                  {staffBooking.courtIds?.length > 3 ? (
                    <span className="text-emerald-700 font-black bg-emerald-100 px-2 py-0.5 rounded-full animate-pulse">
                      🎉 Giảm 20% tổng tiền (trên 3 sân)
                    </span>
                  ) : (
                    <span className="text-slate-400">
                      (Chọn trên 3 sân để nhận giảm 20%)
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên Sự Kiện / Khách Tổ Chức</label>
                <input
                  type="text"
                  required
                  placeholder="Tên sự kiện hoặc giải đấu"
                  value={staffBooking.guestName}
                  onChange={(e) => setStaffBooking({ ...staffBooking, guestName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-700">Số điện thoại liên hệ</label>
                  {staffBooking.guestPhone.trim() && (
                    <span className={`text-[10px] font-bold ${isValidVNPhone(staffBooking.guestPhone) ? 'text-emerald-600' : 'text-red-500'}`}>
                      {isValidVNPhone(staffBooking.guestPhone) ? 'Hợp lệ (10 số)' : `${staffBooking.guestPhone.length}/10 số`}
                    </span>
                  )}
                </div>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="Số điện thoại khách hàng"
                  value={staffBooking.guestPhone}
                  onChange={(e) => setStaffBooking({ ...staffBooking, guestPhone: sanitizePhoneInput(e.target.value) })}
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs transition focus:bg-white focus:outline-none focus:ring-2 ${
                    staffBooking.guestPhone.trim()
                      ? isValidVNPhone(staffBooking.guestPhone)
                        ? 'border-emerald-500 focus:ring-emerald-500/20'
                        : 'border-red-400 focus:ring-red-400/20'
                      : 'border-slate-200 focus:ring-purple-500'
                  }`}
                />
                {staffBooking.guestPhone.trim() && !isValidVNPhone(staffBooking.guestPhone) && (
                  <p className="text-[11px] text-red-500 mt-1 leading-tight">
                    SĐT di động VN gồm 10 số (đầu 03, 05, 07, 08, 09).
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Giờ bắt đầu (24h)</label>
                  <TimeSelect24
                    value={staffBooking.startTime}
                    onChange={(e) => setStaffBooking({ ...staffBooking, startTime: e.target.value })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Giờ kết thúc (24h)</label>
                  <TimeSelect24
                    value={staffBooking.endTime}
                    onChange={(e) => setStaffBooking({ ...staffBooking, endTime: e.target.value })}
                    className="w-full"
                  />
                </div>
              </div>

              {/* BẢNG TÍNH TIỀN TỰ ĐỘNG THỜI GIAN THỰC */}
              {eventPricePreview && (
                <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-2xl text-xs space-y-1.5">
                  <div className="flex justify-between items-center text-slate-700 font-semibold">
                    <span>Tổng tiền gốc ({eventPricePreview.courtCount} sân x {eventPricePreview.totalHours}h):</span>
                    <span>{Number(eventPricePreview.originalPrice).toLocaleString()} đ</span>
                  </div>
                  {eventPricePreview.hasBulkDiscount && (
                    <div className="flex justify-between items-center text-emerald-700 font-bold">
                      <span>🎉 Ưu đãi đặt trên 3 sân (-20%):</span>
                      <span>-{Number(eventPricePreview.discountApplied).toLocaleString()} đ</span>
                    </div>
                  )}
                  <div className="border-t border-purple-200/80 pt-1.5 flex justify-between items-center font-extrabold text-sm text-purple-950">
                    <span>Tổng thanh toán hệ thống:</span>
                    <span className="text-emerald-700">{Number(eventPricePreview.finalPrice).toLocaleString()} đ</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Giá thỏa thuận riêng (Để trống = Tính tự động ở trên)</label>
                <input
                  type="number"
                  placeholder="Đơn giá (VNĐ)"
                  value={staffBooking.customPrice}
                  onChange={(e) => setStaffBooking({ ...staffBooking, customPrice: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <button className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold py-3.5 rounded-xl text-xs transition shadow-md flex items-center justify-center gap-2 active:scale-95">
                <span>🏆 Khởi Tạo Vé Sự Kiện ({staffBooking.courtIds?.length || 0} Sân)</span>
              </button>
            </form>
          </div>
        )}

        {/* TAB 2: HOÀN TIỀN */}
        {tab === 'REFUNDS' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
            <div>
              <h2 className="font-extrabold text-slate-900 text-base">
                Danh sách Khách hủy trước 24h chờ Hoàn tiền 100%
              </h2>
              <p className="text-xs text-slate-500">
                Lễ tân chuyển khoản theo thông tin ngân hàng bên dưới rồi bấm xác nhận hoàn tất.
              </p>
            </div>

            {refundRequests.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-400">
                Hiện không có yêu cầu hoàn tiền nào tồn đọng.
              </div>
            ) : (
              <div className="space-y-3">
                {refundRequests.map((r) => (
                  <div
                    key={r.id}
                    className="p-5 border border-red-200/80 bg-red-50/40 rounded-2xl flex flex-wrap justify-between items-center gap-4 text-xs"
                  >
                    <div className="space-y-1.5">
                      <div className="font-extrabold text-sm text-slate-900">
                        Đơn #{r.booking_code} — Khách: {r.customer_name} ({r.customer_phone})
                      </div>
                      <div className="text-slate-600">
                        Số tiền cần hoàn 100%: <strong className="text-red-600 text-base font-black">{Number(r.final_price).toLocaleString()} ₫</strong>
                      </div>
                      <div className="bg-white px-3.5 py-2 rounded-xl border border-red-200 font-bold text-slate-800 inline-block">
                        {r.refund_bank_name} • STK: <span className="font-mono text-emerald-700 select-all">{r.refund_account_number}</span> • Chủ TK: {r.refund_account_name}
                      </div>
                    </div>
                    <button
                      onClick={() => handleConfirmRefunded(r.id)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-bold transition shadow-sm"
                    >
                      Xác nhận đã chuyển khoản hoàn tiền
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: BÁN HÀNG POS & LỊCH SỬ ĐƠN HÀNG */}
        {tab === 'POS' && tenant.enable_pos_module && (
          <div className="space-y-6">
            <div className="grid lg:grid-cols-12 gap-6 items-start">
              {/* CỘT TRÁI: DANH MỤC SẢN PHẨM */}
              <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-4">
                {products.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    disabled={p.stock_quantity <= 0}
                    className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:border-emerald-500 disabled:opacity-50 text-left flex flex-col justify-between transition group"
                  >
                    <div>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-extrabold">
                        {p.category === 'DRINK' ? 'NƯỚC UỐNG' : p.category === 'SHUTTLECOCK' ? 'CẦU LÔNG' : p.category === 'RACKET_RENTAL' ? 'THUÊ VỢT' : 'PHỤ KIỆN'}
                      </span>
                      <h3 className="font-extrabold text-sm text-slate-900 mt-2.5 group-hover:text-emerald-700 transition">
                        {p.name}
                      </h3>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                      <strong className="text-emerald-700 text-sm font-black">{Number(p.price).toLocaleString()} ₫</strong>
                      <span className="text-slate-400 font-medium">Kho: {p.stock_quantity}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* CỘT PHẢI: GIỎ HÀNG POS TẠI QUẦY (ĐỀ XUẤT 1: XÓA 1 MÓN, NHẬP SỐ LƯỢNG TRỰC TIẾP) */}
              <div className="lg:col-span-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4 lg:sticky lg:top-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                    <span>Hóa đơn bán hàng tại quầy</span>
                    {cart.length > 0 && (
                      <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                        {cart.reduce((sum, item) => sum + item.quantity, 0)} món
                      </span>
                    )}
                  </h2>
                  {cart.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCart([])}
                      className="text-[11px] text-red-500 font-bold hover:underline"
                    >
                      Xóa toàn bộ
                    </button>
                  )}
                </div>

                {/* Danh sách món trong giỏ hàng */}
                <div className="space-y-2.5 text-xs max-h-72 overflow-y-auto pr-1">
                  {cart.length === 0 ? (
                    <p className="text-slate-400 text-center py-8">
                      Bấm vào sản phẩm bên trái để thêm vào hóa đơn.
                    </p>
                  ) : (
                    cart.map((c) => (
                      <div
                        key={c.productId}
                        className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl gap-2 border border-slate-100 hover:border-slate-200 transition"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 truncate" title={c.name}>{c.name}</p>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                            <span>{Number(c.price).toLocaleString()} ₫</span>
                            <span>•</span>
                            <span className="text-emerald-700 font-medium">Kho: {c.stock_quantity}</span>
                          </div>
                        </div>

                        {/* Bộ điều khiển số lượng: Nút - / Ô input / Nút + */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateCartQty(c.productId, -1)}
                            disabled={c.quantity <= 1}
                            className="w-7 h-7 rounded-lg bg-white border border-slate-200 font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center transition"
                            title="Giảm 1"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            max={c.stock_quantity}
                            value={c.quantity}
                            onChange={(e) => updateCartQtyDirect(c.productId, e.target.value)}
                            className="w-11 h-7 text-center font-black text-slate-800 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            title="Nhập trực tiếp số lượng"
                          />
                          <button
                            type="button"
                            onClick={() => updateCartQty(c.productId, 1)}
                            disabled={c.quantity >= c.stock_quantity}
                            className="w-7 h-7 rounded-lg bg-white border border-slate-200 font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center transition"
                            title="Tăng 1"
                          >
                            +
                          </button>
                        </div>

                        {/* Nút xóa 1 chạm */}
                        <button
                          type="button"
                          onClick={() => removeFromCart(c.productId)}
                          className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center text-xs transition border border-red-100 shrink-0"
                          title="Xóa món này khỏi giỏ"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-2.5 pt-1 pb-2 border-b border-slate-100">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Sân đang gọi đồ / Thanh toán:
                    </label>
                    <select
                      value={posCourtId}
                      onChange={(e) => setPosCourtId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Khách Mua Mang Về (Không gắn sân)</option>
                      {timeline.courts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.type === 'VIP' ? 'Sân VIP' : 'Tiêu chuẩn'})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Ghi chú đơn hàng (tùy chọn)"
                      value={posNote}
                      onChange={(e) => setPosNote(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-end pt-3 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase">Tổng cộng</span>
                  <span className="text-2xl font-black text-emerald-700">
                    {cart.reduce((sum, i) => sum + i.price * i.quantity, 0).toLocaleString()} ₫
                  </span>
                </div>

                <button
                  onClick={handleCheckoutPos}
                  disabled={cart.length === 0}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3.5 rounded-xl text-xs transition shadow-sm cursor-pointer"
                >
                  Thanh toán & Trừ Tồn Kho
                </button>
              </div>
            </div>

            {/* BẢNG LỊCH SỬ HÓA ĐƠN POS CA TRỰC & NÚT HỦY ĐƠN (ĐỀ XUẤT 3) */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-3">
                <div>
                  <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                    <span>Lịch sử Hóa đơn Bán hàng Ca Trực Hôm Nay</span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {posOrders.length} hóa đơn
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Quản lý hóa đơn bán lẻ tại quầy. Lễ tân được hủy hóa đơn sai trong vòng <strong>30 phút</strong> kể từ khi tạo (sau 30 phút hệ thống sẽ tự động khóa an toàn, chỉ Chủ sân mới được can thiệp).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadInitial}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  Làm mới danh sách
                </button>
              </div>

              {posOrders.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-400">
                  Chưa có hóa đơn bán lẻ nào được ghi nhận trong ca trực.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] font-black uppercase text-slate-400 bg-slate-50/50">
                        <th className="py-3 px-3">Mã Đơn / Giờ</th>
                        <th className="py-3 px-3">Gắn Sân / Khách</th>
                        <th className="py-3 px-3">Chi tiết món đã gọi</th>
                        <th className="py-3 px-3 text-right">Tổng Tiền</th>
                        <th className="py-3 px-3 text-center">Trạng Thái</th>
                        <th className="py-3 px-3 text-center">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {posOrders.map((order) => {
                        const isCancelled = order.status === 'CANCELLED';
                        const { isWithin30, remainingMinutes, diffMinutes } = getOrderTimeStatus(order.created_at);
                        const canCancel = !isCancelled && (user?.role === 'TENANT_ADMIN' || isWithin30);

                        return (
                          <tr
                            key={order.id}
                            className={`hover:bg-slate-50/80 transition ${isCancelled ? 'bg-red-50/25' : ''}`}
                          >
                            <td className="py-3 px-3">
                              <div className="font-mono font-bold text-slate-900">
                                #{order.id.slice(0, 8)}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {new Date(order.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} • {new Date(order.created_at).toLocaleDateString('vi-VN')}
                              </div>
                              <div className="text-[10px] text-slate-500 font-medium">
                                NV: {order.staff_name}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-800">
                                {order.court_name ? order.court_name : 'Mang về / Bán lẻ'}
                              </div>
                              {order.booking_code && (
                                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-mono">
                                  Vé #{order.booking_code}
                                </span>
                              )}
                              {order.note && (
                                <p className="text-[11px] text-slate-500 italic mt-0.5 truncate max-w-xs">
                                  "{order.note}"
                                </p>
                              )}
                            </td>
                            <td className="py-3 px-3 max-w-xs">
                              {order.items && order.items.length > 0 ? (
                                <div className="space-y-1">
                                  {order.items.map((it, idx) => (
                                    <div key={idx} className="flex justify-between text-slate-700 text-[11px] gap-2">
                                      <span className="truncate">{it.product_name} <strong className="text-slate-900">x{it.quantity}</strong></span>
                                      <span className="text-slate-500 font-mono shrink-0">{Number(it.total_item_price).toLocaleString()} ₫</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400">Hóa đơn dịch vụ</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <span className={`font-black text-sm ${isCancelled ? 'line-through text-slate-400' : 'text-emerald-700'}`}>
                                {Number(order.total_amount).toLocaleString()} ₫
                              </span>
                              <div className="text-[10px] text-slate-400">
                                {order.payment_method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center">
                              {isCancelled ? (
                                <div className="inline-flex flex-col items-center">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700 border border-red-200">
                                    Đã hủy & hoàn kho
                                  </span>
                                  {order.cancel_reason && (
                                    <span className="text-[10px] text-red-600 mt-0.5 italic max-w-[150px] truncate" title={order.cancel_reason}>
                                      {order.cancel_reason}
                                    </span>
                                  )}
                                  {order.cancelled_by_name && (
                                    <span className="text-[9px] text-slate-400">
                                      Bởi: {order.cancelled_by_name}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  Hoàn tất
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {isCancelled ? (
                                <span className="text-[11px] text-slate-400 italic">Đã hoàn kho</span>
                              ) : canCancel ? (
                                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditModal(order)}
                                    className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl font-bold text-[11px] transition inline-flex items-center gap-1 border border-sky-200 shadow-sm cursor-pointer"
                                    title={user?.role === 'STAFF' ? `Còn ${remainingMinutes} phút để sửa/hủy` : 'Chủ sân có quyền chỉnh sửa'}
                                  >
                                    <span>Sửa</span>
                                    {user?.role === 'STAFF' && (
                                      <span className="text-[9px] px-1 py-0.2 rounded bg-sky-200/70 text-sky-800 font-mono">
                                        {remainingMinutes}p
                                      </span>
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleOpenCancelModal(order)}
                                    className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-[11px] transition inline-flex items-center gap-1 border border-red-200 shadow-sm cursor-pointer"
                                    title={user?.role === 'STAFF' ? `Còn ${remainingMinutes} phút để sửa/hủy` : 'Chủ sân có quyền can thiệp hủy'}
                                  >
                                    <span>Hủy</span>
                                  </button>
                                </div>
                              ) : (
                                <div
                                  className="inline-flex flex-col items-center"
                                  title={`Đã quá 30 phút (${diffMinutes} phút trước). Khóa an toàn ngăn lễ tân tự sửa/hủy đơn, chỉ Chủ sân (Admin) mới có quyền xử lý.`}
                                >
                                  <span className="px-2 py-1 bg-slate-100 text-slate-400 rounded-xl font-semibold text-[10px] cursor-not-allowed flex items-center gap-1 border border-slate-200">
                                    <span>Đã khóa (&gt;30p)</span>
                                  </span>
                                  <span className="text-[9px] text-slate-400 mt-0.5">Cần Admin</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: CHỐT CA & BÀN GIAO */}
        {tab === 'SHIFTS' && (
          <ShiftHandoverSection tenant={tenant} staffUser={user} />
        )}
      </div>

      {/* MODAL GIA HẠN GIỜ CHƠI 1 CHẠM */}
      {extendModalBooking && (
        <ExtendBookingModal
          booking={extendModalBooking}
          tenant={tenant}
          onClose={() => setExtendModalBooking(null)}
          onSuccess={() => loadInitial()}
        />
      )}

      {/* MODAL CHI TIẾT CA CHƠI KHI BẤM TRÊN SƠ ĐỒ MA TRẬN */}
      {selectedGridBooking && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  Chi tiết ca chơi
                </span>
                <h3 className="font-black text-slate-900 text-base mt-1">
                  #{selectedGridBooking.booking_code}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedGridBooking(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center text-sm font-black transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-700">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Khách đặt:</span>
                <span className="font-bold text-slate-900">{selectedGridBooking.customer_name || selectedGridBooking.walk_in_guest_name || 'Khách đặt'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Số điện thoại:</span>
                <span className="font-bold text-slate-900 font-mono">{selectedGridBooking.customer_phone || selectedGridBooking.walk_in_guest_phone || '—'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Khung giờ:</span>
                <span className="font-black text-emerald-800">
                  {selectedGridBooking.start_time?.includes('T') ? new Date(selectedGridBooking.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : selectedGridBooking.start_time?.slice(0, 5)} – {selectedGridBooking.end_time?.includes('T') ? new Date(selectedGridBooking.end_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : selectedGridBooking.end_time?.slice(0, 5)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Tiền sân:</span>
                <span className="font-bold text-slate-900">{Number(selectedGridBooking.final_price).toLocaleString()} ₫</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 items-center">
                <span className="text-slate-500">Check-in:</span>
                <span className="font-bold">
                  {selectedGridBooking.is_checked_in || selectedGridBooking.checked_in_at ? (
                    <span className="text-emerald-700 font-black">✓ Đã Check-in</span>
                  ) : (
                    <span className="text-amber-600 font-bold">Chưa Check-in</span>
                  )}
                </span>
              </div>
            </div>

            {/* CÁC THAO TÁC NHANH */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const b = selectedGridBooking;
                  setSelectedGridBooking(null);
                  setExtendModalBooking(b);
                }}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs transition shadow-sm flex items-center justify-center gap-1.5"
              >
                <span>⏱ Gia hạn ca chơi (+30p / +1h)</span>
              </button>

              {!(selectedGridBooking.is_checked_in || selectedGridBooking.checked_in_at) && (
                <button
                  type="button"
                  onClick={() => {
                    handleOperation(selectedGridBooking.id, 'CHECK_IN');
                    setSelectedGridBooking(null);
                  }}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs transition shadow-sm"
                >
                  ✓ Xác nhận Khách Check-In
                </button>
              )}

              {selectedGridBooking.status !== 'COMPLETED' && (
                <button
                  type="button"
                  onClick={() => {
                    handleOperation(selectedGridBooking.id, 'COMPLETE');
                    setSelectedGridBooking(null);
                  }}
                  className="w-full py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 font-bold text-xs text-slate-700 transition"
                >
                  Đánh dấu hoàn tất ca chơi
                </button>
              )}
            </div>
          </div>
        </div>
      )}

            {/* MODAL QUÉT / NHẬP MÃ QR CHECK-IN NHANH 1 GIÂY (ĐỀ XUẤT 4) */}
      {showQuickCheckInModal && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    Quét / Nhập QR Check-in Nhanh
                  </h3>
                  <p className="text-xs text-slate-500">
                    Khách giơ mã QR trong Email hoặc đọc mã vé
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickCheckInModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm transition"
              >
                ✕
              </button>
            </div>

            {/* Thông báo kết quả check-in gần nhất */}
            {lastCheckInResult && (
              <div className="p-4 bg-emerald-50 border-2 border-emerald-400 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 font-black text-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                  Check-in thành công!
                </div>
                <div className="text-xs text-slate-700 grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Mã vé:</span>
                    <strong className="font-mono text-slate-900">#{lastCheckInResult.booking_code}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Sân thi đấu:</span>
                    <strong className="text-emerald-700">{lastCheckInResult.court_name || 'Sân tiêu chuẩn'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Khách hàng:</span>
                    <strong className="text-slate-800">{lastCheckInResult.customer_name || 'Khách đặt sân'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Giờ vào:</span>
                    <strong className="text-slate-800">{new Date(lastCheckInResult.checked_in_at || new Date()).toLocaleTimeString('vi-VN')}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Form nhập / quét mã */}
            <form onSubmit={handleQuickCheckIn} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Mã QR Hoặc Mã Đơn Đặt Sân
                </label>
                <div className="relative">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Nhập mã vé hoặc quét mã QR..."
                    value={qrInputCode}
                    onChange={(e) => setQrInputCode(e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 focus:border-emerald-500 focus:bg-white rounded-2xl text-sm font-mono font-bold text-slate-900 tracking-wider placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition"
                  />
                  {qrInputCode && (
                    <button
                      type="button"
                      onClick={() => setQrInputCode('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs px-2 py-1"
                    >
                      Xóa
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                  Hỗ trợ: Máy quét mã vạch/QR (tự động Enter), dán mã chuỗi <code className="bg-slate-100 px-1 py-0.5 rounded text-emerald-700">CHECKIN:...</code> hoặc gõ 6 chữ số mã vé.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickCheckInModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-xs transition"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={quickCheckInLoading || !qrInputCode.trim()}
                  className="flex-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-extrabold py-3 px-5 rounded-xl text-xs shadow-md shadow-emerald-500/25 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {quickCheckInLoading ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <span>Xác nhận Check-in (1s)</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CHỈNH SỬA HÓA ĐƠN POS (ĐỀ XUẤT SỬA ĐƠN & KHÓA 30 PHÚT) */}
      {showEditModal && orderToEdit && (() => {
        const newTotal = editItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const oldTotal = Number(orderToEdit.total_amount) || 0;
        const diffAmount = newTotal - oldTotal;

        // Lọc danh sách sản phẩm chưa có trong đơn hoặc còn hàng để thêm vào
        const availableProductsToAdd = products.filter(
          (p) => !editItems.some((it) => it.productId === p.id) && p.stock_quantity > 0
        );

        return (
          <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 relative space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
              {/* Header Modal */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Chỉnh Sửa Hóa Đơn
                    </h3>
                    <p className="text-xs text-slate-500">
                      Mã đơn #{orderToEdit.id.slice(0, 8)} • Tạo lúc {new Date(orderToEdit.created_at).toLocaleTimeString('vi-VN')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setOrderToEdit(null);
                  }}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm transition"
                >
                  ✕
                </button>
              </div>

              {/* Form nội dung sửa đơn (Cuộn được nếu danh sách dài) */}
              <form onSubmit={handleSaveEditOrder} className="space-y-4 overflow-y-auto pr-1 flex-1">
                {/* 1. Chọn sân gắn đơn & Ghi chú */}
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Gắn sân đang chơi:
                    </label>
                    <select
                      value={editCourtId}
                      onChange={(e) => setEditCourtId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="">Khách Mua Mang Về</option>
                      {timeline.courts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.type === 'VIP' ? 'Sân VIP' : 'Tiêu chuẩn'})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Ghi chú hóa đơn:
                    </label>
                    <input
                      type="text"
                      placeholder="Ghi chú đơn hàng (tùy chọn)"
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                {/* 2. Danh sách các món trong đơn */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black uppercase text-slate-500">
                      Danh sách mặt hàng ({editItems.length} món)
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Tự động hoàn/trừ chênh lệch kho
                    </span>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {editItems.map((item) => (
                      <div
                        key={item.productId}
                        className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl gap-2 border border-slate-200"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 truncate text-xs">{item.name}</p>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                            <span>{Number(item.price).toLocaleString()} ₫</span>
                            <span>•</span>
                            <span className="text-sky-700 font-medium">
                              Kho tối đa: {item.maxStock}
                            </span>
                          </div>
                        </div>

                        {/* Điều khiển số lượng */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateEditItemQty(item.productId, -1)}
                            disabled={item.quantity <= 1}
                            className="w-7 h-7 rounded-lg bg-white border border-slate-200 font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center transition"
                            title="Giảm 1"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            max={item.maxStock}
                            value={item.quantity}
                            onChange={(e) => updateEditItemQtyDirect(item.productId, e.target.value)}
                            className="w-12 h-7 text-center font-black text-slate-800 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                            title="Gõ số lượng trực tiếp"
                          />
                          <button
                            type="button"
                            onClick={() => updateEditItemQty(item.productId, 1)}
                            disabled={item.quantity >= item.maxStock}
                            className="w-7 h-7 rounded-lg bg-white border border-slate-200 font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center transition"
                            title="Tăng 1"
                          >
                            +
                          </button>
                        </div>

                        {/* Thành tiền món */}
                        <div className="text-right min-w-[70px]">
                          <span className="font-bold text-xs text-slate-900">
                            {(item.price * item.quantity).toLocaleString()} ₫
                          </span>
                        </div>

                        {/* Nút xóa món */}
                        <button
                          type="button"
                          onClick={() => removeEditItem(item.productId)}
                          disabled={editItems.length <= 1}
                          className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 disabled:opacity-30 flex items-center justify-center text-xs font-bold transition border border-red-100 shrink-0 cursor-pointer"
                          title={editItems.length <= 1 ? 'Đơn phải có ít nhất 1 món' : 'Xóa món này khỏi đơn'}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Thêm sản phẩm mới vào đơn */}
                  {availableProductsToAdd.length > 0 && (
                    <div className="pt-2">
                      <select
                        value={selectedAddProductId}
                        onChange={(e) => handleAddItemToEditOrder(e.target.value)}
                        className="w-full px-3 py-2 bg-sky-50/50 border border-sky-200 rounded-xl text-xs font-semibold text-sky-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        <option value="">+ Thêm mặt hàng khác vào hóa đơn...</option>
                        {availableProductsToAdd.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({Number(p.price).toLocaleString()} ₫ — Còn kho: {p.stock_quantity})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* 3. Bảng đối soát chênh lệch tổng tiền */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1.5">
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Tổng tiền ban đầu:</span>
                    <span className="font-semibold">{oldTotal.toLocaleString()} ₫</span>
                  </div>
                  <div className="flex justify-between items-center font-bold text-slate-900">
                    <span>Tổng tiền sau điều chỉnh:</span>
                    <span className="text-base text-emerald-700 font-black">{newTotal.toLocaleString()} ₫</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                    <span className="font-semibold text-slate-700">Chênh lệch thanh toán:</span>
                    {diffAmount > 0 ? (
                      <span className="font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                        +{diffAmount.toLocaleString()} ₫ (Thu thêm từ khách)
                      </span>
                    ) : diffAmount < 0 ? (
                      <span className="font-black text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                        -{Math.abs(diffAmount).toLocaleString()} ₫ (Hoàn trả lại khách)
                      </span>
                    ) : (
                      <span className="font-bold text-slate-500">0 ₫ (Không thay đổi tổng tiền)</span>
                    )}
                  </div>
                </div>

                {/* Footer buttons */}
                <div className="flex items-center gap-3 pt-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setOrderToEdit(null);
                    }}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={editingOrder || editItems.length === 0}
                    className="flex-1 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-extrabold py-2.5 rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {editingOrder ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      'Lưu Thay Đổi Hóa Đơn'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* MODAL XÁC NHẬN HỦY HÓA ĐƠN POS & TỰ ĐỘNG HOÀN TRẢ KHO (ĐỀ XUẤT 3) */}
      {showCancelModal && orderToCancel && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Xác nhận Hủy Hóa Đơn
                  </h3>
                  <p className="text-xs text-slate-500">
                    Đơn #{orderToCancel.id.slice(0, 8)} • Tạo lúc {new Date(orderToCancel.created_at).toLocaleTimeString('vi-VN')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCancelModal(false);
                  setOrderToCancel(null);
                }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm transition"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5">
                <span>Tự động hoàn trả tồn kho:</span>
              </div>
              <ul className="list-disc pl-5 text-[11px] text-amber-800 space-y-0.5">
                {orderToCancel.items && orderToCancel.items.length > 0 ? (
                  orderToCancel.items.map((it, idx) => (
                    <li key={idx}>
                      Hoàn trả <strong>+{it.quantity}</strong> {it.product_name} vào kho hàng
                    </li>
                  ))
                ) : (
                  <li>Tự động cập nhật lại kho hàng theo đơn</li>
                )}
              </ul>
              <p className="text-[11px] text-amber-700 pt-1 border-t border-amber-200/60 font-semibold">
                Doanh thu <strong>{Number(orderToCancel.total_amount).toLocaleString()} ₫</strong> của đơn này sẽ được tự động trừ khỏi tổng kết doanh thu ca trực.
              </p>
            </div>

            <form onSubmit={handleConfirmCancelOrder} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Lý do hủy hóa đơn <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Lý do hủy đơn..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCancelModal(false);
                    setOrderToCancel(null);
                  }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
                >
                  Đóng / Giữ lại đơn
                </button>
                <button
                  type="submit"
                  disabled={cancelling}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-extrabold py-2.5 rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {cancelling ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    'Xác nhận Hủy Đơn'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}