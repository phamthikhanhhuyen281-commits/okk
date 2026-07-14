import React from 'react';
import { Home, BookOpen, School, Users, BarChart3, Settings, LogOut, ShieldCheck } from 'lucide-react';
import { RouteType, User, CenterSettings } from '../../types';
import { Language, translations } from '../../data/translations';

interface AdminSidebarProps {
  currentRoute: RouteType;
  onNavigate: (route: RouteType) => void;
  currentUser: User | null;
  centerSettings: CenterSettings;
  onLogout: () => void;
  language: Language;
}

export default function AdminSidebar({ currentRoute, onNavigate, currentUser, centerSettings, onLogout, language }: AdminSidebarProps) {
  const t = translations[language];

  const menuItems = [
    { id: 'admin/dashboard' as RouteType, label: t.navOverview, icon: Home },
    { id: 'admin/exams' as RouteType, label: t.navExams, icon: BookOpen },
    { id: 'admin/classes' as RouteType, label: t.navClasses, icon: School },
    { id: 'admin/students' as RouteType, label: t.navStudents, icon: Users },
    { id: 'admin/statistics' as RouteType, label: t.navStatistics, icon: BarChart3 },
    { id: 'admin/settings' as RouteType, label: t.navSettings, icon: Settings },
  ];

  return (
    <aside className="w-64 bg-white text-slate-700 flex flex-col h-screen fixed left-0 top-0 z-30 shadow-sm border-r border-slate-200 transition-colors duration-200">
      {/* Brand logo */}
      <div className="p-6 border-b border-slate-100 flex items-center gap-3">
        <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0">
          {centerSettings.logo ? centerSettings.logo.charAt(0) : 'I'}
        </div>
        <div>
          <h1 className="font-extrabold text-slate-800 text-sm tracking-tight truncate w-36">
            {centerSettings.name || 'Aegis IELTS'}
          </h1>
          <p className="text-[10px] text-blue-600 font-bold tracking-wider uppercase">IELTS Education</p>
        </div>
      </div>

      {/* Admin User Badge */}
      <div className="p-4 mx-4 my-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center border border-blue-400/30">
          {currentUser?.name.charAt(0) || 'A'}
        </div>
        <div className="overflow-hidden">
          <div className="font-bold text-slate-800 text-xs truncate">{currentUser?.name || 'Admin'}</div>
          <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 font-semibold">
            <ShieldCheck size={11} className="text-blue-600" />
            <span className="text-blue-600 uppercase">
              {language === 'vi' ? 'Quản trị viên' : 'Administrator'}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        <div className="px-4 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          {language === 'vi' ? 'Danh mục chính' : 'Main Menu'}
        </div>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentRoute === item.id || (item.id === 'admin/classes' && currentRoute === 'admin/classes/detail');
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-blue-50 text-blue-600 border-r-3 border-blue-600 rounded-l-xl rounded-r-none'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 rounded-xl'
              }`}
            >
              <Icon size={16} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-slate-100 space-y-2">
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
