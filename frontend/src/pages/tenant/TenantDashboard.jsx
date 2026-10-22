import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';

export default function TenantDashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState('SETTINGS');
  const [tenant, setTenant] = useState(null);
  const [courts, setCourts] = useState([]);
  const [pricingRules, setPricingRules] = useState([]);
  const [products, setProducts] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [analytics, setAnalytics] = useState(null);

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
  });

  const fetchTenantData = async () => {
    try {
      const [setRes, courtRes, ruleRes, staffRes, anaRes] = await Promise.all([
        axiosClient.get('/tenant/my-settings'),
        axiosClient.get('/tenant/courts'),
        axiosClient.get('/tenant/pricing-rules'),
        axiosClient.get('/tenant/staff'),
        axiosClient.get('/pos/analytics'),
      ]);
      setTenant(setRes.data.tenant);
      setCourts(courtRes.data.courts);
      setPricingRules(ruleRes.data.pricingRules);
      setStaffList(staffRes.data.staffList);
      setAnalytics(anaRes.data);

      if (setRes.data.tenant.enable_pos_module) {
        const prodRes = await axiosClient.get('/pos/products');
        setProducts(prodRes.data.products);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const initData = async () => {
      await fetchTenantData();
    };
    initData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
      alert(res.data.message);
      fetchTenantData();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi lưu cấu hình.');
    }
  };

  const handleCreateCourt = async (e) => {
    e.preventDefault();
    try {
      const res = await axiosClient.post('/tenant/courts', newCourt);
      alert(res.data.message);
      setNewCourt({ name: '', type: 'STANDARD' });
      fetchTenantData();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi tạo sân.');
    }
  };

  const handleToggleMaintenance = async (court) => {
    try {
      await axiosClient.put(`/tenant/courts/${court.id}/maintenance`, {
        isUnderMaintenance: !court.is_under_maintenance,
      });
      fetchTenantData();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi đổi trạng thái bảo trì.');
    }
  };

  const handleCreatePricingRule = async (e) => {
    e.preventDefault();
    try {
      await axiosClient.post('/tenant/pricing-rules', {
        ...newRule,
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      });
      alert('Đã thêm khung giá động thành công!');
      fetchTenantData();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi thêm giá động.');
    }
  };

  const handleDeletePricingRule = async (ruleId) => {
    try {
      await axiosClient.delete(`/tenant/pricing-rules/${ruleId}`);
      fetchTenantData();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi xóa khung giá.');
    }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    try {
      await axiosClient.post('/pos/products', newProduct);
      alert('Đã thêm sản phẩm vào kho POS!');
      setNewProduct({ name: '', category: 'DRINK', price: 15000, stockQuantity: 50 });
      fetchTenantData();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi thêm sản phẩm.');
    }
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    try {
      const res = await axiosClient.post('/tenant/staff', newStaff);
      alert(res.data.message);
      setNewStaff({ fullName: '', email: '', phone: '', password: '' });
      fetchTenantData();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi tạo nhân viên.');
    }
  };

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16">
      {/* HEADER CHỦ SÂN */}
      <header className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-slate-900 text-white px-6 py-5 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-full">
                Tenant Admin
              </span>
              <span className="text-xs text-emerald-200/80">Quận {tenant.district}</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight mt-1">{tenant.name}</h1>
            <p className="text-[11px] font-mono text-emerald-200/70 mt-0.5">Tenant UUID: {tenant.id}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/staff')}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl text-xs transition shadow-sm"
            >
              ⚡ Mở Quầy Lễ Tân & POS →
            </button>
            <button
              onClick={() => { logout(); navigate('/'); }}
              className="bg-white/10 hover:bg-white/20 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold transition"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      {/* MENU TABS */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-100 mb-6">
          {[
            { id: 'SETTINGS', label: '⚙️ 1. Công tắc Tính năng, HSSV & VietQR', show: true },
            { id: 'COURTS_PRICING', label: '🏸 2. Quản lý Sân & Giá Động', show: true },
            { id: 'POS_INVENTORY', label: '📦 3. Kho hàng POS (Nước & Cầu)', show: tenant.enable_pos_module },
            { id: 'STAFF', label: '👥 4. Tài khoản Lễ tân', show: true },
            { id: 'ANALYTICS', label: '📊 5. Báo cáo Doanh thu', show: true },
          ]
            .filter((t) => t.show)
            .map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition ${
                  tab === item.id ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            ))}
        </div>

        {/* TAB 1: CÀI ĐẶT */}
        {tab === 'SETTINGS' && (
          <form onSubmit={handleSaveSettings} className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
              <h2 className="font-extrabold text-slate-900 text-base">Công tắc Bật/Tắt Module (Feature Toggles)</h2>
              
              {[
                {
                  key: 'enable_vip_courts',
                  title: 'Sử dụng Sân VIP',
                  desc: 'Cho phép tạo và cấu hình giá riêng cho sân tiêu chuẩn VIP',
                },
                {
                  key: 'enable_pos_module',
                  title: 'Module Bán hàng POS tại quầy',
                  desc: 'Quản lý tồn kho nước uống, cầu lông và tạo hóa đơn tại quầy lễ tân',
                },
                {
                  key: 'enable_advanced_analytics',
                  title: 'Báo cáo Thống kê Chuyên sâu',
                  desc: 'Phân tích chi tiết doanh thu theo từng sân và top mặt hàng bán chạy',
                },
              ].map((toggle) => (
                <label
                  key={toggle.key}
                  className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/70 rounded-2xl border border-slate-200/70 cursor-pointer transition"
                >
                  <div className="pr-4">
                    <div className="text-xs font-extrabold text-slate-800">{toggle.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{toggle.desc}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(tenant[toggle.key])}
                    onChange={(e) => setTenant({ ...tenant, [toggle.key]: e.target.checked })}
                    className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500"
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

        {/* TAB 2: QUẢN LÝ SÂN & GIÁ ĐỘNG */}
        {tab === 'COURTS_PRICING' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
              <h2 className="font-extrabold text-slate-900 text-base">Danh sách Sân & Trạng thái Bảo trì</h2>
              <form onSubmit={handleCreateCourt} className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Tên sân (VD: Sân 1)"
                  value={newCourt.name}
                  onChange={(e) => setNewCourt({ ...newCourt, name: e.target.value })}
                  className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
                <select
                  value={newCourt.type}
                  onChange={(e) => setNewCourt({ ...newCourt, type: e.target.value })}
                  className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                >
                  <option value="STANDARD">STANDARD</option>
                  {tenant.enable_vip_courts && <option value="VIP">VIP</option>}
                </select>
                <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition">
                  + Tạo sân
                </button>
              </form>

              <div className="space-y-2.5">
                {courts.map((c) => (
                  <div key={c.id} className="p-3.5 border border-slate-100 bg-slate-50 rounded-2xl flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <strong className="text-slate-900 text-sm">{c.name}</strong>
                      <span className="bg-white border px-2 py-0.5 rounded-full text-[10px] font-bold">{c.type}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        c.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {c.status}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleMaintenance(c)}
                      className={`px-3 py-1.5 rounded-xl font-bold transition ${
                        c.is_under_maintenance
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-white border text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {c.is_under_maintenance ? '🔧 Đang bảo trì (Bấm để mở)' : 'Đặt bảo trì'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
              <h2 className="font-extrabold text-slate-900 text-base">Cấu hình Giá động theo Khung giờ</h2>
              <form onSubmit={handleCreatePricingRule} className="grid grid-cols-2 gap-2.5 text-xs">
                <select
                  value={newRule.courtType}
                  onChange={(e) => setNewRule({ ...newRule, courtType: e.target.value })}
                  className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                >
                  <option value="STANDARD">Sân STANDARD</option>
                  <option value="VIP">Sân VIP</option>
                </select>
                <input
                  type="number"
                  required
                  placeholder="Giá/giờ (VNĐ)"
                  value={newRule.pricePerHour}
                  onChange={(e) => setNewRule({ ...newRule, pricePerHour: e.target.value })}
                  className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
                <input
                  type="time"
                  value={newRule.startTime}
                  onChange={(e) => setNewRule({ ...newRule, startTime: e.target.value })}
                  className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
                <input
                  type="time"
                  value={newRule.endTime}
                  onChange={(e) => setNewRule({ ...newRule, endTime: e.target.value })}
                  className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
                <button className="col-span-2 bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl font-bold transition">
                  + Thêm Khung Giá Động
                </button>
              </form>

              <div className="space-y-2">
                {pricingRules.map((r) => (
                  <div key={r.id} className="p-3 border border-slate-100 rounded-2xl flex justify-between items-center text-xs bg-slate-50">
                    <span>
                      Sân <strong>{r.court_type}</strong>: {r.start_time} → {r.end_time}
                    </span>
                    <div className="flex items-center gap-3">
                      <strong className="text-emerald-700 text-sm">
                        {Number(r.price_per_hour).toLocaleString()} ₫/h
                      </strong>
                      <button
                        type="button"
                        onClick={() => handleDeletePricingRule(r.id)}
                        className="text-red-500 hover:text-red-700 font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: KHO POS */}
        {tab === 'POS_INVENTORY' && tenant.enable_pos_module && (
          <div className="grid md:grid-cols-2 gap-6">
            <form onSubmit={handleCreateProduct} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
              <h2 className="font-extrabold text-slate-900 text-base">Thêm Sản phẩm F&B / Phụ kiện vào Kho</h2>
              <input
                type="text"
                required
                placeholder="Tên mặt hàng (VD: Nước Revive, Ống cầu Hải Yến)"
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
              <div className="grid grid-cols-3 gap-2.5">
                <select
                  value={newProduct.category}
                  onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                  className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                >
                  <option value="DRINK">Nước uống</option>
                  <option value="SHUTTLECOCK">Cầu lông</option>
                  <option value="RACKET_RENTAL">Thuê vợt</option>
                </select>
                <input
                  type="number"
                  required
                  placeholder="Đơn giá"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                  className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
                <input
                  type="number"
                  required
                  placeholder="Tồn kho"
                  value={newProduct.stockQuantity}
                  onChange={(e) => setNewProduct({ ...newProduct, stockQuantity: e.target.value })}
                  className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl text-xs font-bold transition">
                + Nhập Kho POS
              </button>
            </form>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-2.5">
              <h2 className="font-extrabold text-slate-900 text-base mb-2">Danh sách Tồn kho hiện tại</h2>
              {products.map((p) => (
                <div key={p.id} className="p-3.5 border border-slate-100 bg-slate-50 rounded-2xl flex justify-between items-center text-xs">
                  <div>
                    <strong className="text-slate-900">{p.name}</strong>
                    <span className="ml-2 text-[10px] bg-white border px-2 py-0.5 rounded-full font-bold text-slate-500">{p.category}</span>
                  </div>
                  <div>
                    Giá: <strong className="text-emerald-700">{Number(p.price).toLocaleString()} ₫</strong> • Tồn:{' '}
                    <strong className="text-slate-900">{p.stock_quantity}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: NHÂN VIÊN LỄ TÂN */}
        {tab === 'STAFF' && (
          <div className="grid md:grid-cols-2 gap-6">
            <form onSubmit={handleCreateStaff} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-3.5">
              <h2 className="font-extrabold text-slate-900 text-base">Cấp tài khoản Nhân viên Lễ tân (STAFF)</h2>
              <input
                type="text"
                required
                placeholder="Họ tên Lễ tân"
                value={newStaff.fullName}
                onChange={(e) => setNewStaff({ ...newStaff, fullName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
              <input
                type="email"
                required
                placeholder="Email đăng nhập"
                value={newStaff.email}
                onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
              <input
                type="text"
                required
                placeholder="Số điện thoại"
                value={newStaff.phone}
                onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
              <input
                type="password"
                required
                placeholder="Mật khẩu khởi tạo"
                value={newStaff.password}
                onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
              <button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl text-xs font-bold transition">
                + Cấp tài khoản Lễ tân
              </button>
            </form>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-2.5">
              <h2 className="font-extrabold text-slate-900 text-base mb-2">Danh sách Lễ tân của sân</h2>
              {staffList.map((st) => (
                <div key={st.id} className="p-3.5 border border-slate-100 bg-slate-50 rounded-2xl text-xs flex justify-between items-center">
                  <strong className="text-slate-900">{st.full_name}</strong>
                  <span className="text-slate-500">{st.email} • {st.phone}</span>
                </div>
              ))}
              {staffList.length === 0 && <p className="text-xs text-slate-400">Chưa có nhân viên lễ tân nào.</p>}
            </div>
          </div>
        )}

        {/* TAB 5: BÁO CÁO DOANH THU */}
        {tab === 'ANALYTICS' && analytics && (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                <p className="text-[11px] font-bold uppercase text-slate-400">Tổng Doanh Thu (Sân + POS)</p>
                <p className="text-2xl font-black text-emerald-600 mt-1">
                  {Number(analytics.summary.totalRevenue).toLocaleString()} ₫
                </p>
              </div>
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                <p className="text-[11px] font-bold uppercase text-slate-400">Doanh Thu Đặt Sân</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">
                  {Number(analytics.summary.courtRevenue).toLocaleString()} ₫
                </p>
              </div>
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                <p className="text-[11px] font-bold uppercase text-slate-400">Doanh Thu Bán Hàng POS</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">
                  {Number(analytics.summary.posRevenue).toLocaleString()} ₫
                </p>
              </div>
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                <p className="text-[11px] font-bold uppercase text-slate-400">Đơn Chờ Hoàn Tiền</p>
                <p className="text-2xl font-extrabold text-red-600 mt-1">
                  {analytics.summary.pendingRefundCount} đơn
                </p>
              </div>
            </div>

            {analytics.advancedAnalyticsEnabled && analytics.advancedData && (
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-3">
                  <h3 className="font-extrabold text-slate-900 text-sm">Doanh thu chi tiết theo từng Sân</h3>
                  {analytics.advancedData.revenueByCourt.map((rc, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl text-xs">
                      <span><strong>{rc.court_name}</strong> ({rc.type}) — {rc.total_bookings} ca đặt</span>
                      <strong className="text-emerald-700">{Number(rc.revenue).toLocaleString()} ₫</strong>
                    </div>
                  ))}
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-3">
                  <h3 className="font-extrabold text-slate-900 text-sm">Top sản phẩm POS bán chạy</h3>
                  {analytics.advancedData.topProducts.map((tp, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl text-xs">
                      <span><strong>{tp.name}</strong> (Đã bán: {tp.total_sold})</span>
                      <strong className="text-emerald-700">{Number(tp.revenue).toLocaleString()} ₫</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}