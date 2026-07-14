import React, { useState } from 'react';
import { Mail, Lock, Phone, ArrowRight, ShieldCheck, UserCheck, Key } from 'lucide-react';
import { User } from '../../types';
import { getStoredPasswords } from '../../data/mockData';
import { Language, translations } from '../../data/translations';
import ThemeLanguageSelector from '../ThemeLanguageSelector';

interface LoginFormProps {
  onLoginSuccess: (user: User) => void;
  onNavigateToRegister: () => void;
  users: User[];
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  language: Language;
  setLanguage: (language: Language) => void;
}

export default function LoginForm({ 
  onLoginSuccess, 
  onNavigateToRegister, 
  users,
  theme,
  setTheme,
  language,
  setLanguage
}: LoginFormProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSevereWarning, setIsSevereWarning] = useState(false);

  const t = translations[language];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSevereWarning(false);

    if (!identifier.trim() || !password.trim()) {
      setError(language === 'vi' ? 'Vui lòng nhập đầy đủ email/số điện thoại và mật khẩu.' : 'Please enter email/phone and password.');
      return;
    }

    setIsLoading(true);

    // Simulate database lookup in 800ms
    setTimeout(() => {
      setIsLoading(false);
      const cleanIdentifier = identifier.trim().toLowerCase();

      // Simple mock lookup
      const foundUser = users.find(
        (u) => 
          (u.email.toLowerCase() === cleanIdentifier || u.phone === cleanIdentifier)
      );

      if (!foundUser) {
        setError(language === 'vi' ? 'Tài khoản không tồn tại trong hệ thống. Vui lòng đăng ký tài khoản mới!' : 'Account does not exist. Please register a new student account.');
        return;
      }

      if (foundUser.status === 'locked') {
        setError(language === 'vi' ? 'Tài khoản này đã bị khóa bởi quản trị viên.' : 'This account has been locked by the administrator.');
        return;
      }

      // Secure real password check
      const passwords = getStoredPasswords();
      const storedPassword = passwords[foundUser.email.toLowerCase()] || '123456';

      if (password !== storedPassword) {
        if (foundUser.role === 'owner' || foundUser.role === 'admin') {
          setIsSevereWarning(true);
          setError(language === 'vi' ? 'CẢNH BÁO BẢO MẬT TỐI CAO: PHÁT HIỆN HÀNH VI XÂM NHẬP TRÁI PHÉP VÀO TÀI KHOẢN BAN QUẢN TRỊ!' : 'HIGH SECURITY WARNING: DETECTED ILLEGAL ACCESS ATTEMPT ON MANAGEMENT SYSTEM ACCOUNT!');
        } else {
          setError(language === 'vi' ? 'Mật khẩu nhập vào không chính xác. Vui lòng kiểm tra lại!' : 'Incorrect password. Please try again!');
        }
        return;
      }

      onLoginSuccess(foundUser);
    }, 800);
  };

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

      <div id="login_card_container" className="bg-white dark:bg-slate-900 w-full rounded-2xl overflow-hidden shadow-xl border border-slate-100 dark:border-slate-800/80 transition-colors duration-200">
        {/* Visual Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-8 py-8 text-white relative">
          <div className="absolute right-4 bottom-4 opacity-10">
            <ShieldCheck size={120} />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-white/20 p-2 rounded-lg text-white font-bold text-xl">🎓</span>
            <span className="font-semibold text-xs tracking-wider uppercase opacity-90">IELTS System</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">{t.loginTitle}</h2>
          <p className="text-indigo-100 text-xs sm:text-sm mt-1">{t.loginSubtitle}</p>
        </div>

        <div className="p-8">
          {isSevereWarning ? (
            <div id="login_severe_warning" className="mb-6 p-5 bg-red-950 border-2 border-red-500 rounded-2xl text-red-100 text-xs space-y-3 animate-pulse shadow-lg shadow-red-950/50">
              <div className="flex items-center gap-2.5 text-red-400 font-extrabold uppercase tracking-widest text-[11px]">
                <span className="text-lg">🚨</span>
                <span>{t.severeWarningTitle}</span>
              </div>
              <p className="font-semibold text-red-200 leading-relaxed text-xs">
                {t.severeWarningLoginDesc}
              </p>
              <div className="bg-red-900/40 p-2.5 rounded-lg border border-red-800/60 text-[10px] sm:text-[11px] font-mono space-y-1">
                <div>• {t.deviceLabel}: {navigator.userAgent.slice(0, 40)}...</div>
                <div>• {t.statusLabel}: {t.severeWarningLoginAction}</div>
                <div>• {t.ipLabel}: {t.severeWarningLoginLuvet}</div>
              </div>
              <p className="text-[10px] sm:text-[11px] text-red-400 leading-normal font-extrabold">
                {t.severeWarningLoginFooter}
              </p>
            </div>
          ) : error && (
            <div id="login_error" className="mb-6 p-4 bg-red-50 dark:bg-red-950/40 border-l-4 border-red-500 rounded text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
              <span className="font-bold">Error:</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                {t.emailOrPhone}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <Mail size={18} />
                </span>
                <input
                  id="login_identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={language === 'vi' ? 'Nhập email hoặc số điện thoại...' : 'Enter your email or phone number...'}
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-850 transition-all text-sm"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t.passwordLabel}
                </label>
                <button
                  type="button"
                  onClick={() => alert(language === 'vi' ? 'Bạn có thể nhập mật khẩu bất kỳ (ví dụ: 123456) cho tài khoản đã có.' : 'You can enter any password (e.g., 123456) for existing accounts.')}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                >
                  {language === 'vi' ? 'Quên mật khẩu?' : 'Forgot password?'}
                </button>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <Lock size={18} />
                </span>
                <input
                  id="login_password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-850 transition-all text-sm"
                />
              </div>
            </div>

            <button
              id="login_submit_btn"
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
                  {language === 'vi' ? 'Đang xác thực...' : 'Authenticating...'}
                </span>
              ) : (
                <>
                  {t.loginButton} <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-slate-900 px-2 text-slate-400 dark:text-slate-500 font-bold tracking-wide">
                {language === 'vi' ? 'Hoặc đăng ký tài khoản mới' : 'Or register an account'}
              </span>
            </div>
          </div>

          <button
            id="go_to_register_btn"
            onClick={onNavigateToRegister}
            className="w-full py-2.5 px-4 border border-indigo-200 dark:border-indigo-900/60 rounded-xl text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-slate-800 focus:outline-none transition-all text-center block"
          >
            {t.registerBtn}
          </button>


        </div>
      </div>
    </div>
  );
}
