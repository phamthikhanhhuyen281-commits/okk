import React, { useState, useRef, useEffect } from 'react';
import { Bell, Sun, Moon, LogOut, ChevronDown, CheckCircle2, Trash2, Check, User, ShieldCheck } from 'lucide-react';
import { RouteType, User as UserType, CenterSettings, AppNotification } from '../../types';
import { Language, translations } from '../../data/translations';

interface AdminHeaderProps {
  currentRoute: RouteType;
  currentUser: UserType | null;
  centerSettings: CenterSettings | null;
  onLogout: () => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  notifications: AppNotification[];
  onMarkAllRead: () => void;
  onClearNotifications: () => void;
  onMarkRead: (id: string) => void;
}

export default function AdminHeader({
  currentRoute,
  currentUser,
  centerSettings,
  onLogout,
  theme,
  setTheme,
  language,
  setLanguage,
  notifications,
  onMarkAllRead,
  onClearNotifications,
  onMarkRead
}: AdminHeaderProps) {
  const t = translations[language];
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getBreadcrumb = (route: string) => {
    switch (route) {
      case 'owner/dashboard': return t.breadOwnerOverview || 'Overview';
      case 'owner/permissions': return t.breadOwnerPerms || 'Admin Permissions';
      case 'owner/settings': return t.breadSettings || 'Branding';
      case 'owner/users': return t.breadOwnerUsers || 'Account Database';
      case 'admin/dashboard': return t.breadOverview || 'Overview';
      case 'admin/exams': return t.breadExams || 'Exam Library';
      case 'admin/classes': return t.breadClasses || 'Class Directory';
      case 'admin/classes/detail': return t.breadClassDetail || 'Class Details';
      case 'admin/students': return t.breadStudents || 'Student Directory';
      case 'admin/statistics': return t.breadStats || 'Reports & Analytics';
      case 'admin/settings': return t.breadSettings || 'Branding';
      default: return t.breadDefault || 'Management';
    }
  };

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 sticky top-0 z-20 transition-colors duration-200">
      {/* Left side: Breadcrumb path */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          {currentUser?.role === 'owner' ? (t.navOwnerDashboard || 'Owner') : (t.ieltsPortal || 'Portal')}
        </span>
        <span className="text-slate-300 dark:text-slate-700 text-xs font-bold">/</span>
        <span className="text-sm font-extrabold text-slate-800 dark:text-white tracking-tight">
          {getBreadcrumb(currentRoute)}
        </span>
      </div>

      {/* Right side: Actions & Controls */}
      <div className="flex items-center gap-4">
        {/* Language Selection */}
        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/80 rounded-xl p-0.5 border border-slate-200/50 dark:border-slate-700/50">
          <button
            onClick={() => setLanguage('vi')}
            title="Tiếng Việt"
            className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all ${
              language === 'vi'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <span>🇻🇳</span>
            <span className="hidden sm:inline">VI</span>
          </button>
          <button
            onClick={() => setLanguage('en')}
            title="English"
            className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all ${
              language === 'en'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <span>🇬🇧</span>
            <span className="hidden sm:inline">EN</span>
          </button>
        </div>

        {/* Theme Toggle */}
        <div className="flex items-center bg-slate-50 dark:bg-slate-800/80 rounded-xl p-0.5 border border-slate-200/50 dark:border-slate-700/50">
          <button
            onClick={() => setTheme('light')}
            title={t.themeLightTooltip}
            className={`p-1.5 rounded-lg transition-all ${
              theme === 'light'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sun size={13} className="font-extrabold" />
          </button>
          <button
            onClick={() => setTheme('dark')}
            title={t.themeDarkTooltip}
            className={`p-1.5 rounded-lg transition-all ${
              theme === 'dark'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Moon size={13} className="font-extrabold" />
          </button>
        </div>

        {/* Notifications Dropdown */}
        <div className="relative" ref={notificationRef}>
          <button
            onClick={() => setIsNotificationOpen(!isNotificationOpen)}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all relative cursor-pointer"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-[9px] font-bold text-white rounded-full flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {isNotificationOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-fade-in">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="font-extrabold text-slate-800 dark:text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Bell size={13} className="text-blue-600" />
                  {t.notificationTitle}
                </span>
                {unreadCount > 0 && (
                  <span className="text-[9px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full uppercase">
                    {unreadCount} {t.notificationNew}
                  </span>
                )}
              </div>

              {/* Notifications List */}
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-xs">
                    {t.notificationNoItems}
                  </div>
                ) : (
                  notifications.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3.5 flex flex-col gap-1 transition-all hover:bg-slate-50/50 dark:hover:bg-slate-800/30 ${
                        !item.isRead ? 'bg-blue-50/20 dark:bg-blue-950/10' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <p className={`text-[11px] leading-relaxed text-slate-700 dark:text-slate-300 ${!item.isRead ? 'font-bold' : ''}`}>
                          {language === 'vi' ? item.textVi : item.textEn}
                        </p>
                        {!item.isRead && (
                          <button
                            onClick={() => onMarkRead(item.id)}
                            className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline shrink-0 flex items-center gap-0.5"
                          >
                            <Check size={10} />
                            {t.notificationMarkRead}
                          </button>
                        )}
                      </div>
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold">
                        {language === 'vi' ? item.timeVi : item.timeEn}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Actions Footer */}
              {notifications.length > 0 && (
                <div className="p-2.5 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={onMarkAllRead}
                    disabled={unreadCount === 0}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-lg disabled:opacity-50 transition-all cursor-pointer"
                  >
                    <CheckCircle2 size={11} />
                    {t.notificationMarkAll}
                  </button>
                  <button
                    onClick={onClearNotifications}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-all cursor-pointer"
                  >
                    <Trash2 size={11} />
                    {t.notificationClear}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Profile Info & Logout */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center border border-blue-400/20">
              {currentUser?.name.charAt(0) || 'U'}
            </div>
            <div className="hidden md:flex flex-col items-start pr-1">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {currentUser?.name || 'User'}
              </span>
              <span className="text-[9px] text-blue-600 font-bold uppercase tracking-wider">
                {currentUser?.role === 'owner' ? (language === 'vi' ? 'Chủ sở hữu' : 'Owner') : (language === 'vi' ? 'Quản trị viên' : 'Admin')}
              </span>
            </div>
            <ChevronDown size={13} className="text-slate-400" />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-fade-in">
              <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{currentUser?.name}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">{currentUser?.email}</p>
              </div>
              <div className="p-1.5">
                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all text-left cursor-pointer"
                >
                  <LogOut size={13} />
                  {t.logout}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
