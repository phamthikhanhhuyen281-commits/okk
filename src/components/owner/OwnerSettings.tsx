import React, { useState } from 'react';
import { ShieldCheck, Lock, CheckCircle2, AlertTriangle, Key, User, Phone, RefreshCw } from 'lucide-react';
import { getStoredPasswords, saveUserPassword, resetSystemData, addSecurityLog } from '../../data/mockData';
import { User as UserType } from '../../types';

interface OwnerSettingsProps {
  currentUser: UserType | null;
  onUpdateProfile: (updated: UserType) => void;
  language?: 'vi' | 'en';
}

export default function OwnerSettings({ currentUser, onUpdateProfile, language = 'vi' }: OwnerSettingsProps) {
  const isVi = language === 'vi';

  // Profile settings
  const [name, setName] = useState(currentUser?.name || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Password settings
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // System actions
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess(false);

    const cleanPhone = phone.trim();
    if (!name.trim() || !cleanPhone) {
      alert(isVi ? 'Vui lòng nhập đầy đủ Họ tên và Số điện thoại!' : 'Please enter full Name and Phone number!');
      return;
    }

    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(cleanPhone)) {
      alert(isVi ? 'Số điện thoại phải bao gồm đúng 10 chữ số!' : 'Phone number must contain exactly 10 digits!');
      return;
    }

    if (currentUser) {
      const updatedUser: UserType = {
        ...currentUser,
        name: name.trim(),
        phone: phone.trim()
      };
      
      onUpdateProfile(updatedUser);
      setProfileSuccess(true);
      addSecurityLog(
        isVi ? 'Cập nhật hồ sơ Owner' : 'Owner profile update', 
        isVi ? `Đã cập nhật họ tên thành "${name.trim()}" và SĐT thành "${phone.trim()}"` : `Updated name to "${name.trim()}" and phone to "${phone.trim()}"`
      );
      
      setTimeout(() => {
        setProfileSuccess(false);
      }, 4000);
    }
  };

  const handleSubmitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setStatusMessage({ 
        text: isVi ? '⚠️ Vui lòng nhập đầy đủ các trường thông tin.' : '⚠️ Please fill out all fields.', 
        isError: true 
      });
      return;
    }

    if (newPassword.length < 6) {
      setStatusMessage({ 
        text: isVi ? '⚠️ Mật khẩu mới phải có ít nhất 6 ký tự.' : '⚠️ New password must be at least 6 characters.', 
        isError: true 
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatusMessage({ 
        text: isVi ? '⚠️ Mật khẩu xác nhận không khớp.' : '⚠️ Password confirmation does not match.', 
        isError: true 
      });
      return;
    }

    const passwords = getStoredPasswords();
    const ownerEmail = currentUser?.email || 'phamthikhanhhuyen281@gmail.com';
    const storedPassword = passwords[ownerEmail] || 'HuyenOwner@2026';

    if (currentPassword !== storedPassword) {
      setStatusMessage({ 
        text: isVi ? '❌ Mật khẩu hiện tại không chính xác.' : '❌ Current password is incorrect.', 
        isError: true 
      });
      return;
    }

    // Save the new password
    saveUserPassword(ownerEmail, newPassword);
    addSecurityLog(
      isVi ? 'Thay đổi mật khẩu Owner' : 'Owner password change', 
      isVi ? 'Mật khẩu đăng nhập của Owner tối cao đã được đặt lại thành công' : 'Master credential password was reset successfully'
    );
    
    // Reset inputs
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');

    setStatusMessage({ 
      text: isVi 
        ? '🎉 Đã cập nhật mật khẩu của Chủ hệ thống (Owner) thành công! Hãy ghi nhớ mật khẩu mới này.' 
        : '🎉 Successfully updated Supreme Owner password! Please remember this new master key.', 
      isError: false 
    });
  };

  const handleSystemReset = () => {
    const confirmationText = isVi 
      ? '🚨 CẢNH BÁO NGUY HIỂM!\nBạn có chắc chắn muốn khôi phục toàn bộ hệ thống về trạng thái mặc định ban đầu?\nMọi dữ liệu học viên, đề thi, lớp học tự tạo, kết quả thi và mật khẩu cũ của người dùng khác sẽ bị XÓA SẠCH.'
      : '🚨 EXTREME WARNING!\nAre you sure you want to restore the database to standard factory defaults?\nAll custom classes, student accounts, active exams, exam records, and custom passwords will be permanently deleted.';

    if (confirm(confirmationText)) {
      setIsResetting(true);
      setTimeout(() => {
        resetSystemData();
        addSecurityLog(
          isVi ? 'Khôi phục hệ thống' : 'Core system reset', 
          isVi ? 'Owner đã kích hoạt lệnh Factory Reset khôi phục dữ liệu ban đầu' : 'Supreme Owner executed Factory Reset database partition'
        );
        setIsResetting(false);
        setResetSuccess(true);
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }, 1200);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
      {/* COLUMN 1 & 2: PROFILE AND PASSWORD SETTINGS */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Form 1: Owner Profile Information */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-50 pb-4 mb-5">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <User size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">
                {isVi ? 'Hồ sơ cá nhân Chủ hệ thống (Owner)' : 'System Owner Personal Profile'}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isVi ? 'Cập nhật thông tin định danh hiển thị trên thanh tiêu đề và hóa đơn' : 'Update identification details shown on headers and reports'}
              </p>
            </div>
          </div>

          {profileSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-xs mb-5 flex items-start gap-2.5">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600" />
              <span>
                {isVi 
                  ? '🎉 Cập nhật hồ sơ thành công! Thông tin cá nhân mới đã được lưu trữ và áp dụng trực tiếp lên hệ thống.' 
                  : '🎉 Profile updated successfully! Your details have been saved and applied.'}
              </span>
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">{isVi ? 'Họ và Tên' : 'Full Name'}</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                    <User size={14} />
                  </span>
                  <input 
                    type="text" 
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={isVi ? "Nhập tên của bạn..." : "Enter your full name..."}
                    className="block w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all" 
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">{isVi ? 'Số điện thoại liên hệ' : 'Contact Phone Number'}</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                    <Phone size={14} />
                  </span>
                  <input 
                    type="text" 
                    required
                    value={phone}
                    maxLength={10}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setPhone(val);
                    }}
                    placeholder={isVi ? "Nhập số điện thoại liên lạc..." : "Enter your phone number..."}
                    className="block w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all" 
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                {isVi ? 'Email quản trị (Bảo vệ cứng - Không được đổi)' : 'Administrator Email (Hardlocked - Cannot change)'}
              </label>
              <input 
                type="text" 
                disabled
                value={currentUser?.email || 'phamthikhanhhuyen281@gmail.com'}
                className="block w-full px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-semibold cursor-not-allowed" 
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button 
                type="submit" 
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs shadow-md shadow-indigo-500/10 transition-all cursor-pointer"
              >
                {isVi ? 'Lưu hồ sơ cá nhân' : 'Save Personal Profile'}
              </button>
            </div>
          </form>
        </div>

        {/* Form 2: Change Password */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-50 pb-4 mb-5">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <Key size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">
                {isVi ? 'Đổi mật khẩu Chủ sở hữu (Owner)' : 'Change Master Owner Password'}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isVi ? 'Đặt lại mật khẩu tối mật để đăng nhập quyền tối thượng' : 'Reset the supreme key to secure system administrative access'}
              </p>
            </div>
          </div>

          {statusMessage && (
            <div className={`p-4 rounded-xl text-xs mb-5 flex items-start gap-2.5 border ${
              statusMessage.isError 
                ? 'bg-rose-50 border-rose-100 text-red-700' 
                : 'bg-emerald-50 border-emerald-100 text-emerald-800'
            }`}>
              {statusMessage.isError ? <AlertTriangle size={16} className="shrink-0 mt-0.5 animate-bounce" /> : <CheckCircle2 size={16} className="shrink-0 mt-0.5" />}
              <span>{statusMessage.text}</span>
            </div>
          )}

          <form onSubmit={handleSubmitPassword} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">{isVi ? 'Mật khẩu hiện tại' : 'Current Password'}</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <Lock size={14} />
                </span>
                <input 
                  type="password" 
                  required
                  placeholder={isVi ? "Nhập mật khẩu hiện tại..." : "Enter current password..."}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all" 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">{isVi ? 'Mật khẩu mới' : 'New Password'}</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                    <Lock size={14} />
                  </span>
                  <input 
                    type="password" 
                    required
                    placeholder={isVi ? "Mật khẩu mới (ít nhất 6 ký tự)..." : "New password (at least 6 chars)..."}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="block w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all" 
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">{isVi ? 'Xác nhận mật khẩu mới' : 'Confirm New Password'}</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                    <Lock size={14} />
                  </span>
                  <input 
                    type="password" 
                    required
                    placeholder={isVi ? "Xác nhận lại mật khẩu mới..." : "Confirm your new password..."}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all" 
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-50 flex justify-end">
              <button 
                type="submit" 
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs shadow-md shadow-blue-500/10 transition-all cursor-pointer"
              >
                {isVi ? 'Cập nhật mật khẩu Owner' : 'Update Owner Password'}
              </button>
            </div>
          </form>
        </div>

        {/* System Reset Section */}
        <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-rose-100 pb-4 mb-4">
            <div className="w-10 h-10 bg-rose-100 text-rose-700 rounded-xl flex items-center justify-center font-bold text-lg">
              ⚠️
            </div>
            <div>
              <h3 className="font-extrabold text-rose-900 text-sm">
                {isVi ? 'Cơ chế Khôi phục Cài đặt Gốc' : 'Factory Reset Database Protocol'}
              </h3>
              <p className="text-[11px] text-rose-500 mt-0.5">
                {isVi ? 'Khôi phục cơ sở dữ liệu mẫu về trạng thái chuẩn từ hệ thống.' : 'Restore the default reference dataset back to a pristine state.'}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
            <p className="text-slate-600 leading-normal max-w-lg">
              {isVi 
                ? 'Nếu thông tin trong hệ thống bị sai lệch do quá trình thay đổi trong local storage, bạn có thể thực hiện lệnh khôi phục để đưa dữ liệu IELTS về trạng thái chuẩn ban đầu.'
                : 'If internal application state has drifted or suffered incorrect data alterations locally, you may reset to restore standard curated ielts resources.'}
            </p>
            <button
              onClick={handleSystemReset}
              disabled={isResetting || resetSuccess}
              className={`px-5 py-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 border shadow-sm shrink-0 transition-all cursor-pointer ${
                resetSuccess 
                  ? 'bg-emerald-600 border-emerald-600 text-white cursor-not-allowed'
                  : 'bg-white hover:bg-rose-50 border-rose-200 text-rose-700 active:scale-95'
              }`}
            >
              {isResetting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  {isVi ? 'Đang khôi phục...' : 'Restoring...'}
                </>
              ) : resetSuccess ? (
                <>
                  <CheckCircle2 size={14} />
                  {isVi ? 'Hoàn thành! Đang tải lại...' : 'Done! Reloading...'}
                </>
              ) : (
                <>
                  <RefreshCw size={14} />
                  {isVi ? 'Khôi phục dữ liệu gốc' : 'Restore Default Data'}
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* COLUMN 3: SECURITY INFO GUIDELINES */}
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-6 border border-slate-800 shadow-lg">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-extrabold uppercase tracking-widest mb-4">
            <ShieldCheck size={12} className="text-indigo-300" />
            {isVi ? 'CHỈ THỊ AN TOÀN TỐI CAO' : 'MASTER SECURITY PROTOCOL'}
          </span>
          <h4 className="font-extrabold text-sm tracking-tight mb-2">
            {isVi ? 'Đặc Quyền Owner' : 'Supreme Owner Credentials'}
          </h4>
          <p className="text-[11px] text-slate-300 leading-normal mb-3">
            {isVi 
              ? <>Tài khoản của bạn (<strong className="text-white">{currentUser?.email || 'phamthikhanhhuyen281@gmail.com'}</strong>) là tài khoản tối thượng duy nhất điều khiển toàn bộ hệ thống.</>
              : <>Your account (<strong className="text-white">{currentUser?.email || 'phamthikhanhhuyen281@gmail.com'}</strong>) holds supreme administrative master rights to administer this entire platform.</>}
          </p>
          <div className="space-y-2.5 text-[10.5px] text-slate-400 leading-relaxed border-t border-white/10 pt-3">
            <p>🔒 <strong>{isVi ? 'Chống đăng ký khống:' : 'Anti-cloning:'}</strong> {isVi ? 'Hệ thống đã khóa cứng, cấm mọi người dùng thông thường đăng ký bằng email của bạn.' : 'The system prevents standard users from registering or forging access via your Master Email.'}</p>
            <p>🔑 <strong>{isVi ? 'Độ tin cậy:' : 'Flexibility:'}</strong> {isVi ? 'Có thể tự do thay đổi Họ tên, Số điện thoại và Mật khẩu ở mẫu này để tăng tính cá nhân hóa.' : 'You can freely personalize name, phone number, and password credentials within this page.'}</p>
            <p>🛡️ <strong>{isVi ? 'Miễn nhiễm xóa bỏ:' : 'Absolute Immunity:'}</strong> {isVi ? 'Tài khoản này không hiển thị trên danh sách quản trị viên thông thường và không thể bị khóa bởi bất kỳ ai.' : 'The primary Owner account remains isolated from general search registries and is fully immune to lockouts.'}</p>
          </div>
        </div>

        {/* Live Security Parameters */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4">
          <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-50 pb-2">
            {isVi ? 'Thông số máy chủ lõi' : 'Core Server Parameters'}
          </h4>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">Database Provider</span>
              <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[10px]">Firestore Secure Partition</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">{isVi ? 'Mã hóa định danh' : 'Identity Security'}</span>
              <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[10px]">AES-256 & Argon2</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">{isVi ? 'Trạng thái kết nối' : 'Connection State'}</span>
              <span className="font-bold text-emerald-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                {isVi ? 'An toàn (Secure)' : 'Secure Connection'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
