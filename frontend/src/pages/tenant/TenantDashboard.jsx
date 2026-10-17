import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';

export default function TenantDashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState('SETTINGS'); // 'SETTINGS' | 'COURTS_PRICING' | 'POS_INVENTORY' | 'STAFF' | 'ANALYTICS'
  const [tenant, setTenant] = useState(null);
  const [courts, setCourts] = useState([]);
  const [pricingRules, setPricingRules] = useState([]);
  const [products, setProducts] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  // Forms
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
  // eslint-disable-next-line
  fetchTenantData();
  }, []);

  // Lưu cấu hình Công tắc tính năng, Ưu đãi HSSV & VietQR
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

  // Tạo sân mới (PENDING chờ Super Admin duyệt)
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

  // Thêm khung giá động
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

  // Thêm sản phẩm kho POS
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

  // Tạo tài khoản Lễ tân
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

  if (!tenant) return <div className="p-8 text-center text-sm">Đang tải cấu hình Chủ sân...</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* HEADER */}
      <header className="bg-emerald-900 text-white px-6 py-4 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-xl font-bold">{tenant.name} - Quản trị Chủ Sân</h1>
          <p className="text-xs text-emerald-200">
            Tenant ID: {tenant.id} | Quận {tenant.district}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/staff')}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs"
          >
            → Mở Màn hình Lễ tân (Tạo vé Vãng lai/Sự kiện, POS & Hoàn tiền)
          </button>
          <button
            onClick={() => { logout(); navigate('/'); }}
            className="bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg text-xs font-semibold"
          >
            Đăng xuất
          </button>
        </div>
      </header>

      {/* MENU TABS (TỰ ĐỘNG ẨN/HIỆN MODULE POS THEO CÔNG TẮC) */}
      <div className="max-w-7xl mx-auto px-6 pt-6">
        <div className="flex flex-wrap gap-2 border-b pb-3">
          <button
            onClick={() => setTab('SETTINGS')}
            className={`px-4 py-2 rounded-lg text-xs font-bold ${tab === 'SETTINGS' ? 'bg-emerald-700 text-white' : 'bg-white border'}`}
          >
            1. Công tắc Tính năng, Ưu đãi HSSV & VietQR
          </button>
          <button
            onClick={() => setTab('COURTS_PRICING')}
            className={`px-4 py-2 rounded-lg text-xs font-bold ${tab === 'COURTS_PRICING' ? 'bg-emerald-700 text-white' : 'bg-white border'}`}
          >
            2. Quản lý Sân & Khung Giá Động
          </button>
          {tenant.enable_pos_module && (
            <button
              onClick={() => setTab('POS_INVENTORY')}
              className={`px-4 py-2 rounded-lg text-xs font-bold ${tab === 'POS_INVENTORY' ? 'bg-emerald-700 text-white' : 'bg-white border'}`}
            >
              3. Kho hàng POS (Nước & Cầu)
            </button>
          )}
          <button
            onClick={() => setTab('STAFF')}
            className={`px-4 py-2 rounded-lg text-xs font-bold ${tab === 'STAFF' ? 'bg-emerald-700 text-white' : 'bg-white border'}`}
          >
            4. Tài khoản Lễ tân
          </button>
          <button
            onClick={() => setTab('ANALYTICS')}
            className={`px-4 py-2 rounded-lg text-xs font-bold ${tab === 'ANALYTICS' ? 'bg-emerald-700 text-white' : 'bg-white border'}`}
          >
            5. Báo cáo Doanh thu
          </button>
        </div>

        {/* TAB 1: CÀI ĐẶT CÔNG TẮC TÍNH NĂNG, ƯU ĐÃI SINH VIÊN & VIETQR */}
        {tab === 'SETTINGS' && (
          <form onSubmit={handleSaveSettings} className="grid md:grid-cols-2 gap-6 py-6">
            <div className="bg-white p-5 rounded-xl border space-y-4">
              <h2 className="font-bold text-slate-800">Công tắc Bật/Tắt Module (Feature Toggles)</h2>
              <label className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border cursor-pointer">
                <span className="text-xs font-semibold">Bật tính năng Sân VIP (Cho phép tạo sân VIP giá cao)</span>
                <input
                  type="checkbox"
                  checked={tenant.enable_vip_courts}
                  onChange={(e) => setTenant({ ...tenant, enable_vip_courts: e.target.checked })}
                />
              </label>
              <label className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border cursor-pointer">
                <span className="text-xs font-semibold">Bật Module Bán hàng POS (Bán nước, cầu lông tại quầy)</span>
                <input
                  type="checkbox"
                  checked={tenant.enable_pos_module}
                  onChange={(e) => setTenant({ ...tenant, enable_pos_module: e.target.checked })}
                />
              </label>
              <label className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border cursor-pointer">
                <span className="text-xs font-semibold">Bật Báo cáo Thống kê Chuyên sâu</span>
                <input
                  type="checkbox"
                  checked={tenant.enable_advanced_analytics}
                  onChange={(e) => setTenant({ ...tenant, enable_advanced_analytics: e.target.checked })}
                />
              </label>

              <hr />
              <h2 className="font-bold text-slate-800">Chính sách Ưu đãi Học sinh / Sinh viên</h2>
              <div>
                <label className="block text-xs font-semibold mb-1">Chế độ áp dụng cho tài khoản Sinh viên</label>
                <select
                  value={tenant.student_discount_type}
                  onChange={(e) => setTenant({ ...tenant, student_discount_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="NONE">Không áp dụng ưu đãi</option>
                  <option value="SYSTEM_DEFAULT_20">Giảm theo mặc định hệ thống (20%)</option>
                  <option value="CUSTOM_FIXED_OFF">Trừ thẳng số tiền cố định trên mỗi ca (VNĐ)</option>
                  <option value="CUSTOM_FLAT_RATE">Đồng giá ưu đãi theo giờ (VNĐ/giờ)</option>
                </select>
              </div>
              {['CUSTOM_FIXED_OFF', 'CUSTOM_FLAT_RATE'].includes(tenant.student_discount_type) && (
                <div>
                  <label className="block text-xs font-semibold mb-1">Nhập số tiền (VNĐ)</label>
                  <input
                    type="number"
                    value={tenant.student_discount_value}
                    onChange={(e) => setTenant({ ...tenant, student_discount_value: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              )}
            </div>

            <div className="bg-white p-5 rounded-xl border space-y-4">
              <h2 className="font-bold text-slate-800">Tài khoản Ngân hàng nhận tiền 100% (VietQR)</h2>
              <div>
                <label className="block text-xs font-semibold mb-1">Mã Ngân hàng (VD: MB, VCB, TCB, ACB)</label>
                <input
                  type="text"
                  value={tenant.qr_bank_name || ''}
                  onChange={(e) => setTenant({ ...tenant, qr_bank_name: e.target.value })}
                  placeholder="MB"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Số tài khoản nhận tiền</label>
                <input
                  type="text"
                  value={tenant.qr_account_number || ''}
                  onChange={(e) => setTenant({ ...tenant, qr_account_number: e.target.value })}
                  placeholder="0987654321"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Tên chủ tài khoản</label>
                <input
                  type="text"
                  value={tenant.qr_account_name || ''}
                  onChange={(e) => setTenant({ ...tenant, qr_account_name: e.target.value })}
                  placeholder="NGUYEN VAN A"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg text-sm"
              >
                Lưu Toàn Bộ Cấu Hình Cụm Sân
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: QUẢN LÝ SÂN & GIÁ ĐỘNG */}
        {tab === 'COURTS_PRICING' && (
          <div className="grid md:grid-cols-2 gap-6 py-6">
            <div className="bg-white p-5 rounded-xl border space-y-4">
              <h2 className="font-bold text-slate-800">Tạo Sân mới (Chờ Super Admin duyệt)</h2>
              <form onSubmit={handleCreateCourt} className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Tên sân (VD: Sân 1)"
                  value={newCourt.name}
                  onChange={(e) => setNewCourt({ ...newCourt, name: e.target.value })}
                  className="flex-1 px-3 py-2 border rounded-lg text-sm"
                />
                <select
                  value={newCourt.type}
                  onChange={(e) => setNewCourt({ ...newCourt, type: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="STANDARD">STANDARD</option>
                  {tenant.enable_vip_courts && <option value="VIP">VIP</option>}
                </select>
                <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold">
                  + Tạo sân
                </button>
              </form>

              <div className="space-y-2">
                {courts.map((c) => (
                  <div key={c.id} className="p-3 border rounded-lg flex justify-between items-center text-xs">
                    <div>
                      <strong>{c.name}</strong> ({c.type}) — Trạng thái duyệt:{' '}
                      <span className="font-bold text-emerald-700">{c.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border space-y-4">
              <h2 className="font-bold text-slate-800">Cấu hình Giá động theo Khung giờ</h2>
              <form onSubmit={handleCreatePricingRule} className="grid grid-cols-2 gap-2 text-xs">
                <select
                  value={newRule.courtType}
                  onChange={(e) => setNewRule({ ...newRule, courtType: e.target.value })}
                  className="px-3 py-2 border rounded-lg"
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
                  className="px-3 py-2 border rounded-lg"
                />
                <input
                  type="time"
                  value={newRule.startTime}
                  onChange={(e) => setNewRule({ ...newRule, startTime: e.target.value })}
                  className="px-3 py-2 border rounded-lg"
                />
                <input
                  type="time"
                  value={newRule.endTime}
                  onChange={(e) => setNewRule({ ...newRule, endTime: e.target.value })}
                  className="px-3 py-2 border rounded-lg"
                />
                <button className="col-span-2 bg-slate-800 text-white py-2 rounded-lg font-bold">
                  + Thêm Khung Giá Động
                </button>
              </form>

              <div className="space-y-2">
                {pricingRules.map((r) => (
                  <div key={r.id} className="p-2.5 border rounded-lg flex justify-between text-xs bg-slate-50">
                    <span>
                      Sân <strong>{r.court_type}</strong>: {r.start_time} → {r.end_time}
                    </span>
                    <strong className="text-emerald-700">
                      {Number(r.price_per_hour).toLocaleString()}đ/giờ
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: QUẢN LÝ KHO POS */}
        {tab === 'POS_INVENTORY' && tenant.enable_pos_module && (
          <div className="py-6 grid md:grid-cols-2 gap-6">
            <form onSubmit={handleCreateProduct} className="bg-white p-5 rounded-xl border space-y-3">
              <h2 className="font-bold text-slate-800">Thêm Sản phẩm F&B / Phụ kiện vào Kho</h2>
              <input
                type="text"
                required
                placeholder="Tên mặt hàng (VD: Nước Revive, Ống cầu Hải Yến)"
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={newProduct.category}
                  onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-xs"
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
                  className="px-3 py-2 border rounded-lg text-xs"
                />
                <input
                  type="number"
                  required
                  placeholder="Tồn kho"
                  value={newProduct.stockQuantity}
                  onChange={(e) => setNewProduct({ ...newProduct, stockQuantity: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-xs"
                />
              </div>
              <button className="w-full bg-emerald-600 text-white py-2 rounded-lg text-xs font-bold">
                + Nhập Kho POS
              </button>
            </form>

            <div className="bg-white p-5 rounded-xl border space-y-2">
              <h2 className="font-bold text-slate-800 mb-2">Danh sách Tồn kho hiện tại</h2>
              {products.map((p) => (
                <div key={p.id} className="p-3 border rounded-lg flex justify-between text-xs">
                  <span>
                    <strong>{p.name}</strong> ({p.category})
                  </span>
                  <span>
                    Giá: <strong>{Number(p.price).toLocaleString()}đ</strong> | Tồn kho:{' '}
                    <strong>{p.stock_quantity}</strong>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: QUẢN LÝ NHÂN VIÊN LỄ TÂN */}
        {tab === 'STAFF' && (
          <div className="py-6 grid md:grid-cols-2 gap-6">
            <form onSubmit={handleCreateStaff} className="bg-white p-5 rounded-xl border space-y-3">
              <h2 className="font-bold text-slate-800">Tạo tài khoản Nhân viên Lễ tân (STAFF)</h2>
              <input
                type="text"
                required
                placeholder="Họ tên Lễ tân"
                value={newStaff.fullName}
                onChange={(e) => setNewStaff({ ...newStaff, fullName: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
              <input
                type="email"
                required
                placeholder="Email đăng nhập"
                value={newStaff.email}
                onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
              <input
                type="text"
                required
                placeholder="Số điện thoại"
                value={newStaff.phone}
                onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
              <input
                type="password"
                required
                placeholder="Mật khẩu"
                value={newStaff.password}
                onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
              <button className="w-full bg-emerald-600 text-white py-2 rounded-lg text-xs font-bold">
                + Cấp tài khoản Lễ tân
              </button>
            </form>

            <div className="bg-white p-5 rounded-xl border space-y-2">
              <h2 className="font-bold text-slate-800 mb-2">Danh sách Lễ tân của sân</h2>
              {staffList.map((st) => (
                <div key={st.id} className="p-3 border rounded-lg text-xs flex justify-between">
                  <strong>{st.full_name}</strong>
                  <span>{st.email} ({st.phone})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: BÁO CÁO DOANH THU */}
        {tab === 'ANALYTICS' && analytics && (
          <div className="py-6 space-y-6">
            <div className="grid md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border">
                <p className="text-xs text-slate-500">TỔNG DOANH THU (SÂN + POS)</p>
                <p className="text-xl font-extrabold text-emerald-700">
                  {Number(analytics.summary.totalRevenue).toLocaleString()}đ
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl border">
                <p className="text-xs text-slate-500">DOANH THU ĐẶT SÂN</p>
                <p className="text-xl font-bold text-slate-800">
                  {Number(analytics.summary.courtRevenue).toLocaleString()}đ
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl border">
                <p className="text-xs text-slate-500">DOANH THU POS TẠI QUẦY</p>
                <p className="text-xl font-bold text-slate-800">
                  {Number(analytics.summary.posRevenue).toLocaleString()}đ
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl border">
                <p className="text-xs text-slate-500">ĐƠN CHỜ HOÀN TIỀN</p>
                <p className="text-xl font-bold text-red-600">
                  {analytics.summary.pendingRefundCount} đơn
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}