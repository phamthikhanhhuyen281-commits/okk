import React from 'react';
import { Sun, Moon, Globe } from 'lucide-react';
import { Language, translations } from '../data/translations';

interface ThemeLanguageSelectorProps {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  language: Language;
  setLanguage: (language: Language) => void;
  className?: string;
}

export default function ThemeLanguageSelector({
  theme,
  setTheme,
  language,
  setLanguage,
  className = ''
}: ThemeLanguageSelectorProps) {
  const t = translations[language];

  return (
    <div className={`flex items-center gap-2.5 p-1.5 bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50 rounded-2xl ${className}`}>
      {/* Language Toggle */}
      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 rounded-xl p-0.5 shadow-sm border border-slate-200/20">
        <button
          onClick={() => setLanguage('vi')}
          title="Tiếng Việt"
          className={`flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-lg transition-all ${
            language === 'vi'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <span>🇻🇳</span>
          <span className="hidden sm:inline">VI</span>
        </button>
        <button
          onClick={() => setLanguage('en')}
          title="English"
          className={`flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-lg transition-all ${
            language === 'en'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <span>🇬🇧</span>
          <span className="hidden sm:inline">EN</span>
        </button>
      </div>

      {/* Theme Toggle */}
      <div className="flex items-center bg-white dark:bg-slate-900 rounded-xl p-0.5 shadow-sm border border-slate-200/20">
        <button
          onClick={() => setTheme('light')}
          title={t.themeLightTooltip}
          className={`p-1.5 rounded-lg transition-all ${
            theme === 'light'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Sun size={13} className="font-extrabold" />
        </button>
        <button
          onClick={() => setTheme('dark')}
          title={t.themeDarkTooltip}
          className={`p-1.5 rounded-lg transition-all ${
            theme === 'dark'
              ? 'bg-indigo-500 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
          }`}
        >
          <Moon size={13} className="font-extrabold" />
        </button>
      </div>
    </div>
  );
}
