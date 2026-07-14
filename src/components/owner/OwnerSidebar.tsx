import React from 'react';
import { LayoutDashboard, Users, Key, Settings, LogOut, ShieldAlert, Award } from 'lucide-react';
import { RouteType, User, CenterSettings } from '../../types';
import { Language, translations } from '../../data/translations';

interface OwnerSidebarProps {
  currentRoute: RouteType;
  onNavigate: (route: RouteType) => void;
  currentUser: User | null;
  centerSettings: CenterSettings;
  onLogout: () => void;
  language: Language;
}

export default function OwnerSidebar({ currentRoute, onNavigate, currentUser, centerSettings, onLogout, language }: OwnerSidebarProps) {
  const t = translations[language];

  const menuItems = [
    { id: 'owner/dashboard' as RouteType, label: t.navOwnerDashboard, icon: LayoutDashboard },
    { id: 'owner/users' as RouteType, label: t.navOwnerUsers, icon: Users },
    { id: 'owner/permissions' as RouteType, label: t.navOwnerPermissions, icon: Key },
    { id: 'owner/settings' as RouteType, label: language === 'vi' ? 'Cấu Hình Hệ Thống' : 'System Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-white text-slate-700 flex flex-col h-screen fixed left-0 top-0 z-30 shadow-sm border-r border-slate-200 transition-colors duration-200">
      {/* Brand logo */}
      <div className="p-6 border-b border-slate-100 flex items-center gap-3">
        <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0">
          👑
        </div>
        <div>
          <h1 className="font-extrabold text-slate-800 text-sm tracking-tight truncate w-36">
            {centerSettings.name || 'Aegis IELTS'}
          </h1>
          <p className="text-[10px] text-indigo-600 font-bold tracking-wider uppercase">System Owner</p>
        </div>
      </div>

      {/* Owner Badge */}
      <div className="p-4 mx-4 my-4 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-extrabold flex items-center justify-center shadow-sm">
          {currentUser?.name.charAt(0) || 'O'}
        </div>
        <div className="overflow-hidden">
          <div className="font-bold text-slate-800 text-xs truncate">{currentUser?.name || 'Owner'}</div>
          <div className="text-[10px] text-indigo-600 flex items-center gap-1 mt-0.5 font-bold">
            <ShieldAlert size={11} className="text-indigo-500" />
            <span>{language === 'vi' ? 'CHỦ SỞ HỮU CAO CẤP' : 'ROOT OWNER'}</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        <div className="px-4 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          {language === 'vi' ? 'Danh mục Owner' : 'Owner Menu'}
        </div>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentRoute === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-50 text-indigo-600 border-r-3 border-indigo-600 rounded-l-xl rounded-r-none'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 rounded-xl'
              }`}
            >
              <Icon size={16} className={isActive ? 'text-indigo-600' : 'text-slate-400'} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom info */}
      <div className="p-4 border-t border-slate-100 space-y-2">
        <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-[10px] text-slate-500 leading-normal">
          <span className="font-bold text-slate-600 block mb-1">
            {language === 'vi' ? 'CƠ CHẾ OWNER:' : 'OWNER MECHANISM:'}
          </span>
          {language === 'vi' 
            ? 'Tài khoản Owner được khởi tạo trực tiếp trên Database và sở hữu đặc quyền tối thượng, không thể bị xóa hay sửa đổi bởi Admin thông thường.'
            : 'Owner accounts are provisioned directly on the central Database, granting supreme authority that regular admins cannot override or delete.'}
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700 rounded-xl transition-all cursor-pointer"
        >
          <LogOut size={16} />
          <span>{t.logout}</span>
        </button>
      </div>
    </aside>
  );
}
