import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  colorTheme?: 'blue' | 'purple' | 'indigo' | 'emerald' | 'amber' | 'rose';
}

export default function StatCard({ title, value, icon: Icon, description, trend, colorTheme = 'blue' }: StatCardProps) {
  const themes = {
    blue: {
      bg: 'bg-blue-50',
      text: 'text-blue-600',
      border: 'border-blue-100',
      glow: 'shadow-blue-500/5',
      accent: 'bg-blue-600'
    },
    purple: {
      bg: 'bg-purple-50',
      text: 'text-purple-600',
      border: 'border-purple-100',
      glow: 'shadow-purple-500/5',
      accent: 'bg-purple-600'
    },
    indigo: {
      bg: 'bg-indigo-50',
      text: 'text-indigo-600',
      border: 'border-indigo-100',
      glow: 'shadow-indigo-500/5',
      accent: 'bg-indigo-600'
    },
    emerald: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      border: 'border-emerald-100',
      glow: 'shadow-emerald-500/5',
      accent: 'bg-emerald-500'
    },
    amber: {
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      border: 'border-amber-100',
      glow: 'shadow-amber-500/5',
      accent: 'bg-amber-500'
    },
    rose: {
      bg: 'bg-rose-50',
      text: 'text-rose-600',
      border: 'border-rose-100',
      glow: 'shadow-rose-500/5',
      accent: 'bg-rose-500'
    }
  };

  const selectedTheme = themes[colorTheme];

  return (
    <div id={`stat_card_${title.replace(/\s+/g, '_')}`} className={`glass-card p-6 ${selectedTheme.glow} hover:shadow-md hover:border-slate-300 transition-all duration-300 relative overflow-hidden group`}>
      {/* Decorative colored top line */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${selectedTheme.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-extrabold text-slate-800 mt-2 tracking-tight">
            {value}
          </p>
        </div>
        <div className={`p-3 rounded-lg ${selectedTheme.bg} ${selectedTheme.text} transition-transform group-hover:scale-110 duration-300`}>
          <Icon size={20} />
        </div>
      </div>

      {(description || trend) && (
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-50 text-xs">
          {trend && (
            <span className={`font-bold px-1.5 py-0.5 rounded ${
              trend.isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}>
              {trend.value}
            </span>
          )}
          {description && (
            <span className="text-slate-500 font-medium truncate">{description}</span>
          )}
        </div>
      )}
    </div>
  );
}
