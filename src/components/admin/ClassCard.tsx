import React from 'react';
import { School, Users, Calendar, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { Class } from '../../types';
import { Language } from '../../data/translations';

interface ClassCardProps {
  key?: string | number;
  cls: Class;
  language: Language;
  onViewDetails: (classId: string) => void;
}

export default function ClassCard({ cls, language, onViewDetails }: ClassCardProps) {
  const studentsCount = cls.studentIds ? cls.studentIds.length : 0;

  return (
    <div id={`class_card_${cls.id}`} className="glass-card overflow-hidden hover:shadow-md hover:border-slate-300 transition-all duration-300 flex flex-col justify-between h-full group">
      {/* Visual Header Accent */}
      <div className={`h-1.5 ${cls.status === 'active' ? 'bg-blue-600' : 'bg-slate-300'}`}></div>

      <div className="p-6">
        {/* Class Badge & Status */}
        <div className="flex items-center justify-between mb-4">
          <span className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
            <School size={18} />
          </span>

          {cls.status === 'active' ? (
            <span className="badge-active inline-flex items-center gap-1">
              <CheckCircle2 size={12} />
              {language === 'vi' ? 'HOẠT ĐỘNG' : 'ACTIVE'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded-full">
              <AlertCircle size={12} />
              {language === 'vi' ? 'CHƯA KÍCH HOẠT' : 'INACTIVE'}
            </span>
          )}
        </div>

        {/* Title */}
        <h4 className="font-bold text-slate-800 text-base leading-snug group-hover:text-blue-600 transition-colors mb-2">
          {cls.name}
        </h4>

        {/* Stats and Info list */}
        <div className="space-y-2.5 mt-5 text-sm text-slate-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-slate-400" />
              <span>{language === 'vi' ? 'Sĩ số lớp học:' : 'Class size:'}</span>
            </div>
            <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-lg text-xs">
              {studentsCount} {language === 'vi' ? 'học viên' : 'students'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-slate-400" />
              <span>{language === 'vi' ? 'Ngày khai giảng:' : 'Start date:'}</span>
            </div>
            <span className="font-medium text-slate-700 text-xs">
              {cls.createdAt}
            </span>
          </div>
        </div>
      </div>

      {/* Detail Button */}
      <div className="px-6 pb-6 pt-3">
        <button
          onClick={() => onViewDetails(cls.id)}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-50 border border-slate-200 text-slate-700 hover:bg-blue-600 hover:text-white hover:border-transparent rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
        >
          <span>{language === 'vi' ? 'Quản lý lớp' : 'Manage batch'}</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
