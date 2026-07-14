import React, { useState } from 'react';
import { User, ShieldAlert, CheckCircle } from 'lucide-react';
import { User as UserType } from '../../types';
import { saveUserPassword } from '../../data/mockData';
import { Language, translations } from '../../data/translations';
import ThemeLanguageSelector from '../ThemeLanguageSelector';

interface RegisterFormProps {
  onRegisterSuccess: (newUser: UserType) => void;
  onNavigateToLogin: () => void;
  users: UserType[];
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  language: Language;
  setLanguage: (language: Language) => void;
}

export default function RegisterForm({ 
  onRegisterSuccess, 
  onNavigateToLogin, 
  users,
  theme,
  setTheme,
  language,
  setLanguage
}: RegisterFormProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const [isSevereWarning, setIsSevereWarning] = useState(false);

  const t = translations[language];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSevereWarning(false);

    // Validations
    if (!name.trim()) {
      setError(language === 'vi' ? 'Vui lòng nhập Họ và tên.' : 'Please enter your full name.');
      return;
    }
    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      setError(language === 'vi' ? 'Vui lòng nhập Số điện thoại.' : 'Please enter your phone number.');
      return;
    }
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(cleanPhone)) {
      setError(language === 'vi' ? 'Số điện thoại phải bao gồm đúng 10 chữ số.' : 'Phone number must contain exactly 10 digits.');
      return;
    }
    if (!email.trim()) {
      setError(language === 'vi' ? 'Vui lòng nhập Email.' : 'Please enter your email.');
      return;
    }
    if (!password) {
      setError(language === 'vi' ? 'Vui lòng nhập Mật khẩu.' : 'Please enter your password.');
      return;
    }
    if (password.length < 6) {
      setError(language === 'vi' ? 'Mật khẩu phải chứa ít nhất 6 ký tự.' : 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError(language === 'vi' ? 'Mật khẩu xác nhận không khớp.' : 'Passwords do not match.');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const isSystemOwner = cleanEmail === 'phamthikhanhhuyen281@gmail.com';
    const isExistingAdminOrOwner = users.some(u => u.email.toLowerCase() === cleanEmail && (u.role === 'admin' || u.role === 'owner'));

    if (isSystemOwner || isExistingAdminOrOwner) {
      setError(language === 'vi' 
        ? '🚨 CẢNH BÁO XÂM PHẠM QUYỀN HẠN: Địa chỉ email này thuộc về Ban Quản Trị / Chủ Sở Hữu (Admin/Owner) tối cao của hệ thống! Bạn KHÔNG ĐƯỢC PHÉP tự ý đăng ký hoặc giả mạo tài khoản quản trị.' 
        : '🚨 ACCESS BREACH WARNING: This email address belongs to the system Administrator / Owner! You are NOT ALLOWED to register or spoof a management account.'
      );
      setIsSevereWarning(true);
      return;
    }

    // Email/Phone uniqueness check
    const emailExists = users.some(u => u.email.toLowerCase() === cleanEmail);
    const phoneExists = users.some(u => u.phone === phone.trim());

    if (emailExists) {
      setError(language === 'vi' ? 'Email này đã được đăng ký trên hệ thống.' : 'This email is already registered.');
      return;
    }
    if (phoneExists) {
      setError(language === 'vi' ? 'Số điện thoại này đã được đăng ký trên hệ thống.' : 'This phone number is already registered.');
      return;
    }

    setIsLoading(true);

    // Simulate database write in 1000ms
    setTimeout(() => {
      setIsLoading(false);
      setIsSuccess(true);

      const newStudent: UserType = {
        id: `user-student-${Date.now()}`,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        role: 'student',
        status: 'active',
        createdAt: new Date().toISOString().split('T')[0]
      };

      // Save password securely
      saveUserPassword(email.trim(), password);

      // Show success screen for 1.2s then proceed to portal
      setTimeout(() => {
        onRegisterSuccess(newStudent);
      }, 1200);
    }, 1000);
  };

  if (isSuccess) {
    return (
      <div id="register_success_container" className="bg-white dark:bg-slate-900 w-full max-w-md p-8 text-center space-y-6 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 transition-colors duration-200">
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto text-3xl animate-bounce">
          ✓
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {language === 'vi' ? 'Đăng Ký Thành Công!' : 'Registration Successful!'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            {language === 'vi' ? (
              <>Tài khoản của bạn (<strong className="text-slate-700 dark:text-slate-200">{email}</strong>) đã được lưu thành công vào cơ sở dữ liệu hệ thống.</>
            ) : (
              <>Your account (<strong className="text-slate-700 dark:text-slate-200">{email}</strong>) has been successfully stored in the central database.</>
            )}
          </p>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs text-slate-500 dark:text-slate-400 leading-normal border border-slate-100 dark:border-slate-800">
          {language === 'vi' ? (
            <>Hệ thống đang tự động khởi tạo lớp học mẫu và chuyển hướng bạn đến <strong>Cổng Học Viên</strong>...</>
          ) : (
            <>System is automatically initializing demo classes and redirecting you to the <strong>Student Portal</strong>...</>
          )}
        </div>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-md">
      {/* Floating Theme / Language Selector card */}
      <div className="flex justify-end items-center bg-white/80 dark:bg-slate-900/80 backdrop-blur px-4 py-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm transition-colors duration-200">
        <ThemeLanguageSelector
          theme={theme}
          setTheme={setTheme}
          language={language}
          setLanguage={setLanguage}
        />
      </div>

      <div id="register_card_container" className="bg-white dark:bg-slate-900 w-full rounded-2xl overflow-hidden shadow-xl border border-slate-100 dark:border-slate-800/80 transition-colors duration-200">
        {/* Brand Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-8 py-8 text-white relative text-center">
          <span className="inline-flex items-center justify-center bg-white/20 px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase mb-3">
            {language === 'vi' ? 'Cổng Học Viên Mới' : 'NEW STUDENT GATEWAY'}
          </span>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight uppercase">{t.registerButton}</h2>
          <p className="text-indigo-100 text-xs mt-1">{language === 'vi' ? 'Gia nhập cộng đồng luyện thi IELTS trực tuyến đạt chuẩn' : 'Join our high-achieving online IELTS preparation academy'}</p>
        </div>

        <div className="p-8">
          {isSevereWarning ? (
            <div id="register_severe_warning" className="mb-5 p-5 bg-red-950 border-2 border-red-500 rounded-2xl text-red-100 text-xs space-y-3 animate-pulse shadow-lg shadow-red-950/50">
              <div className="flex items-center gap-2.5 text-red-400 font-extrabold uppercase tracking-widest text-[11px]">
                <span className="text-xl">🚨</span>
                <span>{t.severeWarningTitle}</span>
              </div>
              <p className="font-semibold text-red-200 leading-relaxed text-xs">
                {t.severeWarningRegDesc}
              </p>
              <div className="bg-red-900/40 p-2.5 rounded-lg border border-red-800/60 text-[10px] sm:text-[11px] font-mono space-y-1">
                <div>• Email: {email}</div>
                <div>• {t.statusLabel}: {t.severeWarningRegAction}</div>
                <div>• {t.deviceLabel}: {navigator.userAgent.slice(0, 40)}...</div>
              </div>
              <p className="text-[10px] sm:text-[11px] text-red-400 leading-normal font-extrabold">
                {t.severeWarningRegFooter}
              </p>
            </div>
          ) : error && (
            <div id="register_error" className="mb-5 p-3.5 bg-red-50 dark:bg-red-950/40 border-l-4 border-red-500 rounded-lg text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
              <ShieldAlert size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                {language === 'vi' ? 'Họ và tên' : 'Full Name'} <span className="text-red-500">*</span>
              </label>
              <input
                id="register_name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={language === 'vi' ? 'Ví dụ: Nguyễn Văn A' : 'e.g. John Doe'}
                className="block w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-850 transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                {language === 'vi' ? 'Số điện thoại' : 'Phone Number'} <span className="text-red-500">*</span>
              </label>
              <input
                id="register_phone"
                type="tel"
                required
                value={phone}
                maxLength={10}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setPhone(val);
                }}
                placeholder={language === 'vi' ? 'Ví dụ: 0912345678' : 'e.g. 0912345678'}
                className="block w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-850 transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                {language === 'vi' ? 'Địa chỉ Email' : 'Email Address'} <span className="text-red-500">*</span>
              </label>
              <input
                id="register_email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="block w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-850 transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                {t.passwordLabel} <span className="text-red-500">*</span>
              </label>
              <input
                id="register_password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={language === 'vi' ? 'Tối thiểu 6 ký tự' : 'Minimum 6 characters'}
                className="block w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-850 transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                {language === 'vi' ? 'Xác nhận mật khẩu' : 'Confirm Password'} <span className="text-red-500">*</span>
              </label>
              <input
                id="register_confirm_password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={language === 'vi' ? 'Nhập lại mật khẩu phía trên' : 'Re-enter your password'}
                className="block w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-850 transition-all text-sm"
              />
            </div>

            <button
              id="register_submit_btn"
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300 disabled:cursor-not-allowed transition-all shadow-indigo-500/10 cursor-pointer"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {language === 'vi' ? 'Đang tạo tài khoản...' : 'Creating account...'}
                </span>
              ) : (
                <>
                  {language === 'vi' ? 'Đăng Ký Ngay' : 'Register Now'} <CheckCircle size={16} />
                </>
              )}
            </button>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-slate-900 px-2 text-slate-400 dark:text-slate-500 font-bold tracking-wide">
                {language === 'vi' ? 'Đã có tài khoản?' : 'Already have an account?'}
              </span>
            </div>
          </div>

          <button
            id="go_to_login_btn"
            onClick={onNavigateToLogin}
            className="w-full py-2.5 px-4 border border-indigo-200 dark:border-indigo-900/60 rounded-xl text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-slate-800 focus:outline-none transition-all text-center block"
          >
            {language === 'vi' ? 'Quay lại Đăng nhập' : 'Back to Login'}
          </button>
        </div>
      </div>
    </div>
  );
}
