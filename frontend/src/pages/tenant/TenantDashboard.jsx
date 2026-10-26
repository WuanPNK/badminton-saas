import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';
import RevenueCharts from '../../components/tenant/RevenueCharts';
import TimeSelect24, { formatTime24 } from '../../components/common/TimeSelect24';
import ExpandableAddButton from '../../components/common/ExpandableAddButton';

// Danh mục phân loại mặt hàng POS (100% Tiếng Việt)
export const POS_CATEGORIES = [
  { value: 'DRINK', label: 'Nước uống', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'SHUTTLECOCK', label: 'Cầu lông', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'RACKET_RENTAL', label: 'Thuê vợt', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'GRIP', label: 'Quấn cán', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { value: 'STRING', label: 'Cước vợt', color: 'bg-pink-100 text-pink-800 border-pink-200' },
  { value: 'PROTECTION', label: 'Băng gối / Bảo hộ', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { value: 'MEDICAL', label: 'Salonpas / Y tế', color: 'bg-red-100 text-red-800 border-red-200' },
  { value: 'ACCESSORY', label: 'Phụ kiện khác', color: 'bg-slate-100 text-slate-800 border-slate-200' },
];

export default function TenantDashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  // Mặc định đăng nhập vào sẽ mở HUB / BẢNG ĐIỀU KHIỂN TRUNG TÂM (như Ảnh 2)
  const [tab, setTab] = useState('HUB');

  const [tenant, setTenant] = useState(null);
  const [courts, setCourts] = useState([]);
  const [pricingRules, setPricingRules] = useState([]);
  const [products, setProducts] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [reviewsData, setReviewsData] = useState({ reviews: [], stats: {} });

  // Quản lý Gói cước SaaS của Cụm sân
  const [subData, setSubData] = useState({
    currentSubscription: null,
    pendingSubscription: null,
    history: [],
  });
  const [availablePlans, setAvailablePlans] = useState([]);
  const [checkoutModal, setCheckoutModal] = useState({
    isOpen: false,
    plan: null,
    billingCycle: 'MONTHLY',
    transactionCode: '',
    paymentProofNote: '',
    refundBankName: '',
    refundAccountNumber: '',
    refundAccountName: '',
  });

  // Form states cho Thêm mới
  const [newCourt, setNewCourt] = useState({ name: '', type: 'STANDARD' });
  const [newRule, setNewRule] = useState({
    courtType: 'STANDARD',
    startTime: '17:00',
    endTime: '22:00',
    pricePerHour: 120000,
  });
  const [newProduct, setNewProduct] = useState({
    name: '',
    category: 'DRINK',
    price: 15000,
    stockQuantity: 50,
  });
  const [newStaff, setNewStaff] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  // Modal Sửa (Edit Modals)
  const [editingCourt, setEditingCourt] = useState(null);
  const [editingRule, setEditingRule] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingStaff, setEditingStaff] = useState(null);

  // Modal Thêm Sân Mới (Popup mở từ nút "+" ở danh sách sân)
  const [showAddCourtModal, setShowAddCourtModal] = useState(false);
  const [showAddPricingModal, setShowAddPricingModal] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);

  // Popup Xác nhận Tùy biến Hiện đại (Thay thế window.confirm mặc định của trình duyệt)
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Xác nhận',
    cancelText: 'Hủy bỏ',
    confirmColor: 'emerald', // 'red' | 'emerald' | 'amber'
    icon: '⚠️',
    onConfirm: null,
  });

  const askConfirm = ({
    title,
    message,
    confirmText = 'Xác nhận',
    cancelText = 'Hủy bỏ',
    confirmColor = 'emerald',
    icon = '⚠️',
    onConfirm,
  }) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      confirmText,
      cancelText,
      confirmColor,
      icon,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        if (onConfirm) await onConfirm();
      },
    });
  };

  // Modal Lên lịch Bảo trì Sân (Chuẩn 24 Giờ)
  const [maintenanceModalCourt, setMaintenanceModalCourt] = useState(null);
  const [maintScheduleMode, setMaintScheduleMode] = useState('NOW'); // 'NOW' hoặc 'SCHEDULE'
  const [maintStartDate, setMaintStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [maintStartTime, setMaintStartTime] = useState('08:00');
  const [maintNote, setMaintNote] = useState('Bảo trì định kỳ mặt sân & hệ thống đèn');


  // Quản lý Điều khoản, Mô tả & Hình ảnh sân (CRUD)
  const [venueImages, setVenueImages] = useState([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [editingImageIdx, setEditingImageIdx] = useState(null);
  const [editingImageUrl, setEditingImageUrl] = useState('');
  const [previewModalImage, setPreviewModalImage] = useState(null);

  const [venueRules, setVenueRules] = useState([]);
  const [newRuleText, setNewRuleText] = useState('');
  const [editingRuleIdx, setEditingRuleIdx] = useState(null);
  const [editingRuleContent, setEditingRuleContent] = useState('');
  const [venueDescription, setVenueDescription] = useState('');

  const fetchTenantData = async () => {
    try {
      const [setRes, courtRes, ruleRes, staffRes, anaRes, revRes, subRes, plansRes] = await Promise.all([
        axiosClient.get('/tenant/my-settings'),
        axiosClient.get('/tenant/courts'),
        axiosClient.get('/tenant/pricing-rules'),
        axiosClient.get('/tenant/staff'),
        axiosClient.get('/pos/analytics'),
        axiosClient.get('/tenant/reviews').catch(() => ({ data: { reviews: [], stats: {} } })),
        axiosClient.get('/tenant/subscription/my-subscription').catch(() => ({ data: { currentSubscription: null, pendingSubscription: null, history: [] } })),
        axiosClient.get('/tenant/subscription/plans').catch(() => ({ data: { plans: [] } })),
      ]);

      setTenant(setRes.data.tenant);
      setCourts(courtRes.data.courts);
      setPricingRules(ruleRes.data.pricingRules);
      setStaffList(staffRes.data.staffList);
      setAnalytics(anaRes.data);
      setReviewsData(revRes.data);

      if (subRes.data) {
        setSubData({
          currentSubscription: subRes.data.currentSubscription || null,
          pendingSubscription: subRes.data.pendingSubscription || null,
          history: subRes.data.history || [],
        });
      }
      if (plansRes.data?.plans) {
        setAvailablePlans(plansRes.data.plans);
      }

      setVenueImages(setRes.data.tenant.images || [
        'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1521537634581-0dced2fee2ef?auto=format&fit=crop&w=900&q=80'
      ]);
      setVenueRules(setRes.data.tenant.rules || [
        'Vui lòng mang giày thể thao chuyên dụng hoặc không để lại vết đen trên mặt thảm.',
        'Có mặt trước giờ đặt 5–10 phút để làm thủ tục Check-in tại quầy Lễ tân.',
        'Quy định Hủy lịch & Hoàn tiền: Hoàn lại 100% tiền sân khi thao tác hủy trước giờ chơi ít nhất 24 tiếng.',
        'Không hút thuốc lá và xả rác trong khu vực thảm thi đấu.'
      ]);
      setVenueDescription(setRes.data.tenant.description || '');

      if (setRes.data.tenant.enable_pos_module) {
        const prodRes = await axiosClient.get('/pos/products');
        setProducts(prodRes.data.products);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTenantData();
  }, []);

  // --- 1. XỬ LÝ CẤU HÌNH & TÍNH NĂNG ---
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      const res = await axiosClient.put('/tenant/my-settings', {
        name: tenant.name,
        district: tenant.district,
        address: tenant.address,
        phoneContact: tenant.phone_contact,
        enableVipCourts: tenant.enable_vip_courts,
        enablePosModule: tenant.enable_pos_module,
        enableAdvancedAnalytics: tenant.enable_advanced_analytics,
        studentDiscountType: tenant.student_discount_type,
        studentDiscountValue: tenant.student_discount_value,
        qrBankName: tenant.qr_bank_name,
        qrAccountNumber: tenant.qr_account_number,
        qrAccountName: tenant.qr_account_name,
      });
      toast.success(res.data.message);
      fetchTenantData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi lưu cấu hình.');
    }
  };

  // --- 2. XỬ LÝ SÂN (CRUD & BẢO TRÌ) ---
  const handleOpenAddCourt = () => {
    if (!subData.currentSubscription) {
      toast.error('Bạn cần đăng ký gói cước SaaS và được Super Admin phê duyệt trước khi tạo sân!');
      setTab('SUBSCRIPTION');
      return;
    }
    const maxCourts = Number(subData.currentSubscription.max_courts) || 0;
    if (courts.length >= maxCourts) {
      toast.error(
        `Gói cước "${subData.currentSubscription.plan_name}" của bạn chỉ cho phép quản lý tối đa ${maxCourts} sân. Vui lòng nâng cấp gói cước cao hơn!`
      );
      setTab('SUBSCRIPTION');
      return;
    }
    setShowAddCourtModal(true);
  };

  const triggerCreateCourt = (e) => {
    e.preventDefault();
    if (!newCourt.name.trim()) {
      toast.error('Vui lòng nhập tên sân.');
      return;
    }

    if (!subData.currentSubscription) {
      toast.error('Bạn cần đăng ký gói cước SaaS và được phê duyệt trước khi tạo sân!');
      setTab('SUBSCRIPTION');
      return;
    }

    const maxCourts = Number(subData.currentSubscription.max_courts) || 0;
    if (courts.length >= maxCourts) {
      toast.error(
        `Gói cước "${subData.currentSubscription.plan_name}" của bạn chỉ cho phép quản lý tối đa ${maxCourts} sân. Vui lòng nâng cấp gói!`
      );
      setTab('SUBSCRIPTION');
      return;
    }

    askConfirm({
      title: 'Xác nhận Thêm Sân Mới',
      message: `Bạn có chắc chắn muốn thêm sân "${newCourt.name}" (${newCourt.type}) vào cụm sân?`,
      confirmText: 'Thêm sân',
      confirmColor: 'emerald',
      icon: '🏸',
      onConfirm: async () => {
        try {
          const res = await axiosClient.post('/tenant/courts', newCourt);
          toast.success(res.data.message);
          setNewCourt({ name: '', type: 'STANDARD' });
          setShowAddCourtModal(false);
          fetchTenantData();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Lỗi tạo sân.');
        }
      },
    });
  };


  const triggerUpdateCourt = (e) => {
    e.preventDefault();
    if (!editingCourt) return;
    askConfirm({
      title: 'Xác nhận Lưu thay đổi Sân',
      message: `Lưu các cập nhật cho sân "${editingCourt.name}"?`,
      confirmText: 'Lưu thay đổi',
      confirmColor: 'emerald',
      icon: '✏️',
      onConfirm: async () => {
        try {
          const res = await axiosClient.put(`/tenant/courts/${editingCourt.id}`, {
            name: editingCourt.name,
            type: editingCourt.type,
          });
          toast.success(res.data.message);
          setEditingCourt(null);
          fetchTenantData();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Lỗi cập nhật sân.');
        }
      },
    });
  };

  const handleDeleteCourt = (court) => {
    askConfirm({
      title: 'Xác nhận Xóa Sân',
      message: `Bạn có chắc chắn muốn xóa sân "${court.name}" khỏi cụm sân? Thao tác này sẽ xóa sân khỏi hệ thống.`,
      confirmText: 'Xóa sân này',
      confirmColor: 'red',
      icon: '🗑️',
      onConfirm: async () => {
        try {
          const res = await axiosClient.delete(`/tenant/courts/${court.id}`);
          toast.success(res.data.message);
          fetchTenantData();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Lỗi xóa sân.');
        }
      },
    });
  };

  const openMaintenanceModal = (court) => {
    setMaintenanceModalCourt(court);
    setMaintScheduleMode('NOW');
    const now = new Date();
    setMaintStartDate(now.toISOString().split('T')[0]);
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = now.getMinutes() < 30 ? '00' : '30';
    setMaintStartTime(`${hh}:${mm}`);
    setMaintNote('Bảo trì định kỳ mặt sân & hệ thống đèn');
  };

  const triggerSaveMaintenance = (e) => {
    e.preventDefault();
    if (!maintenanceModalCourt) return;
    askConfirm({
      title: 'Xác nhận Đặt lịch Bảo trì',
      message: `Đưa sân "${maintenanceModalCourt.name}" vào trạng thái bảo trì? Khách hàng sẽ không thể đặt khung giờ này.`,
      confirmText: 'Xác nhận bảo trì',
      confirmColor: 'amber',
      icon: '🔧',
      onConfirm: async () => {
        try {
          const maintenanceStart =
            maintScheduleMode === 'SCHEDULE'
              ? `${maintStartDate}T${maintStartTime}:00`
              : new Date().toISOString();

          const payload = {
            isUnderMaintenance: true,
            maintenanceStart,
            maintenanceNote: maintNote,
          };
          const res = await axiosClient.put(
            `/tenant/courts/${maintenanceModalCourt.id}/maintenance`,
            payload
          );
          toast.success(res.data.message);
          setMaintenanceModalCourt(null);
          fetchTenantData();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Lỗi khi lên lịch bảo trì.');
        }
      },
    });
  };


  const triggerEndMaintenance = (court) => {
    askConfirm({
      title: 'Hoàn tất Bảo trì & Mở sân',
      message: `Xác nhận mở lại sân "${court.name}" để khách hàng có thể tiếp tục đặt lịch?`,
      confirmText: 'Mở lại sân',
      confirmColor: 'emerald',
      icon: '✅',
      onConfirm: async () => {
        try {
          const res = await axiosClient.put(`/tenant/courts/${court.id}/maintenance`, {
            isUnderMaintenance: false,
          });
          toast.success(res.data.message);
          fetchTenantData();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Lỗi kết thúc bảo trì.');
        }
      },
    });
  };

  // --- 3. XỬ LÝ KHUNG GIÁ ĐỘNG (CRUD) ---
  const triggerCreatePricingRule = (e) => {
    e.preventDefault();
    askConfirm({
      title: 'Xác nhận Thêm Khung giá',
      message: `Thêm khung giá ${Number(newRule.pricePerHour).toLocaleString()} ₫/h (${formatTime24(newRule.startTime)} → ${formatTime24(newRule.endTime)}) cho sân ${newRule.courtType}?`,
      confirmText: 'Thêm khung giá',
      confirmColor: 'emerald',
      icon: '💰',
      onConfirm: async () => {
        try {
          await axiosClient.post('/tenant/pricing-rules', {
            ...newRule,
            daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
          });
          toast.success('Đã thêm khung giá động thành công!');
          setShowAddPricingModal(false);
          fetchTenantData();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Lỗi thêm giá động.');
        }
      },
    });
  };

  const triggerUpdatePricingRule = (e) => {
    e.preventDefault();
    if (!editingRule) return;
    askConfirm({
      title: 'Xác nhận Lưu Khung giá',
      message: `Lưu thay đổi khung giá ${Number(editingRule.price_per_hour).toLocaleString()} ₫/h (${formatTime24(editingRule.start_time)} → ${formatTime24(editingRule.end_time)})?`,
      confirmText: 'Lưu thay đổi',
      confirmColor: 'emerald',
      icon: '✏️',
      onConfirm: async () => {
        try {
          await axiosClient.put(`/tenant/pricing-rules/${editingRule.id}`, {
            courtType: editingRule.court_type,
            startTime: editingRule.start_time,
            endTime: editingRule.end_time,
            pricePerHour: editingRule.price_per_hour,
            daysOfWeek: editingRule.days_of_week || [1, 2, 3, 4, 5, 6, 7],
          });
          toast.success('Đã cập nhật khung giá thành công!');
          setEditingRule(null);
          fetchTenantData();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Lỗi cập nhật khung giá.');
        }
      },
    });
  };

  const handleDeletePricingRule = (rule) => {
    askConfirm({
      title: 'Xác nhận Xóa Khung giá',
      message: `Bạn có chắc chắn muốn xóa khung giá (${formatTime24(rule.start_time)} → ${formatTime24(rule.end_time)}) của sân ${rule.court_type}?`,
      confirmText: 'Xóa khung giá',
      confirmColor: 'red',
      icon: '🗑️',
      onConfirm: async () => {
        try {
          await axiosClient.delete(`/tenant/pricing-rules/${rule.id}`);
          toast.success('Đã xóa khung giá.');
          fetchTenantData();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Lỗi xóa khung giá.');
        }
      },
    });
  };

  // --- 4. XỬ LÝ KHO HÀNG POS (CRUD) ---
  const triggerCreateProduct = (e) => {
    e.preventDefault();
    if (!newProduct.name.trim()) return;
    askConfirm({
      title: 'Xác nhận Thêm vào Kho POS',
      message: `Thêm mặt hàng "${newProduct.name}" (Đơn giá: ${Number(newProduct.price).toLocaleString()} ₫, Tồn kho: ${newProduct.stockQuantity}) vào kho?`,
      confirmText: 'Thêm vào kho',
      confirmColor: 'emerald',
      icon: '📦',
      onConfirm: async () => {
        try {
          await axiosClient.post('/pos/products', newProduct);
          toast.success('Đã thêm sản phẩm vào kho POS!');
          setShowAddProductModal(false);
          setNewProduct({ name: '', category: 'DRINK', price: 15000, stockQuantity: 50 });
          fetchTenantData();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Lỗi thêm sản phẩm.');
        }
      },
    });
  };

  const triggerUpdateProduct = (e) => {
    e.preventDefault();
    if (!editingProduct) return;
    askConfirm({
      title: 'Xác nhận Lưu thay đổi Mặt hàng',
      message: `Lưu các thay đổi cho mặt hàng "${editingProduct.name}"?`,
      confirmText: 'Lưu thay đổi',
      confirmColor: 'emerald',
      icon: '✏️',
      onConfirm: async () => {
        try {
          await axiosClient.put(`/pos/products/${editingProduct.id}`, {
            name: editingProduct.name,
            category: editingProduct.category,
            price: Number(editingProduct.price),
            stockQuantity: Number(editingProduct.stock_quantity),
          });
          toast.success('Đã cập nhật sản phẩm thành công!');
          setEditingProduct(null);
          fetchTenantData();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Lỗi cập nhật sản phẩm.');
        }
      },
    });
  };

  const handleDeleteProduct = (prod) => {
    askConfirm({
      title: 'Xác nhận Xóa Mặt hàng',
      message: `Bạn có chắc chắn muốn xóa mặt hàng "${prod.name}" khỏi kho POS?`,
      confirmText: 'Xóa mặt hàng',
      confirmColor: 'red',
      icon: '🗑️',
      onConfirm: async () => {
        try {
          const res = await axiosClient.delete(`/pos/products/${prod.id}`);
          toast.success(res.data.message);
          fetchTenantData();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Lỗi xóa sản phẩm.');
        }
      },
    });
  };

  // --- 5. XỬ LÝ TÀI KHOẢN LỄ TÂN (CRUD VỚI XÁC NHẬN MẬT KHẨU) ---
  const triggerCreateStaff = (e) => {
    e.preventDefault();
    if (newStaff.password !== newStaff.confirmPassword) {
      toast.error('Mật khẩu và xác nhận mật khẩu không khớp!');
      return;
    }
    if (newStaff.password.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    askConfirm({
      title: 'Xác nhận Cấp tài khoản Lễ tân',
      message: `Cấp tài khoản lễ tân mới cho "${newStaff.fullName}" (${newStaff.email})?`,
      confirmText: 'Cấp tài khoản',
      confirmColor: 'emerald',
      icon: '👤',
      onConfirm: async () => {
        try {
          const res = await axiosClient.post('/tenant/staff', {
            fullName: newStaff.fullName,
            email: newStaff.email,
            phone: newStaff.phone,
            password: newStaff.password,
          });
          toast.success(res.data.message);
          setShowAddStaffModal(false);
          setNewStaff({ fullName: '', email: '', phone: '', password: '', confirmPassword: '' });
          fetchTenantData();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Lỗi tạo nhân viên.');
        }
      },
    });
  };

  const triggerUpdateStaff = (e) => {
    e.preventDefault();
    if (!editingStaff) return;

    if (editingStaff.newPassword) {
      if (editingStaff.newPassword !== editingStaff.confirmNewPassword) {
        toast.error('Mật khẩu mới và xác nhận mật khẩu không khớp!');
        return;
      }
      if (editingStaff.newPassword.length < 6) {
        toast.error('Mật khẩu mới phải có ít nhất 6 ký tự.');
        return;
      }
    }

    askConfirm({
      title: 'Xác nhận Cập nhật Lễ tân',
      message: `Lưu thay đổi thông tin cho nhân viên "${editingStaff.full_name}"?`,
      confirmText: 'Lưu thay đổi',
      confirmColor: 'emerald',
      icon: '✏️',
      onConfirm: async () => {
        try {
          const res = await axiosClient.put(`/tenant/staff/${editingStaff.id}`, {
            fullName: editingStaff.full_name,
            phone: editingStaff.phone,
            password: editingStaff.newPassword || undefined,
            isActive: editingStaff.is_active,
          });
          toast.success(res.data.message);
          setEditingStaff(null);
          fetchTenantData();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Lỗi cập nhật nhân viên.');
        }
      },
    });
  };

  const handleDeleteStaff = (staff) => {
    askConfirm({
      title: 'Xác nhận Xóa / Khóa Lễ tân',
      message: `Bạn có chắc chắn muốn xóa hoặc vô hiệu hóa tài khoản của lễ tân "${staff.full_name}"?`,
      confirmText: 'Xóa tài khoản',
      confirmColor: 'red',
      icon: '🗑️',
      onConfirm: async () => {
        try {
          const res = await axiosClient.delete(`/tenant/staff/${staff.id}`);
          toast.success(res.data.message);
          fetchTenantData();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Lỗi xóa nhân viên.');
        }
      },
    });
  };

  // --- 6. XỬ LÝ ĐIỀU KHOẢN, NỘI QUY & THƯ VIỆN ẢNH SÂN (CRUD) ---
  const handleAddImage = () => {
    if (!newImageUrl.trim()) {
      toast.error('Vui lòng nhập link ảnh hợp lệ (https://...)');
      return;
    }
    setVenueImages([...venueImages, newImageUrl.trim()]);
    setNewImageUrl('');
    toast.success('Đã thêm ảnh vào danh sách! Bấm "Lưu thay đổi" để đồng bộ.');
  };

  const handleSetCoverImage = (index) => {
    if (index === 0) return;
    const target = venueImages[index];
    const filtered = venueImages.filter((_, i) => i !== index);
    setVenueImages([target, ...filtered]);
    toast.success('Đã đặt làm ảnh bìa chính (Cover)!');
  };

  const handleStartEditImage = (index) => {
    setEditingImageIdx(index);
    setEditingImageUrl(venueImages[index]);
  };

  const handleSaveEditImage = () => {
    if (!editingImageUrl.trim()) {
      toast.error('Đường link ảnh không được để trống.');
      return;
    }
    const updated = [...venueImages];
    updated[editingImageIdx] = editingImageUrl.trim();
    setVenueImages(updated);
    setEditingImageIdx(null);
    setEditingImageUrl('');
    toast.success('Đã cập nhật link ảnh thành công!');
  };

  const handleRemoveImage = (index) => {
    askConfirm({
      title: 'Xác nhận Xóa Ảnh',
      message: 'Bạn có chắc chắn muốn xóa ảnh này khỏi thư viện hiển thị của cụm sân?',
      confirmText: 'Xóa ảnh này',
      confirmColor: 'red',
      icon: '🗑️',
      onConfirm: () => {
        setVenueImages(venueImages.filter((_, i) => i !== index));
        toast.success('Đã xóa ảnh khỏi danh sách!');
      },
    });
  };

  const handleAddRule = () => {
    if (!newRuleText.trim()) {
      toast.error('Vui lòng nhập nội dung điều khoản / quy định.');
      return;
    }
    setVenueRules([...venueRules, newRuleText.trim()]);
    setNewRuleText('');
    toast.success('Đã thêm quy định mới! Bấm "Lưu thay đổi" để đồng bộ.');
  };

  const handleStartEditRule = (index) => {
    setEditingRuleIdx(index);
    setEditingRuleContent(venueRules[index]);
  };

  const handleSaveEditRule = () => {
    if (!editingRuleContent.trim()) {
      toast.error('Nội dung điều khoản không được để trống.');
      return;
    }
    const updated = [...venueRules];
    updated[editingRuleIdx] = editingRuleContent.trim();
    setVenueRules(updated);
    setEditingRuleIdx(null);
    setEditingRuleContent('');
    toast.success('Đã cập nhật nội dung điều khoản!');
  };

  const handleRemoveRule = (index) => {
    askConfirm({
      title: 'Xác nhận Xóa Điều Khoản',
      message: 'Bạn có chắc chắn muốn xóa điều khoản này khỏi nội quy của cụm sân?',
      confirmText: 'Xóa điều khoản',
      confirmColor: 'red',
      icon: '🗑️',
      onConfirm: () => {
        setVenueRules(venueRules.filter((_, i) => i !== index));
        toast.success('Đã xóa điều khoản!');
      },
    });
  };

  const handleSaveVenueDetails = async (e) => {
    e.preventDefault();
    try {
      const res = await axiosClient.put('/tenant/venue-details', {
        name: tenant.name,
        district: tenant.district,
        address: tenant.address,
        phoneContact: tenant.phone_contact,
        description: venueDescription,
        images: venueImages,
        rules: venueRules,
      });
      toast.success(res.data.message);
      fetchTenantData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi lưu điều khoản và hình ảnh.');
    }
  };

  // --- 7. XỬ LÝ GÓI CƯỚC SAAS CỦA CHỦ SÂN ---
  const openCheckoutModal = (plan) => {
    setCheckoutModal({
      isOpen: true,
      plan,
      billingCycle: 'MONTHLY',
      transactionCode: '',
      paymentProofNote: '',
      refundBankName: tenant?.qr_bank_name || '',
      refundAccountNumber: tenant?.qr_account_number || '',
      refundAccountName: tenant?.qr_account_name || '',
    });
  };

  const calculateTotalAmount = (plan, billingCycle) => {
    if (!plan) return 0;
    const monthly = Number(plan.price_per_month);
    if (monthly === 0) return 0;
    if (billingCycle === '6_MONTHS') return Math.round(monthly * 6 * 0.9);
    if (billingCycle === 'YEARLY') return Math.round(monthly * 12 * 0.8);
    return monthly;
  };

  const handleSubmitSubscriptionRequest = async (e) => {
    e.preventDefault();
    if (!checkoutModal.plan) return;

    const total = calculateTotalAmount(checkoutModal.plan, checkoutModal.billingCycle);
    if (total > 0 && !checkoutModal.transactionCode.trim()) {
      toast.error('Vui lòng nhập Mã giao dịch chuyển khoản VietQR để Super Admin đối soát.');
      return;
    }

    if (total > 0 && (!checkoutModal.refundAccountNumber.trim() || !checkoutModal.refundBankName.trim())) {
      toast.error('Vui lòng điền thông tin tài khoản ngân hàng nhận hoàn tiền.');
      return;
    }

    try {
      const res = await axiosClient.post('/tenant/subscription/request', {
        planId: checkoutModal.plan.id,
        billingCycle: checkoutModal.billingCycle,
        transactionCode: checkoutModal.transactionCode.trim(),
        paymentProofNote: checkoutModal.paymentProofNote.trim(),
        refundBankName: checkoutModal.refundBankName.trim(),
        refundAccountNumber: checkoutModal.refundAccountNumber.trim(),
        refundAccountName: checkoutModal.refundAccountName.trim(),
      });

      toast.success(res.data.message);
      setCheckoutModal((prev) => ({ ...prev, isOpen: false }));
      fetchTenantData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi gửi yêu cầu đăng ký gói cước.');
    }
  };

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Kiểm tra gói cước hiện tại
  const hasPlan = Boolean(subData.currentSubscription);
  const canUsePos = Boolean(subData.currentSubscription && Number(subData.currentSubscription.price_per_month) >= 199000);

  // Danh sách các Menu Tabs (Đã loại bỏ tab Hub trùng lặp, dùng nút Back ở Header)
  const TAB_ITEMS = [
    { id: 'COURTS', label: '🏸 Quản lý Sân & Bảo trì', show: true },
    {
      id: 'SUBSCRIPTION',
      label: hasPlan ? '⚡ Gói Cước SaaS' : '⚡ Gói Cước SaaS (!)',
      show: true,
    },
    { id: 'PRICING_RULES', label: '💰 Bảng Giá Động', show: true },
    { id: 'POS_INVENTORY', label: '📦 Kho hàng POS', show: canUsePos && tenant.enable_pos_module },
    { id: 'STAFF', label: '👥 Tài khoản Lễ tân', show: true },
    { id: 'REVIEWS', label: '⭐ Xem đánh giá', show: true },
    { id: 'VENUE_DETAILS', label: '📝 Mô tả', show: true },
    { id: 'ANALYTICS', label: '📊 Báo cáo Doanh thu', show: true },
    { id: 'SETTINGS', label: '⚙️ Cấu hình Cụm sân & VietQR', show: true },
  ];


  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      {/* HEADER CHỦ SÂN */}
      <header className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-slate-900 text-white px-6 py-4 shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            {tab !== 'HUB' && (
              <button
                onClick={() => setTab('HUB')}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-emerald-200 text-xs font-extrabold px-3 py-2 rounded-xl transition"
              >
                <span>‹</span>
                <span>Bảng điều khiển</span>
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                  Tenant Admin
                </span>
                <span className="text-xs text-emerald-200/80">Quận {tenant.district}</span>
              </div>
              <h1 className="text-xl font-black tracking-tight mt-0.5">{tenant.name}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                logout();
                navigate('/');
              }}
              className="bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        {/* SUB-NAVIGATOR (CHO PHÉP CHUYỂN TAB TIỆN LỢI KHI KHÔNG Ở HUB) */}
        {tab !== 'HUB' && (
          <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-100 mb-6 overflow-x-auto text-xs font-bold">
            {TAB_ITEMS.filter((t) => t.show).map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`px-3.5 py-2 rounded-xl whitespace-nowrap transition ${
                  tab === item.id
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100/70'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 1: HUB / BẢNG ĐIỀU KHIỂN TRUNG TÂM (LẤY CẢM HỨNG TỪ ẢNH 2) */}
        {/* ========================================================= */}
        {tab === 'HUB' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
              <div className="relative z-10 max-w-2xl">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-300 bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-400/20">
                  Trung tâm Vận hành Sân cầu lông
                </span>
                <h2 className="text-2xl sm:text-3xl font-black mt-3">
                  Chào mừng trở lại, {tenant.name}!
                </h2>
                <p className="text-xs sm:text-sm text-emerald-100/80 mt-1.5 leading-relaxed">
                  Lựa chọn một chức năng dưới đây để quản lý sân bãi, theo dõi doanh thu, cấu hình giá động hoặc quản lý nhân sự quầy lễ tân.
                </p>
              </div>
              <div className="absolute right-4 bottom-4 opacity-10 text-9xl select-none pointer-events-none">
                🏸
              </div>
            </div>

            {/* LƯỚI CARD CHỨC NĂNG (GIAO DIỆN DỊU MẮT, RÕ RÀNG, CHUYÊN NGHIỆP) */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {/* CARD 1: QUẢN LÝ SÂN & BẢO TRÌ */}
              <div
                onClick={() => setTab('COURTS')}
                className="group cursor-pointer rounded-3xl p-6 bg-white border border-slate-200/90 hover:border-emerald-500 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between h-52 relative overflow-hidden shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center text-2xl shadow-sm">
                    🏸
                  </div>
                  <span className="text-[11px] font-black bg-slate-100 text-slate-700 border border-slate-200/70 px-2.5 py-1 rounded-full">
                    {courts.length} Sân
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 group-hover:text-emerald-700 transition-colors tracking-tight">
                    Trạng thái & Quản lý Sân
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 font-medium leading-relaxed">
                    {courts.filter((c) => c.is_under_maintenance).length > 0
                      ? `Có ${courts.filter((c) => c.is_under_maintenance).length} sân đang bảo trì`
                      : 'Tất cả các sân đang hoạt động tốt'} • Lên lịch bảo trì trước
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-400 group-hover:text-emerald-600 transition-colors">
                  <span>Quản lý sân bãi</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>

              {/* CARD 1.5: GÓI CƯỚC & DỊCH VỤ SAAS */}
              <div
                onClick={() => setTab('SUBSCRIPTION')}
                className="group cursor-pointer rounded-3xl p-6 bg-white border border-slate-200/90 hover:border-indigo-500 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between h-52 relative overflow-hidden shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center text-2xl shadow-sm">
                    ⚡
                  </div>
                  <span
                    className={`text-[11px] font-black px-2.5 py-1 rounded-full ${
                      subData.pendingSubscription
                        ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200/70'
                    }`}
                  >
                    {subData.pendingSubscription
                      ? 'Chờ duyệt'
                      : subData.currentSubscription?.badge || 'Gói SaaS'}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 group-hover:text-indigo-700 transition-colors tracking-tight">
                    Gói Cước & Dịch Vụ SaaS
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 font-medium leading-relaxed">
                    {subData.pendingSubscription
                      ? `Đang chờ duyệt gói ${subData.pendingSubscription.plan_name}`
                      : `Hạn mức: ${
                          Number(subData.currentSubscription?.max_courts) >= 999
                            ? 'Không giới hạn'
                            : subData.currentSubscription?.max_courts || 8
                        } sân (${courts.length} sân đang dùng)`}
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-400 group-hover:text-indigo-600 transition-colors">
                  <span>Nâng cấp / Gia hạn gói</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>

              {/* CARD 2: BÁN HÀNG TẠI QUẦY & POS */}
              <div
                onClick={() => navigate('/staff')}
                className="group cursor-pointer rounded-3xl p-6 bg-white border border-slate-200/90 hover:border-amber-500 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between h-52 relative overflow-hidden shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center text-2xl shadow-sm">
                    ⚡
                  </div>
                  <span className="text-[11px] font-black bg-amber-50 text-amber-800 border border-amber-200/70 px-2.5 py-1 rounded-full">
                    Trực tiếp
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 group-hover:text-amber-700 transition-colors tracking-tight">
                    Quầy Lễ Tân & Bán Hàng
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 font-medium leading-relaxed">
                    Check-in mã QR, tạo vé vãng lai & xuất hóa đơn đồ uống, cầu lông tại quầy
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-400 group-hover:text-amber-600 transition-colors">
                  <span>Mở quầy POS</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>

              {/* CARD 3: QUẢN LÝ KHO POS */}
              <div
                onClick={() => setTab('POS_INVENTORY')}
                className="group cursor-pointer rounded-3xl p-6 bg-white border border-slate-200/90 hover:border-blue-500 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between h-52 relative overflow-hidden shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center text-2xl shadow-sm">
                    📦
                  </div>
                  <span className="text-[11px] font-black bg-slate-100 text-slate-700 border border-slate-200/70 px-2.5 py-1 rounded-full">
                    {products.length} Mặt hàng
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 group-hover:text-blue-700 transition-colors tracking-tight">
                    Kho hàng & Dịch vụ
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 font-medium leading-relaxed">
                    Nước uống, Cầu lông, Quấn cán, Cước, Băng gối, Salonpas & Thuê vợt
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-400 group-hover:text-blue-600 transition-colors">
                  <span>Kiểm kê kho</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>

              {/* CARD 4: DOANH THU & BÁO CÁO */}
              <div
                onClick={() => setTab('ANALYTICS')}
                className="group cursor-pointer rounded-3xl p-6 bg-white border border-slate-200/90 hover:border-purple-500 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between h-52 relative overflow-hidden shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 border border-purple-100 flex items-center justify-center text-2xl shadow-sm">
                    📊
                  </div>
                  <span className="text-[11px] font-black bg-purple-50 text-purple-800 border border-purple-200/70 px-2.5 py-1 rounded-full">
                    Trực quan
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 group-hover:text-purple-700 transition-colors tracking-tight">
                    Doanh thu & Lợi nhuận
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 font-medium leading-relaxed">
                    Biểu đồ doanh thu tiền sân, F&B và thống kê khung giờ vàng
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-400 group-hover:text-purple-600 transition-colors">
                  <span>Xem báo cáo</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>

              {/* CARD 5: TÀI KHOẢN LỄ TÂN */}
              <div
                onClick={() => setTab('STAFF')}
                className="group cursor-pointer rounded-3xl p-6 bg-white border border-slate-200/90 hover:border-teal-500 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between h-52 relative overflow-hidden shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center text-2xl shadow-sm">
                    👥
                  </div>
                  <span className="text-[11px] font-black bg-slate-100 text-slate-700 border border-slate-200/70 px-2.5 py-1 rounded-full">
                    {staffList.length} Nhân viên
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 group-hover:text-teal-700 transition-colors tracking-tight">
                    Quản lý Lễ tân
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 font-medium leading-relaxed">
                    Thêm, sửa, xóa tài khoản lễ tân & cấp lại mật khẩu bảo mật
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-400 group-hover:text-teal-600 transition-colors">
                  <span>Quản lý nhân sự</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>

              {/* CARD 6: CẤU HÌNH GIÁ ĐỘNG */}
              <div
                onClick={() => setTab('PRICING_RULES')}
                className="group cursor-pointer rounded-3xl p-6 bg-white border border-slate-200/90 hover:border-indigo-500 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between h-52 relative overflow-hidden shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center text-2xl shadow-sm">
                    💰
                  </div>
                  <span className="text-[11px] font-black bg-slate-100 text-slate-700 border border-slate-200/70 px-2.5 py-1 rounded-full">
                    {pricingRules.length} Khung giờ
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 group-hover:text-indigo-700 transition-colors tracking-tight">
                    Bảng giá Động
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 font-medium leading-relaxed">
                    Cấu hình giá giờ cao điểm, giờ thấp điểm theo từng loại sân
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-400 group-hover:text-indigo-600 transition-colors">
                  <span>Cài đặt bảng giá</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>

              {/* CARD 7: XEM ĐÁNH GIÁ (ĐỔI TÊN THEO YÊU CẦU) */}
              <div
                onClick={() => setTab('REVIEWS')}
                className="group cursor-pointer rounded-3xl p-6 bg-white border border-slate-200/90 hover:border-rose-500 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between h-52 relative overflow-hidden shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-700 border border-rose-100 flex items-center justify-center text-2xl shadow-sm">
                    ⭐
                  </div>
                  <span className="text-[11px] font-black bg-rose-50 text-rose-800 border border-rose-200/70 px-2.5 py-1 rounded-full">
                    {reviewsData.stats?.avg_rating || 5} ★ ({reviewsData.stats?.total_reviews || 0})
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 group-hover:text-rose-700 transition-colors tracking-tight">
                    Xem đánh giá
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 font-medium leading-relaxed">
                    Xem phản hồi thực tế của khách hàng sau khi hoàn tất đặt sân
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-400 group-hover:text-rose-600 transition-colors">
                  <span>Đánh giá từ khách</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>

              {/* CARD 8: MÔ TẢ (ĐỔI TÊN THEO YÊU CẦU) */}
              <div
                onClick={() => setTab('VENUE_DETAILS')}
                className="group cursor-pointer rounded-3xl p-6 bg-white border border-slate-200/90 hover:border-cyan-500 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between h-52 relative overflow-hidden shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-50 text-cyan-700 border border-cyan-100 flex items-center justify-center text-2xl shadow-sm">
                    📝
                  </div>
                  <span className="text-[11px] font-black bg-slate-100 text-slate-700 border border-slate-200/70 px-2.5 py-1 rounded-full">
                    {venueImages.length} Ảnh • {venueRules.length} Quy định
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 group-hover:text-cyan-700 transition-colors tracking-tight">
                    Mô tả
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 font-medium leading-relaxed">
                    Thư viện hình ảnh (xem, sửa, xóa), điều khoản nội quy & giới thiệu cụm sân
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-400 group-hover:text-cyan-600 transition-colors">
                  <span>Chỉnh sửa mô tả</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 1.5: GÓI CƯỚC THUÊ NỀN TẢNG & SAAS CHO CHỦ SÂN */}
        {/* ========================================================= */}
        {tab === 'SUBSCRIPTION' && (
          <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  Bảng Giá Thuê Nền Tảng & Gói Cước SaaS
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Lựa chọn gói cước phù hợp quy mô cụm sân để mở rộng hạn mức sân con, mở khóa bán lẻ POS và thiết lập bảng giá động linh hoạt.
                </p>
              </div>
            </div>

            {/* CẢNH BÁO / TRẠNG THÁI GÓI CƯỚC HIỆN TẠI HOẶC YÊU CẦU CHỜ DUYỆT */}
            {subData.pendingSubscription && (
              <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-amber-500/10 border border-amber-400/40 rounded-3xl p-6 text-amber-950 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500 animate-ping" />
                  <span className="text-xs font-black uppercase tracking-wider text-amber-800">
                    Yêu Cầu Đăng Ký Đang Chờ Super Admin Phê Duyệt
                  </span>
                </div>
                <div className="text-sm font-black text-slate-900">
                  Bạn đã gửi yêu cầu đăng ký: <span className="text-indigo-700">{subData.pendingSubscription.plan_name}</span> (Chu kỳ:{' '}
                  {subData.pendingSubscription.billing_cycle === 'YEARLY'
                    ? '1 Năm - Giảm 20%'
                    : subData.pendingSubscription.billing_cycle === '6_MONTHS'
                    ? '6 Tháng - Giảm 10%'
                    : '1 Tháng'})
                </div>
                <div className="text-xs text-slate-600 flex flex-wrap gap-4 pt-1">
                  <span>Số tiền: <strong className="text-emerald-700 font-black">{Number(subData.pendingSubscription.amount_paid).toLocaleString()} ₫</strong></span>
                  {subData.pendingSubscription.transaction_code && (
                    <span>Mã giao dịch VietQR: <strong className="font-mono text-slate-800">{subData.pendingSubscription.transaction_code}</strong></span>
                  )}
                  <span>Tài khoản hoàn tiền (nếu từ chối): <strong className="text-slate-800">{subData.pendingSubscription.refund_bank_name} - {subData.pendingSubscription.refund_account_number} ({subData.pendingSubscription.refund_account_name})</strong></span>
                </div>
                <p className="text-[11px] text-amber-800 pt-1 italic">
                  * Super Admin sẽ kiểm tra và kích hoạt ngay khi đối soát thành công. Nếu không được duyệt, tiền sẽ được hoàn trả 100% về tài khoản của bạn.
                </p>
              </div>
            )}

            {/* THÔNG BÁO TỪ CHỐI / HOÀN TIỀN (NẾU ĐƠN GẦN NHẤT BỊ TỪ CHỐI) */}
            {!subData.pendingSubscription && subData.history?.[0]?.payment_status === 'REFUNDED' && (
              <div className="bg-red-50 border border-red-200/80 rounded-3xl p-5 text-red-950 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">💸</span>
                  <span className="text-xs font-black uppercase text-red-800">
                    Yêu Cầu Gói Cước Trước Đó Đã Bị Từ Chối & Hoàn Tiền
                  </span>
                </div>
                <p className="text-xs text-slate-700">
                  Yêu cầu đăng ký <strong>{subData.history[0].plan_name}</strong> của bạn đã bị từ chối với lý do:{' '}
                  <em className="text-red-700 font-semibold">"{subData.history[0].rejection_reason || 'Thông tin thanh toán không khớp'}"</em>.
                </p>
                <p className="text-[11px] text-slate-600">
                  Số tiền <strong>{Number(subData.history[0].amount_paid).toLocaleString()} ₫</strong> đã được hệ thống xác nhận hoàn tiền về STK{' '}
                  <strong className="font-mono">{subData.history[0].refund_account_number}</strong> ({subData.history[0].refund_bank_name}). Bạn có thể đăng ký lại bất kỳ lúc nào bên dưới.
                </p>
              </div>
            )}

            {/* THÔNG TIN GÓI CƯỚC HIỆN TẠI CỦA CỤM SÂN */}
            {subData.currentSubscription ? (
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-7 text-white shadow-md border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-full">
                      Gói cước đang hiệu lực
                    </span>
                    <span className="text-xs text-indigo-300 font-bold">
                      {subData.currentSubscription.badge || 'Gói SaaS'}
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-white">
                    {subData.currentSubscription.plan_name}
                  </h3>
                  <div className="text-xs text-slate-300 flex flex-wrap gap-4 pt-1">
                    <div>
                      Hạn mức quản lý:{' '}
                      <strong className="text-emerald-400 font-black">
                        {Number(subData.currentSubscription.max_courts) >= 999
                          ? 'Không giới hạn sân con'
                          : `Tối đa ${subData.currentSubscription.max_courts} sân con`}
                      </strong>{' '}
                      (Đang sử dụng: {courts.length} sân)
                    </div>
                    <div>
                      Hiệu lực đến:{' '}
                      <strong className="text-white">
                        {new Date(subData.currentSubscription.end_date).toLocaleDateString('vi-VN')}
                      </strong>
                    </div>
                    <div>
                      Hoa hồng App:{' '}
                      <strong className="text-amber-400">
                        {subData.currentSubscription.commission_rate || 0}%
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const nextPlan = availablePlans.find(
                        (p) => p.id !== subData.currentSubscription?.plan_id
                      ) || availablePlans[0];
                      if (nextPlan) openCheckoutModal(nextPlan);
                    }}
                    className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 font-black px-5 py-3 rounded-2xl text-xs transition shadow-lg flex items-center gap-2 cursor-pointer"
                  >
                    <span>⚡</span>
                    <span>Nâng Cấp / Gia Hạn Gói</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 rounded-3xl p-6 sm:p-7 text-white shadow-md border-2 border-amber-500/40 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/40 px-2.5 py-0.5 rounded-full">
                      ⚠️ Chưa kích hoạt gói cước
                    </span>
                    <span className="text-xs text-amber-200 font-bold">
                      {subData.pendingSubscription ? 'Đang chờ Super Admin duyệt' : 'Chưa đăng ký gói'}
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-white">
                    {subData.pendingSubscription
                      ? `Đang chờ duyệt: ${subData.pendingSubscription.plan_name}`
                      : 'Bạn chưa đăng ký gói cước SaaS nào'}
                  </h3>
                  <p className="text-xs text-amber-100/80 max-w-2xl leading-relaxed">
                    {subData.pendingSubscription
                      ? `Bạn đã thanh toán yêu cầu đăng ký gói ${subData.pendingSubscription.plan_name} (Mã GD: #${subData.pendingSubscription.transaction_code || ''}). Vui lòng chờ Super Admin phê duyệt để bắt đầu khởi tạo sân và đón khách!`
                      : 'Để có thể khởi tạo sân đấu và sử dụng các tính năng phần mềm, bạn cần chọn 1 trong các gói cước bên dưới, chuyển khoản thanh toán và chờ Super Admin phê duyệt.'}
                  </p>
                  <div className="text-xs text-slate-300 flex flex-wrap gap-4 pt-1">
                    <div>
                      Hạn mức quản lý: <strong className="text-amber-400 font-bold">0 sân</strong> (Cần kích hoạt gói)
                    </div>
                    <div>
                      Trạng thái sân: <strong className="text-amber-200 font-bold">Khóa tạo sân mới cho đến khi có gói</strong>
                    </div>
                  </div>
                </div>

                {!subData.pendingSubscription && (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const target = document.getElementById('plans-pricing-section');
                        if (target) target.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black px-5 py-3 rounded-2xl text-xs transition shadow-lg flex items-center gap-2 whitespace-nowrap cursor-pointer"
                    >
                      <span>👇</span>
                      <span>Chọn Gói Cước Ngay</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* BẢNG GIÁ 3 GÓI CƯỚC THỰC TẾ (ALOBO) */}
            <div className="space-y-4 pt-2" id="plans-pricing-section">
              <div className="text-center max-w-xl mx-auto space-y-1">
                <h3 className="text-lg font-black text-slate-900">
                  Chọn Gói Cước Phù Hợp Để Phát Triển Cụm Sân
                </h3>
                <p className="text-xs text-slate-500">
                  Giảm 10% khi thanh toán 6 tháng • Giảm 20% khi thanh toán 1 năm • Miễn phí 100% đơn tại quầy
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-6 items-stretch">
                {availablePlans.map((p) => {
                  const monthly = Number(p.price_per_month);
                  const isCurrent = subData.currentSubscription?.plan_id === p.id;
                  const isPendingThis = subData.pendingSubscription?.plan_id === p.id;

                  return (
                    <div
                      key={p.id}
                      className={`rounded-3xl p-6 bg-white border flex flex-col justify-between transition-all duration-300 relative shadow-sm ${
                        p.is_featured
                          ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                          : 'border-slate-200/90 hover:border-slate-400 hover:shadow-md'
                      }`}
                    >
                      {p.is_featured && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                          ★ ĐƯỢC CHỌN NHIỀU NHẤT
                        </div>
                      )}

                      <div className="space-y-4">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            {p.badge}
                          </span>
                          <h4 className="text-base font-black text-slate-900 mt-2">{p.name}</h4>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                            {p.description}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-100">
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-slate-900">
                              {monthly.toLocaleString()} ₫
                            </span>
                            <span className="text-xs text-slate-400 font-bold">
                              / tháng
                            </span>
                          </div>
                          <div className="text-[10px] text-emerald-600 font-bold mt-0.5">
                            Giảm 10% (6 tháng) • Giảm 20% (1 năm)
                          </div>
                        </div>

                        {/* QUY MÔ QUẢN LÝ VÀ PHÍ HOA HỒNG */}
                        <div className="bg-slate-50 rounded-2xl p-3 text-xs space-y-1.5 border border-slate-100">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 text-[11px]">Quy mô quản lý:</span>
                            <strong className="text-slate-900 font-black">
                              {Number(p.max_courts) >= 999 ? 'Không giới hạn sân' : `Tối đa ${p.max_courts} sân`}
                            </strong>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 text-[11px]">Hoa hồng đặt App:</span>
                            <strong className="text-indigo-700 font-bold">{p.commission_rate}%</strong>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 text-[11px]">Đơn tại quầy:</span>
                            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.2 rounded text-[10px] font-black">
                              0% (Miễn phí)
                            </span>
                          </div>
                        </div>

                        {/* DANH SÁCH TÍNH NĂNG */}
                        <div className="space-y-1.5 pt-1">
                          <div className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                            Tính năng nổi bật:
                          </div>
                          <ul className="space-y-1.5 text-xs text-slate-600">
                            {Array.isArray(p.features) &&
                              p.features.map((feat, idx) => (
                                <li key={idx} className="flex items-start gap-1.5">
                                  <span className="text-emerald-500 font-bold">✓</span>
                                  <span>{feat}</span>
                                </li>
                              ))}
                          </ul>
                        </div>
                      </div>

                      <div className="pt-5 mt-4 border-t border-slate-100">
                        {isCurrent ? (
                          <button
                            disabled
                            className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-400 font-bold text-xs cursor-not-allowed"
                          >
                            ✓ Gói Đang Sử Dụng
                          </button>
                        ) : isPendingThis ? (
                          <button
                            disabled
                            className="w-full py-2.5 rounded-xl bg-amber-100 text-amber-800 font-black text-xs cursor-not-allowed animate-pulse"
                          >
                            ⏳ Đang Chờ Duyệt...
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openCheckoutModal(p)}
                            className={`w-full py-2.5 rounded-xl text-xs font-black transition shadow-sm active:scale-95 cursor-pointer ${
                              p.is_featured
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-slate-900 hover:bg-slate-800 text-white'
                            }`}
                          >
                            {subData.currentSubscription ? 'Nâng Cấp Gói' : 'Đăng Ký Gói Cước'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>


            {/* LỊCH SỬ ĐĂNG KÝ VÀ GIAO DỊCH GÓI CƯỚC */}
            <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-slate-100 space-y-4 mt-6">
              <h3 className="font-extrabold text-slate-900 text-base">
                Lịch Sử Đăng Ký & Giao Dịch Gói Cước ({subData.history?.length || 0})
              </h3>

              {!subData.history || subData.history.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Chưa có lịch sử giao dịch gói cước nào.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-wider border-b border-slate-100">
                      <tr>
                        <th className="p-3">Gói cước</th>
                        <th className="p-3">Chu kỳ</th>
                        <th className="p-3">Số tiền</th>
                        <th className="p-3">Mã GD</th>
                        <th className="p-3">Trạng thái</th>
                        <th className="p-3">Tài khoản hoàn tiền</th>
                        <th className="p-3">Ngày gửi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {subData.history.map((h) => (
                        <tr key={h.id} className="hover:bg-slate-50/70">
                          <td className="p-3 font-bold text-slate-900">
                            {h.plan_name}
                            <span className="block text-[10px] text-slate-400 font-normal">
                              {h.badge}
                            </span>
                          </td>
                          <td className="p-3 text-slate-700 font-medium">
                            {h.billing_cycle === 'YEARLY'
                              ? '1 Năm (-20%)'
                              : h.billing_cycle === '6_MONTHS'
                              ? '6 Tháng (-10%)'
                              : Number(h.amount_paid) === 0
                              ? 'Dùng thử 14 ngày'
                              : '1 Tháng'}
                          </td>
                          <td className="p-3 font-black text-slate-900">
                            {Number(h.amount_paid).toLocaleString()} ₫
                          </td>
                          <td className="p-3 font-mono text-slate-600">
                            {h.transaction_code || '—'}
                          </td>
                          <td className="p-3">
                            {h.payment_status === 'PAID' ? (
                              <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold text-[10px]">
                                ✓ Đã Kích Hoạt
                              </span>
                            ) : h.payment_status === 'PENDING' ? (
                              <span className="bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold text-[10px] animate-pulse">
                                ⏳ Chờ Duyệt
                              </span>
                            ) : (
                              <div className="space-y-0.5">
                                <span className="bg-red-100 text-red-800 px-2.5 py-0.5 rounded-full font-bold text-[10px]">
                                  💸 Đã Hoàn Tiền
                                </span>
                                {h.rejection_reason && (
                                  <span className="block text-[10px] text-red-600 italic">
                                    {h.rejection_reason}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-slate-600 text-[11px]">
                            {h.refund_bank_name ? (
                              <div>
                                <strong>{h.refund_bank_name}</strong> - {h.refund_account_number} ({h.refund_account_name})
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="p-3 text-slate-400 text-[11px]">
                            {h.created_at ? new Date(h.created_at).toLocaleDateString('vi-VN') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: QUẢN LÝ SÂN & BẢO TRÌ (CRUD & LÊN LỊCH BẢO TRÌ) */}
        {/* ========================================================= */}
        {tab === 'COURTS' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-slate-900">Quản lý Sân & Trạng thái Bảo trì</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tạo sân mới, cập nhật phân loại, xóa sân và lên lịch bảo trì trước để chặn khách đặt.
                </p>
              </div>
            </div>

            {/* CẢNH BÁO NẾU CHƯA CÓ GÓI CƯỚC */}
            {!subData.currentSubscription && (
              <div className="p-5 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">⚠️</span>
                  <div>
                    <h4 className="font-extrabold text-amber-950 text-sm">
                      Cụm Sân Chưa Kích Hoạt Gói Cước SaaS
                    </h4>
                    <p className="text-xs text-amber-800 mt-0.5">
                      {subData.pendingSubscription
                        ? `Yêu cầu đăng ký gói "${subData.pendingSubscription.plan_name}" đang chờ Super Admin phê duyệt. Khi được duyệt, bạn sẽ được khởi tạo tối đa ${subData.pendingSubscription.max_courts} sân.`
                        : 'Bạn cần đăng ký gói cước và được Super Admin phê duyệt thì mới có thể khởi tạo sân thi đấu và mở bán trên sàn.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTab('SUBSCRIPTION')}
                  className="bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs whitespace-nowrap shadow-md shadow-amber-600/20 transition cursor-pointer"
                >
                  ⚡ {subData.pendingSubscription ? 'Xem Trạng Thái Gói →' : 'Đăng Ký Gói Cước Ngay →'}
                </button>
              </div>
            )}

            {/* DANH SÁCH SÂN TOÀN BẢNG (FULL-WIDTH) */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Danh sách Sân ({courts.length}
                    {subData.currentSubscription
                      ? ` / ${Number(subData.currentSubscription.max_courts) >= 999 ? '∞' : subData.currentSubscription.max_courts}`
                      : ' / 0'} sân)
                  </h3>
                  <p className="text-xs text-slate-400">
                    {subData.currentSubscription
                      ? `Hạn mức theo ${subData.currentSubscription.plan_name}: ${courts.length}/${Number(subData.currentSubscription.max_courts) >= 999 ? 'Không giới hạn' : subData.currentSubscription.max_courts} sân`
                      : 'Chưa kích hoạt gói cước (Khóa tạo sân)'}
                  </p>
                </div>
                <ExpandableAddButton
                  label="Thêm sân mới"
                  onClick={handleOpenAddCourt}
                />
              </div>


              <div className="space-y-3">
                {courts.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 sm:p-5 border border-slate-200/80 bg-slate-50/70 hover:bg-white hover:shadow-sm rounded-2xl flex flex-wrap justify-between items-center gap-3 text-xs transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <strong className="text-slate-900 text-sm font-black">{c.name}</strong>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          c.type === 'VIP' ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-blue-100 text-blue-900 border-blue-200'
                        }`}>
                          {c.type}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            c.status === 'PUBLISHED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {c.status}
                        </span>
                      </div>

                      {c.is_under_maintenance && (
                        <div className="text-[11px] text-red-600 font-bold flex items-center gap-1">
                          <span>🔧 Đang bảo trì</span>
                          {c.maintenance_start && (
                            <span>
                              từ {new Date(c.maintenance_start).toLocaleDateString('vi-VN')}{' '}
                              {new Date(c.maintenance_start).toLocaleTimeString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false,
                              })}
                            </span>
                          )}
                          {c.maintenance_note && (
                            <span className="text-slate-500 font-normal">({c.maintenance_note})</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* NÚT BẢO TRÌ */}
                      {c.is_under_maintenance ? (
                        <button
                          type="button"
                          onClick={() => triggerEndMaintenance(c)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl transition text-[11px] shadow-sm"
                        >
                          ✓ Hoàn tất bảo trì (Mở sân)
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openMaintenanceModal(c)}
                          className="bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold px-3 py-1.5 rounded-xl transition text-[11px]"
                        >
                          🔧 Đặt lịch bảo trì
                        </button>
                      )}

                      {/* NÚT SỬA SÂN */}
                      <button
                        type="button"
                        onClick={() => setEditingCourt(c)}
                        className="bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold px-3 py-1.5 rounded-xl transition text-[11px]"
                      >
                        ✏️ Sửa
                      </button>

                      {/* NÚT XÓA SÂN */}
                      <button
                        type="button"
                        onClick={() => handleDeleteCourt(c)}
                        className="text-red-500 hover:bg-red-50 p-1.5 rounded-xl transition font-bold"
                        title="Xóa sân"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}

                {courts.length === 0 && (
                  <p className="text-xs text-slate-400 py-8 text-center">Chưa có sân nào trong cụm sân.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: BẢNG GIÁ ĐỘNG (FULL-WIDTH + NÚT EXPANDABLE GÓC PHẢI) */}
        {/* ========================================================= */}
        {tab === 'PRICING_RULES' && (
          <div className="space-y-6">
            {!subData.currentSubscription || Number(subData.currentSubscription.price_per_month) < 199000 ? (
              <div className="bg-white p-8 sm:p-12 rounded-3xl border-2 border-slate-200/90 text-center max-w-xl mx-auto space-y-4 shadow-sm my-6">
                <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-700 flex items-center justify-center text-3xl mx-auto shadow-inner">
                  🔒
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Tính Năng Bảng Giá Động Đang Bị Khóa</h3>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    Tính năng Cấu hình Bảng giá động theo từng khung giờ cao điểm và cuối tuần chỉ mở khóa từ <strong>Gói Tiêu Chuẩn (199.000 ₫/tháng)</strong> trở lên.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTab('SUBSCRIPTION')}
                  className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black px-6 py-3 rounded-2xl text-xs transition shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  ⚡ Đăng Ký / Nâng Cấp Gói Tiêu Chuẩn Ngay →
                </button>
              </div>
            ) : (
              <>
                <div>
                  <h2 className="text-xl font-black text-slate-900">Cấu hình Bảng giá Động</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Thiết lập mức giá theo từng khung giờ và loại sân (Sân Tiêu Chuẩn hoặc Sân VIP).
                  </p>
                </div>

                <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base">
                        Khung giá đang áp dụng ({pricingRules.length})
                      </h3>
                      <p className="text-xs text-slate-400">
                        Biểu phí giờ chơi theo loại sân tiêu chuẩn và VIP
                      </p>
                    </div>
                    <ExpandableAddButton
                      label="Thêm khung giá"
                      onClick={() => setShowAddPricingModal(true)}
                    />
                  </div>

                  <div className="space-y-2.5">
                    {pricingRules.map((r) => (
                      <div
                        key={r.id}
                        className="p-4 sm:p-5 border border-slate-200/80 bg-slate-50/70 hover:bg-white hover:shadow-sm rounded-2xl flex justify-between items-center text-xs transition"
                      >
                        <div className="space-y-1">
                          <span className="font-bold text-slate-800 text-sm">
                            Sân <strong className="text-emerald-700">{r.court_type}</strong>: {formatTime24(r.start_time)} → {formatTime24(r.end_time)}
                          </span>
                          <div className="text-[11px] text-slate-400">Áp dụng tất cả các ngày trong tuần</div>
                        </div>

                        <div className="flex items-center gap-3">
                          <strong className="text-emerald-700 text-base font-black">
                            {Number(r.price_per_hour).toLocaleString()} ₫/h
                          </strong>
                          <button
                            type="button"
                            onClick={() => setEditingRule(r)}
                            className="bg-white border border-slate-300 hover:bg-slate-100 px-3 py-1.5 rounded-xl text-slate-700 font-bold transition text-xs shadow-sm"
                          >
                            ✏️ Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePricingRule(r)}
                            className="text-red-500 hover:bg-red-50 p-2 rounded-xl font-bold transition text-sm"
                            title="Xóa khung giá"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                    {pricingRules.length === 0 && (
                      <p className="text-xs text-slate-400 py-8 text-center">Chưa có khung giá nào được cài đặt.</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}


        {/* ========================================================= */}
        {/* TAB 4: KHO HÀNG POS (FULL-WIDTH + NÚT EXPANDABLE GÓC PHẢI) */}
        {/* ========================================================= */}
        {tab === 'POS_INVENTORY' && tenant.enable_pos_module && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-slate-900">Quản lý Kho hàng POS & Dịch vụ</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Nhập kho, chỉnh sửa giá bán, theo dõi số lượng tồn kho của nước giải khát, cầu lông, quấn cán, cước, băng gối, salonpas.
              </p>
            </div>

            <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Danh sách Tồn kho ({products.length} mặt hàng)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Toàn bộ mặt hàng giải khát, phụ kiện và dịch vụ trong kho
                  </p>
                </div>
                <ExpandableAddButton
                  label="Nhập hàng mới"
                  onClick={() => setShowAddProductModal(true)}
                />
              </div>

              <div className="space-y-2.5">
                {products.map((p) => {
                  const catObj = POS_CATEGORIES.find((c) => c.value === p.category) || {
                    label: p.category,
                    color: 'bg-slate-100 text-slate-800 border-slate-200',
                  };
                  return (
                    <div
                      key={p.id}
                      className="p-4 sm:p-5 border border-slate-200/80 bg-slate-50/70 hover:bg-white hover:shadow-sm rounded-2xl flex flex-wrap justify-between items-center gap-3 text-xs transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <strong className="text-slate-900 text-sm font-black">{p.name}</strong>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${catObj.color}`}>
                            {catObj.label}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Giá bán: <strong className="text-emerald-700 font-bold">{Number(p.price).toLocaleString()} ₫</strong> • Tồn kho: <strong className="text-slate-900 font-extrabold">{p.stock_quantity}</strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingProduct(p)}
                          className="bg-white border border-slate-300 hover:bg-slate-100 px-3 py-1.5 rounded-xl text-slate-700 font-bold text-xs shadow-sm transition"
                        >
                          ✏️ Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(p)}
                          className="text-red-500 hover:bg-red-50 p-2 rounded-xl font-bold transition text-sm"
                          title="Xóa mặt hàng"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
                {products.length === 0 && (
                  <p className="text-xs text-slate-400 py-8 text-center">Kho hàng POS hiện đang trống.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 5: TÀI KHOẢN LỄ TÂN (FULL-WIDTH + NÚT EXPANDABLE GÓC PHẢI) */}
        {/* ========================================================= */}
        {tab === 'STAFF' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-slate-900">Quản lý Tài khoản Nhân viên Lễ tân</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cấp tài khoản, cập nhật thông tin, đổi mật khẩu và vô hiệu hóa tài khoản cho nhân viên trực quầy.
              </p>
            </div>

            <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Danh sách Nhân viên Lễ tân ({staffList.length})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Tài khoản nhân viên trực ca tại quầy và bán hàng POS
                  </p>
                </div>
                <ExpandableAddButton
                  label="Cấp tài khoản mới"
                  onClick={() => setShowAddStaffModal(true)}
                />
              </div>

              <div className="space-y-2.5">
                {staffList.map((st) => (
                  <div
                    key={st.id}
                    className="p-4 sm:p-5 border border-slate-200/80 bg-slate-50/70 hover:bg-white hover:shadow-sm rounded-2xl flex flex-wrap justify-between items-center gap-3 text-xs transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <strong className="text-slate-900 text-sm font-black">{st.full_name}</strong>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            st.is_active !== false
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {st.is_active !== false ? 'Đang hoạt động' : 'Đã khóa'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        📧 {st.email} • 📞 {st.phone || 'Chưa cập nhật SĐT'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingStaff({
                            ...st,
                            newPassword: '',
                            confirmNewPassword: '',
                          })
                        }
                        className="bg-white border border-slate-300 hover:bg-slate-100 px-3 py-1.5 rounded-xl text-slate-700 font-bold text-xs shadow-sm transition"
                      >
                        ✏️ Sửa & Đổi MK
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteStaff(st)}
                        className="text-red-500 hover:bg-red-50 p-2 rounded-xl font-bold transition text-sm"
                        title="Xóa hoặc Vô hiệu hóa lễ tân"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
                {staffList.length === 0 && (
                  <p className="text-xs text-slate-400 py-8 text-center">Chưa có tài khoản lễ tân nào.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 6: ĐÁNH GIÁ & NHẬN XÉT CỦA SÂN (CHỦ SÂN TỰ XEM) */}
        {/* ========================================================= */}
        {tab === 'REVIEWS' && (
          <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">Đánh giá & Nhận xét từ Khách hàng</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tổng hợp phản hồi xác thực (Verified Purchase) sau mỗi ca chơi đã hoàn thành.
                </p>
              </div>

              <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl shadow-sm border border-slate-100">
                <span className="text-3xl font-black text-amber-500">
                  {reviewsData.stats?.avg_rating || 5} ★
                </span>
                <div className="text-xs text-slate-600">
                  <div>Điểm đánh giá trung bình</div>
                  <strong className="text-slate-900">{reviewsData.stats?.total_reviews || 0} lượt đánh giá</strong>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
              <h3 className="font-extrabold text-slate-900 text-base">
                Tất cả đánh giá ({reviewsData.reviews?.length || 0})
              </h3>

              <div className="space-y-3">
                {reviewsData.reviews?.map((r) => (
                  <div
                    key={r.id}
                    className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 text-xs space-y-1.5"
                  >
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <div className="flex items-center gap-2">
                        <strong className="text-slate-900 text-sm">{r.user_name}</strong>
                        <span className="text-amber-500 font-bold">
                          {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                        </span>
                        {r.court_name && (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {r.court_name}
                          </span>
                        )}
                        {r.booking_code && (
                          <span className="text-[10px] font-mono text-slate-400">#{r.booking_code}</span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(r.created_at).toLocaleDateString('vi-VN')}
                      </span>
                    </div>

                    <p className="text-slate-700 leading-relaxed font-medium">
                      "{r.comment || 'Khách hàng không để lại nhận xét văn bản.'}"
                    </p>
                  </div>
                ))}
                {(!reviewsData.reviews || reviewsData.reviews.length === 0) && (
                  <p className="text-xs text-slate-400 py-8 text-center">
                    Cụm sân chưa nhận được đánh giá nào từ khách hàng.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 7: MÔ TẢ CỤM SÂN, THƯ VIỆN ẢNH (CRUD) & NỘI QUY */}
        {/* ========================================================= */}
        {tab === 'VENUE_DETAILS' && (
          <form onSubmit={handleSaveVenueDetails} className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">Mô Tả Cụm Sân, Thư Viện Hình Ảnh & Nội Quy</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Quản lý đầy đủ thư viện ảnh (xem ảnh lớn, thêm ảnh, sửa link, xóa ảnh), tùy chỉnh danh sách điều khoản và giới thiệu cụm sân.
                </p>
              </div>
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold px-6 py-3 rounded-2xl text-xs transition shadow-md flex items-center gap-2"
              >
                <span>💾</span>
                <span>Lưu Tất Cả Thay Đổi</span>
              </button>
            </div>

            <div className="grid lg:grid-cols-2 gap-6 items-start">
              {/* QUẢN LÝ THƯ VIỆN ẢNH SÂN (CRUD ĐẦY ĐỦ) */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                      <span>🖼️</span>
                      <span>Thư viện Hình ảnh Sân ({venueImages.length})</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">Xem ảnh lớn, chỉnh sửa link, chọn ảnh bìa hoặc xóa ảnh</p>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                    Ảnh 1 = Ảnh bìa sàn
                  </span>
                </div>

                {/* FORM THÊM ẢNH */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="Dán đường link ảnh (https://...)"
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleAddImage}
                      className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm whitespace-nowrap"
                    >
                      + Thêm ảnh
                    </button>
                  </div>

                  {/* GỢI Ý ẢNH MẪU 1 CHẠM */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-bold text-slate-400">Gợi ý ảnh đẹp:</span>
                    {[
                      { label: 'Thảm BWF Chuẩn', url: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1200&q=80' },
                      { label: 'Đèn Thi Đấu', url: 'https://images.unsplash.com/photo-1521537634581-0dced2fee2ef?auto=format&fit=crop&w=1200&q=80' },
                      { label: 'Sân Thi Đấu VIP', url: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80' },
                    ].map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setVenueImages([...venueImages, p.url]);
                          toast.success(`Đã thêm ảnh "${p.label}"!`);
                        }}
                        className="text-[10px] font-bold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 px-2.5 py-1 rounded-lg border border-slate-200 transition"
                      >
                        + {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* DANH SÁCH ẢNH DẠNG GRID CRUD */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto p-1">
                  {venueImages.map((imgUrl, i) => (
                    <div
                      key={i}
                      className="group rounded-2xl overflow-hidden border border-slate-200/90 bg-slate-50 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-emerald-300 transition"
                    >
                      <div className="relative h-32 overflow-hidden bg-slate-900 cursor-pointer" onClick={() => setPreviewModalImage(imgUrl)}>
                        <img
                          src={imgUrl}
                          alt={`Ảnh sân ${i + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            e.target.src = 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=900&q=80';
                          }}
                        />
                        <div className="absolute top-2 left-2 flex items-center gap-1.5">
                          {i === 0 ? (
                            <span className="bg-emerald-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-md">
                              ★ Ảnh bìa (Cover)
                            </span>
                          ) : (
                            <span className="bg-slate-900/80 backdrop-blur text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md shadow">
                              Ảnh #{i + 1}
                            </span>
                          )}
                        </div>
                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="bg-white/90 backdrop-blur text-slate-900 text-xs font-black px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-1.5">
                            <span>🔍</span>
                            <span>Xem ảnh lớn</span>
                          </span>
                        </div>
                      </div>

                      {/* THẺ ĐIỀU KHIỂN CRUD DƯỚI MỖI ẢNH */}
                      <div className="p-2.5 bg-white border-t border-slate-100 flex items-center justify-between gap-1 text-[11px] font-bold">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setPreviewModalImage(imgUrl)}
                            className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 p-1.5 rounded-lg transition"
                            title="Phóng to ảnh"
                          >
                            👁️ Xem
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEditImage(i)}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1.5 rounded-lg transition"
                            title="Sửa đường link ảnh"
                          >
                            ✏️ Sửa
                          </button>
                          {i !== 0 && (
                            <button
                              type="button"
                              onClick={() => handleSetCoverImage(i)}
                              className="text-amber-600 hover:text-amber-800 hover:bg-amber-50 p-1.5 rounded-lg transition"
                              title="Đưa lên làm ảnh bìa chính"
                            >
                              ⭐ Làm bìa
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveImage(i)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition"
                          title="Xóa ảnh này"
                        >
                          🗑️ Xóa
                        </button>
                      </div>
                    </div>
                  ))}
                  {venueImages.length === 0 && (
                    <div className="col-span-2 text-center py-12 text-slate-400 text-xs border border-dashed rounded-2xl">
                      Chưa có hình ảnh nào. Hãy dán liên kết ảnh ở trên để thêm vào thư viện.
                    </div>
                  )}
                </div>
              </div>

              {/* QUẢN LÝ ĐIỀU KHOẢN, NỘI QUY & MÔ TẢ SÂN */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                <div className="pb-2 border-b border-slate-100">
                  <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                    <span>📋</span>
                    <span>Nội quy & Điều khoản sân ({venueRules.length})</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">Hiển thị toàn bộ các nội quy sẵn có, chỉnh sửa trực tiếp hoặc thêm bớt</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mô tả giới thiệu cụm sân</label>
                  <textarea
                    rows={3}
                    value={venueDescription}
                    onChange={(e) => setVenueDescription(e.target.value)}
                    placeholder="Giới thiệu về cơ sở vật chất, hệ thống thảm, quạt làm mát, phòng thay đồ..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs leading-relaxed focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* FORM THÊM ĐIỀU KHOẢN MỚI */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">Thêm quy định / điều khoản mới</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="VD: Không mang đồ ăn có mùi hoặc bã kẹo cao su vào sân đấu..."
                      value={newRuleText}
                      onChange={(e) => setNewRuleText(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddRule}
                      className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm whitespace-nowrap"
                    >
                      + Thêm
                    </button>
                  </div>

                  {/* GỢI Ý ĐIỀU KHOẢN TIÊU CHUẨN */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-bold text-slate-400">Thêm nhanh:</span>
                    {[
                      'Mang giày thể thao chuyên dụng (đế không để vệt đen)',
                      'Có mặt trước 10 phút làm thủ tục Check-in',
                      'Hủy trước 24h hoàn tiền 100% tự động',
                      'Tự bảo quản đồ dùng cá nhân có giá trị'
                    ].map((sampleRule, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          if (!venueRules.includes(sampleRule)) {
                            setVenueRules([...venueRules, sampleRule]);
                            toast.success('Đã thêm quy định mẫu!');
                          }
                        }}
                        className="text-[10px] font-bold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 px-2 py-0.5 rounded-lg border border-slate-200 transition"
                      >
                        + {sampleRule.slice(0, 26)}...
                      </button>
                    ))}
                  </div>
                </div>

                {/* DANH SÁCH TẤT CẢ NỘI QUY SẴN CÓ VỚI INLINE EDIT */}
                <div className="space-y-2 max-h-80 overflow-y-auto p-1">
                  <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Toàn bộ điều khoản hiện có (Bấm ✏️ để sửa câu chữ):
                  </div>
                  {venueRules.map((r, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-2xl border text-xs transition ${
                        editingRuleIdx === i
                          ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/20'
                          : 'bg-slate-50/80 border-slate-200 hover:bg-white hover:border-slate-300'
                      }`}
                    >
                      {editingRuleIdx === i ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-amber-800">
                              Đang chỉnh sửa Quy định #{i + 1}:
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditingRuleIdx(null)}
                              className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                            >
                              ✕ Hủy
                            </button>
                          </div>
                          <textarea
                            rows={2}
                            value={editingRuleContent}
                            onChange={(e) => setEditingRuleContent(e.target.value)}
                            className="w-full p-2.5 bg-white border border-amber-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingRuleIdx(null)}
                              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 font-bold text-[11px]"
                            >
                              Hủy bỏ
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveEditRule}
                              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-sm"
                            >
                              ✓ Lưu sửa
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <span className="text-slate-700 font-medium leading-relaxed">{r}</span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStartEditRule(i)}
                              className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg font-bold text-[11px] transition"
                              title="Sửa nội dung"
                            >
                              ✏️ Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveRule(i)}
                              className="text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg font-bold text-[11px] transition"
                              title="Xóa điều khoản này"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {venueRules.length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      Chưa có quy định nào. Bạn có thể thêm nội quy mới ở ô phía trên.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold py-3.5 rounded-2xl text-sm transition shadow-md"
            >
              💾 Lưu Toàn Bộ Mô Tả, Nội Quy & Thư Viện Ảnh Lên Hệ Thống
            </button>
          </form>
        )}

        {/* ========================================================= */}
        {/* TAB 8: BÁO CÁO DOANH THU & BIỂU ĐỒ TRỰC QUAN */}
        {/* ========================================================= */}
        {tab === 'ANALYTICS' && analytics && (
          <div className="space-y-6">
            <RevenueCharts analytics={analytics} />
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 9: CẤU HÌNH TÍNH NĂNG, HSSV & VIETQR */}
        {/* ========================================================= */}
        {tab === 'SETTINGS' && (
          <form onSubmit={handleSaveSettings} className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
              <h2 className="font-extrabold text-slate-900 text-base">Công tắc Bật/Tắt Module (Feature Toggles)</h2>

              {[
                {
                  key: 'enable_vip_courts',
                  title: 'Sử dụng Sân VIP',
                  desc: 'Cho phép tạo và cấu hình giá riêng cho sân tiêu chuẩn VIP',
                  locked: !hasPlan,
                  lockMsg: 'Cần đăng ký gói cước',
                },
                {
                  key: 'enable_pos_module',
                  title: 'Module Bán hàng POS tại quầy',
                  desc: 'Quản lý tồn kho nước uống, cầu lông và tạo hóa đơn tại quầy lễ tân',
                  locked: !canUsePos,
                  lockMsg: 'Yêu cầu Gói Tiêu Chuẩn (199k) trở lên',
                },
                {
                  key: 'enable_advanced_analytics',
                  title: 'Báo cáo Thống kê Chuyên sâu',
                  desc: 'Phân tích chi tiết doanh thu theo từng sân và top mặt hàng bán chạy',
                  locked: !canUsePos,
                  lockMsg: 'Yêu cầu Gói Tiêu Chuẩn (199k) trở lên',
                },
              ].map((toggle) => (
                <label
                  key={toggle.key}
                  className={`flex items-center justify-between p-4 rounded-2xl border transition ${
                    toggle.locked
                      ? 'bg-slate-100/60 border-slate-200 cursor-not-allowed opacity-75'
                      : 'bg-slate-50 hover:bg-slate-100/70 border-slate-200/70 cursor-pointer'
                  }`}
                >
                  <div className="pr-4">
                    <div className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
                      <span>{toggle.title}</span>
                      {toggle.locked && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                          🔒 {toggle.lockMsg}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{toggle.desc}</div>
                  </div>
                  <input
                    type="checkbox"
                    disabled={toggle.locked}
                    checked={toggle.locked ? false : Boolean(tenant[toggle.key])}
                    onChange={(e) => {
                      if (toggle.locked) return;
                      setTenant({ ...tenant, [toggle.key]: e.target.checked });
                    }}
                    className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 disabled:opacity-40"
                  />
                </label>
              ))}


              <div className="pt-4 border-t border-slate-100 space-y-3">
                <h2 className="font-extrabold text-slate-900 text-base">Chính sách Ưu đãi Học sinh / Sinh viên</h2>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Chế độ chiết khấu tự động</label>
                  <select
                    value={tenant.student_discount_type}
                    onChange={(e) => setTenant({ ...tenant, student_discount_type: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold"
                  >
                    <option value="NONE">Không áp dụng ưu đãi</option>
                    <option value="SYSTEM_DEFAULT_20">Giảm theo mặc định hệ thống (20%)</option>
                    <option value="CUSTOM_FIXED_OFF">Trừ thẳng số tiền cố định trên mỗi ca (VNĐ)</option>
                    <option value="CUSTOM_FLAT_RATE">Đồng giá ưu đãi theo giờ (VNĐ/giờ)</option>
                  </select>
                </div>
                {['CUSTOM_FIXED_OFF', 'CUSTOM_FLAT_RATE'].includes(tenant.student_discount_type) && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Mức tiền áp dụng (VNĐ)</label>
                    <input
                      type="number"
                      value={tenant.student_discount_value}
                      onChange={(e) => setTenant({ ...tenant, student_discount_value: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                <h2 className="font-extrabold text-slate-900 text-base">Tài khoản Ngân hàng nhận tiền 100% (VietQR)</h2>
                <p className="text-xs text-slate-500">
                  Hệ thống tự động sinh mã QR chuyển khoản dựa trên thông tin dưới đây khi khách đặt sân.
                </p>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mã Ngân hàng (VD: MB, VCB, TCB, ACB)</label>
                  <input
                    type="text"
                    value={tenant.qr_bank_name || ''}
                    onChange={(e) => setTenant({ ...tenant, qr_bank_name: e.target.value })}
                    placeholder="MB"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Số tài khoản nhận tiền</label>
                  <input
                    type="text"
                    value={tenant.qr_account_number || ''}
                    onChange={(e) => setTenant({ ...tenant, qr_account_number: e.target.value })}
                    placeholder="0987654321"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tên chủ tài khoản</label>
                  <input
                    type="text"
                    value={tenant.qr_account_name || ''}
                    onChange={(e) => setTenant({ ...tenant, qr_account_name: e.target.value })}
                    placeholder="NGUYEN VAN A"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm uppercase"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl text-sm transition shadow-sm"
              >
                💾 Lưu Toàn Bộ Cấu Hình Cụm Sân
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: LÊN LỊCH BẢO TRÌ SÂN (CHỐNG KHÁCH ĐẶT TRƯỚC) */}
      {/* ========================================================= */}
      {maintenanceModalCourt && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setMaintenanceModalCourt(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center text-sm transition"
            >
              ✕
            </button>

            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <span>🔧</span>
              <span>Lên Lịch Bảo Trì - {maintenanceModalCourt.name}</span>
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Khi kích hoạt bảo trì, tài khoản khách hàng sẽ không thể chọn đặt sân trong thời gian bảo trì. Hệ thống sẽ tự động kiểm tra nếu có khách đã đặt trước sẽ cảnh báo.
            </p>

            <form onSubmit={triggerSaveMaintenance} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Thời điểm bắt đầu bảo trì</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMaintScheduleMode('NOW')}
                    className={`py-2 rounded-xl font-bold border transition ${
                      maintScheduleMode === 'NOW'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Bảo trì ngay bây giờ
                  </button>
                  <button
                    type="button"
                    onClick={() => setMaintScheduleMode('SCHEDULE')}
                    className={`py-2 rounded-xl font-bold border transition ${
                      maintScheduleMode === 'SCHEDULE'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Lên lịch từ ngày/giờ
                  </button>
                </div>
              </div>

              {maintScheduleMode === 'SCHEDULE' && (
                <div className="space-y-2">
                  <label className="block font-bold text-slate-700">
                    Chọn ngày và giờ bắt đầu (Định dạng 24 Giờ)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="block text-[11px] text-slate-500 font-semibold mb-1">📅 Ngày bắt đầu</span>
                      <input
                        type="date"
                        required
                        value={maintStartDate}
                        onChange={(e) => setMaintStartDate(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-500 font-semibold mb-1">🕒 Giờ bắt đầu (24H)</span>
                      <TimeSelect24
                        value={maintStartTime}
                        onChange={(e) => setMaintStartTime(e.target.value)}
                        className="w-full"
                        required
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    * Định dạng chuẩn 24H (VD: 07:00, 14:30, 21:00). Khi bảo trì xong, bạn chỉ cần bấm "Hoàn tất bảo trì" để mở lại sân.
                  </p>
                </div>
              )}


              <div>
                <label className="block font-bold text-slate-700 mb-1">Lý do / Ghi chú bảo trì</label>
                <input
                  type="text"
                  required
                  value={maintNote}
                  onChange={(e) => setMaintNote(e.target.value)}
                  placeholder="VD: Thay mặt thảm, sửa hệ thống đèn"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMaintenanceModalCourt(null)}
                  className="flex-1 py-2.5 border rounded-xl font-bold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-bold transition shadow-sm"
                >
                  Xác nhận Bảo trì
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: SỬA THÔNG TIN SÂN */}
      {/* ========================================================= */}
      {editingCourt && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setEditingCourt(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center text-sm"
            >
              ✕
            </button>
            <h3 className="text-base font-black text-slate-900">Chỉnh sửa Sân</h3>
            <form onSubmit={triggerUpdateCourt} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tên sân</label>
                <input
                  type="text"
                  required
                  value={editingCourt.name}
                  onChange={(e) => setEditingCourt({ ...editingCourt, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Phân loại sân</label>
                <select
                  value={editingCourt.type}
                  onChange={(e) => setEditingCourt({ ...editingCourt, type: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                >
                  <option value="STANDARD">Sân STANDARD</option>
                  {tenant.enable_vip_courts && <option value="VIP">Sân VIP</option>}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCourt(null)}
                  className="flex-1 py-2.5 border rounded-xl font-bold text-slate-600"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold transition shadow-sm"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: SỬA KHUNG GIÁ ĐỘNG */}
      {/* ========================================================= */}
      {editingRule && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setEditingRule(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center text-sm"
            >
              ✕
            </button>
            <h3 className="text-base font-black text-slate-900">Chỉnh sửa Khung Giá</h3>
            <form onSubmit={triggerUpdatePricingRule} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Loại sân</label>
                <select
                  value={editingRule.court_type}
                  onChange={(e) => setEditingRule({ ...editingRule, court_type: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                >
                  <option value="STANDARD">Sân STANDARD</option>
                  <option value="VIP">Sân VIP</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Đơn giá (VNĐ/h)</label>
                <input
                  type="number"
                  required
                  value={editingRule.price_per_hour}
                  onChange={(e) => setEditingRule({ ...editingRule, price_per_hour: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Từ giờ (24h)</label>
                  <TimeSelect24
                    value={editingRule.start_time}
                    onChange={(e) => setEditingRule({ ...editingRule, start_time: e.target.value })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Đến giờ (24h)</label>
                  <TimeSelect24
                    value={editingRule.end_time}
                    onChange={(e) => setEditingRule({ ...editingRule, end_time: e.target.value })}
                    className="w-full"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRule(null)}
                  className="flex-1 py-2.5 border rounded-xl font-bold text-slate-600"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold transition shadow-sm"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: SỬA MẶT HÀNG KHO POS */}
      {/* ========================================================= */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setEditingProduct(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center text-sm"
            >
              ✕
            </button>
            <h3 className="text-base font-black text-slate-900">Chỉnh sửa Mặt hàng POS</h3>
            <form onSubmit={triggerUpdateProduct} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tên sản phẩm</label>
                <input
                  type="text"
                  required
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Phân loại hàng hóa</label>
                <select
                  value={editingProduct.category}
                  onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                >
                  {POS_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Đơn giá (VNĐ)</label>
                  <input
                    type="number"
                    required
                    value={editingProduct.price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tồn kho</label>
                  <input
                    type="number"
                    required
                    value={editingProduct.stock_quantity}
                    onChange={(e) => setEditingProduct({ ...editingProduct, stock_quantity: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="flex-1 py-2.5 border rounded-xl font-bold text-slate-600"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold transition shadow-sm"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: SỬA LỄ TÂN & ĐỔI MẬT KHẨU (CÓ XÁC NHẬN MẬT KHẨU) */}
      {/* ========================================================= */}
      {editingStaff && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setEditingStaff(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center text-sm"
            >
              ✕
            </button>
            <h3 className="text-base font-black text-slate-900">Chỉnh sửa Tài khoản Lễ tân</h3>
            <form onSubmit={triggerUpdateStaff} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Họ tên nhân viên</label>
                <input
                  type="text"
                  required
                  value={editingStaff.full_name}
                  onChange={(e) => setEditingStaff({ ...editingStaff, full_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Số điện thoại</label>
                <input
                  type="text"
                  required
                  value={editingStaff.phone}
                  onChange={(e) => setEditingStaff({ ...editingStaff, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 space-y-2">
                <span className="text-[11px] font-bold text-amber-900 block">
                  Đổi mật khẩu mới (Bỏ trống nếu không muốn đổi):
                </span>
                <div>
                  <input
                    type="password"
                    placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                    value={editingStaff.newPassword}
                    onChange={(e) => setEditingStaff({ ...editingStaff, newPassword: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs"
                  />
                </div>
                {editingStaff.newPassword && (
                  <div>
                    <input
                      type="password"
                      required
                      placeholder="Nhập lại mật khẩu mới để xác nhận"
                      value={editingStaff.confirmNewPassword}
                      onChange={(e) => setEditingStaff({ ...editingStaff, confirmNewPassword: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={editingStaff.is_active !== false}
                    onChange={(e) => setEditingStaff({ ...editingStaff, is_active: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Tài khoản đang hoạt động (Cho phép đăng nhập)</span>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="flex-1 py-2.5 border rounded-xl font-bold text-slate-600"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold transition shadow-sm"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: THÊM KHUNG GIÁ MỚI (MỞ TỪ NÚT "+" Ở TAB BẢNG GIÁ) */}
      {/* ========================================================= */}
      {showAddPricingModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative border border-slate-100">
            <button
              type="button"
              onClick={() => setShowAddPricingModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center text-sm transition"
            >
              ✕
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-xl font-black">
                💰
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Thêm Khung Giá Mới</h3>
                <p className="text-xs text-slate-500">Cấu hình khung giờ và đơn giá thuê sân (Định dạng 24h)</p>
              </div>
            </div>
            <form onSubmit={triggerCreatePricingRule} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Loại sân áp dụng</label>
                <select
                  value={newRule.courtType}
                  onChange={(e) => setNewRule({ ...newRule, courtType: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="STANDARD">Sân STANDARD (Tiêu chuẩn)</option>
                  <option value="VIP">Sân VIP (Cao cấp)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Đơn giá thuê mỗi giờ (VNĐ/h)</label>
                <input
                  type="number"
                  required
                  placeholder="VD: 120000"
                  value={newRule.pricePerHour}
                  onChange={(e) => setNewRule({ ...newRule, pricePerHour: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Từ giờ (24h)</label>
                  <TimeSelect24
                    value={newRule.startTime}
                    onChange={(e) => setNewRule({ ...newRule, startTime: e.target.value })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Đến giờ (24h)</label>
                  <TimeSelect24
                    value={newRule.endTime}
                    onChange={(e) => setNewRule({ ...newRule, endTime: e.target.value })}
                    className="w-full"
                  />
                </div>
              </div>
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPricingModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl font-bold transition shadow-sm"
                >
                  + Thêm Khung Giá
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: NHẬP HÀNG MỚI VÀO KHO (MỞ TỪ NÚT "+" Ở TAB POS) */}
      {/* ========================================================= */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative border border-slate-100">
            <button
              type="button"
              onClick={() => setShowAddProductModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center text-sm transition"
            >
              ✕
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-xl font-black">
                📦
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Nhập Hàng Mới Vào Kho</h3>
                <p className="text-xs text-slate-500">Thêm mặt hàng và số lượng tồn kho ban đầu</p>
              </div>
            </div>
            <form onSubmit={triggerCreateProduct} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tên mặt hàng</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Nước Revive, Quấn cán Yonex, Salonpas"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Phân loại hàng hóa</label>
                <select
                  value={newProduct.category}
                  onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {POS_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Đơn giá bán (VNĐ)</label>
                  <input
                    type="number"
                    required
                    placeholder="15000"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Số lượng tồn kho</label>
                  <input
                    type="number"
                    required
                    placeholder="50"
                    value={newProduct.stockQuantity}
                    onChange={(e) => setNewProduct({ ...newProduct, stockQuantity: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold transition shadow-sm"
                >
                  + Thêm Vào Kho POS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CẤP TÀI KHOẢN LỄ TÂN (MỞ TỪ NÚT "+" Ở TAB LỄ TÂN) */}
      {/* ========================================================= */}
      {showAddStaffModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative border border-slate-100">
            <button
              type="button"
              onClick={() => setShowAddStaffModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center text-sm transition"
            >
              ✕
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center text-xl font-black">
                👤
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Cấp Tài khoản Lễ tân Mới</h3>
                <p className="text-xs text-slate-500">Tạo tài khoản ca trực cho nhân viên tại quầy</p>
              </div>
            </div>
            <form onSubmit={triggerCreateStaff} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Họ tên nhân viên</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Nguyễn Văn Lễ Tân"
                  value={newStaff.fullName}
                  onChange={(e) => setNewStaff({ ...newStaff, fullName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Email đăng nhập</label>
                <input
                  type="email"
                  required
                  placeholder="letan@gmail.com"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Số điện thoại</label>
                <input
                  type="text"
                  required
                  placeholder="0903000001"
                  value={newStaff.phone}
                  onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mật khẩu khởi tạo</label>
                <input
                  type="password"
                  required
                  placeholder="Tối thiểu 6 ký tự"
                  value={newStaff.password}
                  onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nhập lại mật khẩu để xác nhận
                </label>
                <input
                  type="password"
                  required
                  placeholder="Xác nhận lại mật khẩu trên"
                  value={newStaff.confirmPassword}
                  onChange={(e) => setNewStaff({ ...newStaff, confirmPassword: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold transition shadow-sm"
                >
                  + Cấp Tài khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 6: THÊM SÂN MỚI (MỞ TỪ NÚT "+" Ở DƯỚI DANH SÁCH SÂN) */}
      {/* ========================================================= */}
      {showAddCourtModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative border border-slate-100">
            <button
              type="button"
              onClick={() => setShowAddCourtModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center text-sm transition"
            >
              ✕
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-xl font-black">
                🏸
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Thêm Sân Mới vào Cụm</h3>
                <p className="text-xs text-slate-500">Khởi tạo sân tiêu chuẩn hoặc VIP</p>
              </div>
            </div>
            <form onSubmit={triggerCreateCourt} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tên sân</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Sân Tiêu Chuẩn 03, Sân VIP 02"
                  value={newCourt.name}
                  onChange={(e) => setNewCourt({ ...newCourt, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Phân loại sân</label>
                <select
                  value={newCourt.type}
                  onChange={(e) => setNewCourt({ ...newCourt, type: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="STANDARD">Sân STANDARD (Tiêu chuẩn)</option>
                  {tenant.enable_vip_courts && <option value="VIP">Sân VIP (Cao cấp)</option>}
                </select>
                {!tenant.enable_vip_courts && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    * Bật công tắc "Sử dụng Sân VIP" trong tab Cấu hình Cụm sân để tạo sân VIP.
                  </p>
                )}
              </div>
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCourtModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold transition shadow-sm"
                >
                  + Thêm Sân vào Cụm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 7: POPUP XÁC NHẬN TÙY BIẾN HIỆN ĐẠI (CUSTOM CONFIRM) */}
      {/* ========================================================= */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm ${
                  confirmModal.confirmColor === 'red'
                    ? 'bg-red-100 text-red-600'
                    : confirmModal.confirmColor === 'amber'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {confirmModal.icon}
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">{confirmModal.title}</h3>
                <p className="text-[11px] text-slate-400">Xác nhận thao tác quản lý</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              {confirmModal.message}
            </p>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 font-bold text-xs text-slate-600 hover:bg-slate-100 transition"
              >
                {confirmModal.cancelText}
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className={`flex-1 py-2.5 rounded-xl text-white font-bold text-xs transition shadow-sm ${
                  confirmModal.confirmColor === 'red'
                    ? 'bg-red-600 hover:bg-red-700'
                    : confirmModal.confirmColor === 'amber'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 8: XEM ẢNH PHÓNG TO (LIGHTBOX PREVIEW) */}
      {/* ========================================================= */}
      {previewModalImage && (
        <div
          onClick={() => setPreviewModalImage(null)}
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-[9999]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]"
          >
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="text-base">🖼️</span>
                <span className="font-black text-sm text-slate-900">Xem ảnh chi tiết</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalImage(null)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-black flex items-center justify-center text-sm transition"
              >
                ✕
              </button>
            </div>
            <div className="p-4 bg-slate-900 flex items-center justify-center overflow-auto flex-1">
              <img
                src={previewModalImage}
                alt="Phóng to ảnh sân"
                className="max-h-[70vh] w-auto object-contain rounded-xl shadow-lg"
              />
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="truncate max-w-md font-mono text-[11px]">{previewModalImage}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(previewModalImage);
                  toast.success('Đã sao chép link ảnh!');
                }}
                className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg font-bold text-xs hover:bg-emerald-100 transition whitespace-nowrap"
              >
                Sao chép liên kết
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 9: SỬA ĐƯỜNG LINK ẢNH (IMAGE URL EDIT) */}
      {/* ========================================================= */}
      {editingImageIdx !== null && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center text-xl font-black">
                ✏️
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  Chỉnh sửa link Ảnh #{editingImageIdx + 1}
                </h3>
                <p className="text-[11px] text-slate-400">Thay đổi đường dẫn hình ảnh hiển thị trên sàn</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Đường link ảnh mới (https://...)</label>
                <input
                  type="url"
                  required
                  value={editingImageUrl}
                  onChange={(e) => setEditingImageUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {editingImageUrl && (
                <div className="rounded-xl overflow-hidden border border-slate-200 h-36 bg-slate-100">
                  <img
                    src={editingImageUrl}
                    alt="Xem trước ảnh"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=900&q=80';
                    }}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setEditingImageIdx(null);
                  setEditingImageUrl('');
                }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 font-bold text-xs text-slate-600 hover:bg-slate-100 transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveEditImage}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm"
              >
                ✓ Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ĐĂNG KÝ / THANH TOÁN GÓI CƯỚC SAAS */}
      {/* ========================================================= */}
      {checkoutModal.isOpen && checkoutModal.plan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-scale-up overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-4 my-8">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center text-2xl font-bold">
                  ⚡
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    Đăng Ký {checkoutModal.plan.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Hạn mức tối đa:{' '}
                    <strong>
                      {Number(checkoutModal.plan.max_courts) >= 999
                        ? 'Không giới hạn'
                        : `${checkoutModal.plan.max_courts} sân`}
                    </strong>{' '}
                    • Hoa hồng app: <strong>{checkoutModal.plan.commission_rate}%</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 p-1 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitSubscriptionRequest} className="space-y-4">
              {/* CHỌN CHU KỲ THANH TOÁN */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  Chu kỳ thanh toán & Ưu đãi:
                </label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setCheckoutModal((prev) => ({ ...prev, billingCycle: 'MONTHLY' }))
                    }
                    className={`p-3 rounded-2xl border text-center transition font-bold ${
                      checkoutModal.billingCycle === 'MONTHLY'
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div>1 Tháng</div>
                    <div className="text-xs font-black text-slate-900 mt-1">
                      {Number(checkoutModal.plan.price_per_month).toLocaleString()} ₫
                    </div>
                    <div className="text-[10px] text-slate-400 font-normal">Giá chuẩn</div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setCheckoutModal((prev) => ({ ...prev, billingCycle: '6_MONTHS' }))
                    }
                    className={`p-3 rounded-2xl border text-center transition font-bold relative ${
                      checkoutModal.billingCycle === '6_MONTHS'
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[9px] font-black uppercase px-2 py-0.2 rounded-full whitespace-nowrap shadow-xs">
                      Giảm 10%
                    </span>
                    <div>6 Tháng</div>
                    <div className="text-xs font-black text-slate-900 mt-1">
                      {Math.round(
                        Number(checkoutModal.plan.price_per_month) * 6 * 0.9
                      ).toLocaleString()}{' '}
                      ₫
                    </div>
                    <div className="text-[10px] text-emerald-600 font-semibold">
                      Tiết kiệm 10%
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setCheckoutModal((prev) => ({ ...prev, billingCycle: 'YEARLY' }))
                    }
                    className={`p-3 rounded-2xl border text-center transition font-bold relative ${
                      checkoutModal.billingCycle === 'YEARLY'
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[9px] font-black uppercase px-2 py-0.2 rounded-full whitespace-nowrap shadow-xs">
                      Giảm 20%
                    </span>
                    <div>1 Năm (12T)</div>
                    <div className="text-xs font-black text-slate-900 mt-1">
                      {Math.round(
                        Number(checkoutModal.plan.price_per_month) * 12 * 0.8
                      ).toLocaleString()}{' '}
                      ₫
                    </div>
                    <div className="text-[10px] text-emerald-600 font-semibold">
                      Tiết kiệm 20%
                    </div>
                  </button>
                </div>
              </div>

              {/* SỐ TIỀN CẦN THANH TOÁN & THÔNG TIN VIETQR */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                    <span className="text-xs font-bold text-slate-600">Số tiền chuyển khoản:</span>
                    <span className="text-base font-black text-emerald-700">
                      {calculateTotalAmount(
                        checkoutModal.plan,
                        checkoutModal.billingCycle
                      ).toLocaleString()}{' '}
                      ₫
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="shrink-0 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm text-center">
                      <img
                        src={`https://img.vietqr.io/image/MB-0987654321-compact2.png?amount=${calculateTotalAmount(
                          checkoutModal.plan,
                          checkoutModal.billingCycle
                        )}&addInfo=${encodeURIComponent(
                          `GOI_${checkoutModal.plan.name.slice(0, 10).replace(/\s+/g, '_')}_${tenant.name.slice(0, 8).replace(/\s+/g, '_')}`
                        )}`}
                        alt="VietQR Platform"
                        className="w-32 h-32 object-contain mx-auto"
                      />
                      <span className="text-[10px] font-bold text-slate-400 block mt-1">Quét mã VietQR</span>
                    </div>

                    <div className="text-xs space-y-1.5 text-slate-700 flex-1">
                      <div>Ngân hàng: <strong className="text-slate-900">MB Bank (Quân Đội)</strong></div>
                      <div>Số tài khoản: <strong className="font-mono text-slate-900 text-sm bg-white px-2 py-0.5 rounded border border-slate-200">0987654321</strong></div>
                      <div>Chủ tài khoản: <strong className="text-slate-900">PLATFORM SUPER ADMIN</strong></div>
                      <div>Nội dung CK: <strong className="font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">GOI {checkoutModal.plan.name.slice(0, 10)} {tenant.name.slice(0, 8)}</strong></div>
                    </div>
                  </div>

                  {/* NHẬP MÃ GIAO DỊCH */}
                  <div className="pt-2 border-t border-slate-200 space-y-2">
                    <div>
                      <label className="text-xs font-bold text-slate-800">
                        Mã giao dịch VietQR / Chuyển khoản <span className="text-red-500">*</span>:
                      </label>
                      <input
                        type="text"
                        required
                        value={checkoutModal.transactionCode}
                        onChange={(e) =>
                          setCheckoutModal((prev) => ({
                            ...prev,
                            transactionCode: e.target.value,
                          }))
                        }
                        placeholder="Ví dụ: MB123456789 hoặc FT2610..."
                        className="w-full mt-1 p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700">Ghi chú chuyển khoản (Tùy chọn):</label>
                      <input
                        type="text"
                        value={checkoutModal.paymentProofNote}
                        onChange={(e) =>
                          setCheckoutModal((prev) => ({
                            ...prev,
                            paymentProofNote: e.target.value,
                          }))
                        }
                        placeholder="Ví dụ: Đã chuyển khoản từ app Techcombank..."
                        className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

              {/* THÔNG TIN TÀI KHOẢN NHẬN HOÀN TIỀN (NẾU TỪ CHỐI) */}
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-amber-900 font-black uppercase text-[11px] tracking-wider">
                  <span>🛡️</span>
                  <span>Tài khoản nhận Hoàn tiền (Nếu không được duyệt)</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Trường hợp yêu cầu không được duyệt, Super Admin sẽ hoàn trả 100% số tiền về tài khoản ngân hàng này (tương tự chính sách hủy sân hoàn tiền trước 24h).
                </p>

                <div className="grid sm:grid-cols-3 gap-2 pt-1">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700">Ngân hàng:</label>
                    <input
                      type="text"
                      required
                      value={checkoutModal.refundBankName}
                      onChange={(e) =>
                        setCheckoutModal((prev) => ({
                          ...prev,
                          refundBankName: e.target.value,
                        }))
                      }
                      placeholder="VD: Vietcombank, MB..."
                      className="w-full mt-1 p-2 bg-white border border-amber-200 rounded-xl text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700">Số tài khoản:</label>
                    <input
                      type="text"
                      required
                      value={checkoutModal.refundAccountNumber}
                      onChange={(e) =>
                        setCheckoutModal((prev) => ({
                          ...prev,
                          refundAccountNumber: e.target.value,
                        }))
                      }
                      placeholder="Số tài khoản"
                      className="w-full mt-1 p-2 bg-white border border-amber-200 rounded-xl text-xs font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700">Tên chủ tài khoản:</label>
                    <input
                      type="text"
                      required
                      value={checkoutModal.refundAccountName}
                      onChange={(e) =>
                        setCheckoutModal((prev) => ({
                          ...prev,
                          refundAccountName: e.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="NGUYEN VAN A"
                      className="w-full mt-1 p-2 bg-white border border-amber-200 rounded-xl text-xs uppercase focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCheckoutModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-md active:scale-95 flex items-center gap-1.5"
                >
                  <span>✓</span>
                  <span>Xác nhận & Gửi yêu cầu duyệt</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}