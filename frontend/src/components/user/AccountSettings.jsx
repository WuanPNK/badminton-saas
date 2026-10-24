export default function AccountSettings({
  user,
  accountSection,
  setAccountSection,
  profileForm,
  setProfileForm,
  passwordForm,
  setPasswordForm,
  accountMsg,
  setAccountMsg,
  savingAccount,
  handleSaveProfile,
  handleChangePassword,
  handleStudentCardUpload,
  renderStudentBadge,
  myBookings,
  setCancelModalBooking,
  setReviewModalBooking,
  setActiveTab,
  onLogout,
}) {
  return (
    <div className="grid lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-800 text-white font-black text-2xl flex items-center justify-center shadow">
              {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">{user?.fullName}</h3>
              <p className="text-xs text-slate-500">{user?.email}</p>
              <div className="mt-1.5">{renderStudentBadge()}</div>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200/80 space-y-4 text-xs">
          <div>
            <p className="px-3 text-[11px] font-extrabold uppercase text-emerald-800 mb-2">
              Tài khoản & Bảo mật
            </p>
            <div className="space-y-1">
              <button
                onClick={() => {
                  setAccountSection('PROFILE');
                  setAccountMsg({ type: '', text: '' });
                }}
                className={`w-full flex justify-between items-center px-3.5 py-3 rounded-2xl font-bold transition ${
                  accountSection === 'PROFILE'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span>👤 Thông tin cá nhân & Thẻ HSSV</span>
                <span>›</span>
              </button>

              <button
                onClick={() => {
                  setAccountSection('PASSWORD');
                  setAccountMsg({ type: '', text: '' });
                }}
                className={`w-full flex justify-between items-center px-3.5 py-3 rounded-2xl font-bold transition ${
                  accountSection === 'PASSWORD'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span>🔒 Đổi mật khẩu tài khoản</span>
                <span>›</span>
              </button>
            </div>
          </div>

          <div>
            <p className="px-3 text-[11px] font-extrabold uppercase text-emerald-800 mb-2">
              Hoạt động
            </p>
            <button
              onClick={() => setAccountSection('BOOKINGS')}
              className={`w-full flex justify-between items-center px-3.5 py-3 rounded-2xl font-bold transition ${
                accountSection === 'BOOKINGS'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <span>📅 Danh sách lịch đã đặt</span>
              <span>›</span>
            </button>
          </div>

          <div>
            <p className="px-3 text-[11px] font-extrabold uppercase text-emerald-800 mb-2">
              Hệ thống
            </p>
            <div className="space-y-1">
              <button
                onClick={() => setAccountSection('TERMS')}
                className={`w-full flex justify-between items-center px-3.5 py-3 rounded-2xl font-bold transition ${
                  accountSection === 'TERMS'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span>🛡️ Điều khoản và chính sách</span>
                <span>›</span>
              </button>

              <div className="flex justify-between items-center px-3.5 py-2.5 text-slate-500">
                <span>ℹ️ Thông tin phiên bản</span>
                <span className="font-mono font-semibold text-slate-700">v2.1.0 SaaS</span>
              </div>

              <div className="flex justify-between items-center px-3.5 py-2.5 text-slate-500">
                <span>🌐 Ngôn ngữ</span>
                <span className="font-semibold text-slate-700">Tiếng Việt</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <button
              onClick={onLogout}
              className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-extrabold py-3 rounded-2xl transition"
            >
              Đăng xuất khỏi hệ thống
            </button>
          </div>
        </div>
      </div>

      <div className="lg:col-span-8 bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200/80">
        {accountMsg.text && (
          <div
            className={`p-3.5 rounded-2xl text-xs mb-5 font-bold flex items-center gap-2 ${
              accountMsg.type === 'error'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            }`}
          >
            <span>{accountMsg.type === 'error' ? '⚠️' : '✅'}</span>
            <span>{accountMsg.text}</span>
          </div>
        )}

        {accountSection === 'PROFILE' && (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-lg font-extrabold text-slate-900">
                Thông tin cá nhân & Ưu đãi Học sinh / Sinh viên
              </h2>
              <p className="text-xs text-slate-500">
                Quản lý họ tên, số điện thoại liên hệ và hồ sơ xác thực thẻ sinh viên
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Họ và tên
                </label>
                <input
                  type="text"
                  required
                  value={profileForm.fullName}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, fullName: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số điện thoại
                </label>
                <input
                  type="text"
                  required
                  value={profileForm.phone}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, phone: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Địa chỉ Email (Không thể thay đổi)
              </label>
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500"
              />
            </div>

            <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-extrabold text-emerald-950">
                  🎓 Trạng thái Ưu đãi Học sinh / Sinh viên
                </span>
                {renderStudentBadge()}
              </div>

              {user?.studentStatus !== 'VERIFIED' && (
                <div className="space-y-2">
                  <p className="text-xs text-emerald-800">
                    Tải lên ảnh chụp Thẻ Học sinh / Sinh viên để Super Admin phê duyệt giảm giá tự động khi đặt sân:
                  </p>
                  <label className="flex flex-col items-center justify-center w-full p-4 bg-white border-2 border-dashed border-emerald-300 rounded-xl cursor-pointer hover:bg-emerald-50/40 transition">
                    {profileForm.studentCardImage ? (
                      <div className="text-center space-y-2">
                        <img
                          src={profileForm.studentCardImage}
                          alt="Preview"
                          className="max-h-32 mx-auto rounded-lg border"
                        />
                        <p className="text-xs font-bold text-emerald-700">
                          ✓ {profileForm.studentCardFileName}
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-1">
                        <span className="text-xl">📷</span>
                        <p className="text-xs font-bold text-emerald-800 mt-1">
                          Bấm để chọn ảnh Thẻ Sinh viên từ máy
                        </p>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleStudentCardUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* THÔNG TIN TÀI KHOẢN NGÂN HÀNG HOÀN TIỀN */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
              <div>
                <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <span>🏦</span>
                  <span>Tài khoản Ngân hàng nhận tiền hoàn (Khi hủy lịch trước 24h)</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Thông tin này sẽ được tự động điền khi bạn yêu cầu hủy sân để nhận hoàn 100% tiền sân nhanh chóng.
                </p>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tên Ngân hàng</label>
                  <input
                    type="text"
                    placeholder="VD: MB Bank, Techcombank..."
                    value={profileForm.bankName || ''}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, bankName: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Số tài khoản (STK)</label>
                  <input
                    type="text"
                    placeholder="VD: 19034889928282"
                    value={profileForm.bankAccountNumber || ''}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, bankAccountNumber: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tên chủ tài khoản</label>
                  <input
                    type="text"
                    placeholder="VD: NGUYEN VAN A"
                    value={profileForm.bankAccountName || ''}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, bankAccountName: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs uppercase font-bold"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingAccount}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl text-xs transition shadow-sm"
            >
              {savingAccount ? 'Đang lưu...' : '💾 Lưu thay đổi hồ sơ'}
            </button>
          </form>
        )}

        {accountSection === 'PASSWORD' && (
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-lg font-extrabold text-slate-900">Đổi mật khẩu tài khoản</h2>
              <p className="text-xs text-slate-500">
                Vui lòng nhập mật khẩu hiện tại và xác nhận mật khẩu mới
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mật khẩu hiện tại
              </label>
              <input
                type="password"
                required
                value={passwordForm.currentPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                }
                placeholder="Nhập mật khẩu đang sử dụng"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mật khẩu mới (Tối thiểu 6 ký tự)
              </label>
              <input
                type="password"
                required
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                }
                placeholder="Nhập mật khẩu mới"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nhập lại mật khẩu mới
              </label>
              <input
                type="password"
                required
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                }
                placeholder="Xác nhận lại mật khẩu mới"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>

            {passwordForm.confirmPassword &&
              passwordForm.newPassword !== passwordForm.confirmPassword && (
                <p className="text-xs text-red-600 font-semibold">
                  ⚠️ Mật khẩu nhập lại không khớp!
                </p>
              )}

            <button
              type="submit"
              disabled={savingAccount}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl text-xs transition shadow-sm"
            >
              {savingAccount ? 'Đang cập nhật...' : '🔒 Cập nhật mật khẩu mới'}
            </button>
          </form>
        )}

        {accountSection === 'BOOKINGS' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-lg font-extrabold text-slate-900">Danh sách đặt lịch</h2>
              <button
                onClick={() => setActiveTab('MY_BOOKINGS')}
                className="text-xs font-bold text-emerald-700 hover:underline"
              >
                Mở chế độ toàn màn hình →
              </button>
            </div>

            {myBookings.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-400">
                Bạn chưa có lịch đặt
              </div>
            ) : (
              <div className="space-y-3">
                {myBookings.map((b) => (
                  <div
                    key={b.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 flex flex-wrap justify-between items-center gap-3 text-xs"
                  >
                    <div>
                      <div className="font-extrabold text-slate-900 text-sm">
                        {b.tenant_name} — {b.court_name}
                      </div>
                      <div className="text-slate-600 mt-0.5">
                        {new Date(b.start_time).toLocaleDateString('vi-VN')} {new Date(b.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })} • Mã: #{b.booking_code}
                      </div>
                      <div className="font-bold text-emerald-700 mt-1">
                        {Number(b.final_price).toLocaleString()} ₫ ({b.status})
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {b.status === 'CONFIRMED' && (
                        <button
                          onClick={() => setCancelModalBooking(b)}
                          className="bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 rounded-xl font-bold"
                        >
                          Hủy & Hoàn tiền
                        </button>
                      )}
                      {b.status === 'COMPLETED' && !b.has_reviewed && (
                        <button
                          onClick={() => setReviewModalBooking(b)}
                          className="bg-amber-500 text-slate-950 px-3 py-1.5 rounded-xl font-bold"
                        >
                          ★ Đánh giá
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {accountSection === 'TERMS' && (
          <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
            <h2 className="text-lg font-extrabold text-slate-900 mb-2">
              Điều khoản và Chính sách Đặt lịch
            </h2>
            <p>
              <strong>1. Quy định đặt lịch theo block 30 phút:</strong> Mọi lượt đặt sân trực quan đều được tính theo bội số 30 phút (tối thiểu 60 phút/ca) và tự động tính giá động theo khung giờ của từng cụm sân.
            </p>
            <p>
              <strong>2. Chính sách hoàn tiền 100%:</strong> Khách hàng hủy lịch đặt trước giờ bắt đầu chơi tối thiểu <strong>24 giờ</strong> sẽ được hoàn lại 100% số tiền đã thanh toán vào tài khoản ngân hàng cung cấp.
            </p>
            <p>
              <strong>3. Chính sách Học sinh / Sinh viên:</strong> Tài khoản có thẻ HSSV ở trạng thái <code>VERIFIED</code> được hệ thống tự động khấu trừ ưu đãi trên mọi khung giờ theo cấu hình của chủ sân.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
