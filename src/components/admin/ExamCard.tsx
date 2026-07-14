import React from 'react';
import { Eye, Edit3, Trash2, Clock, FileText, CheckCircle2, HelpCircle } from 'lucide-react';
import { Exam } from '../../types';
import { Language } from '../../data/translations';

interface ExamCardProps {
  key?: string | number;
  exam: Exam;
  language: Language;
  onPreview: (exam: Exam) => void;
  onEdit: (exam: Exam) => void;
  onDelete: (id: string) => void;
}

export default function ExamCard({ exam, language, onPreview, onEdit, onDelete }: ExamCardProps) {
  // Select color & icon depending on exam type
  const getTypeStyles = () => {
    switch (exam.type) {
      case 'listening':
        return {
          bg: 'bg-teal-50 border-teal-100',
          text: 'text-teal-700',
          badge: 'Teal',
          iconColor: 'text-teal-600',
          label: language === 'vi' ? 'Nghe (Listening)' : 'Listening',
          emoji: '🎧'
        };
      case 'reading':
        return {
          bg: 'bg-indigo-50 border-indigo-100',
          text: 'text-indigo-700',
          badge: 'Indigo',
          iconColor: 'text-indigo-600',
          label: language === 'vi' ? 'Đọc (Reading)' : 'Reading',
          emoji: '📖'
        };
      case 'writing':
        return {
          bg: 'bg-amber-50 border-amber-100',
          text: 'text-amber-700',
          badge: 'Amber',
          iconColor: 'text-amber-600',
          label: language === 'vi' ? 'Viết (Writing)' : 'Writing',
          emoji: '✍️'
        };
      case 'speaking':
        return {
          bg: 'bg-purple-50 border-purple-100',
          text: 'text-purple-700',
          badge: 'Purple',
          iconColor: 'text-purple-600',
          label: language === 'vi' ? 'Nói (Speaking)' : 'Speaking',
          emoji: '🗣️'
        };
      default:
        return {
          bg: 'bg-blue-50 border-blue-100',
          text: 'text-blue-700',
          badge: 'Blue',
          iconColor: 'text-blue-600',
          label: language === 'vi' ? 'Thi Thử (Full)' : 'Full Test',
          emoji: '📝'
        };
    }
  };

  const style = getTypeStyles();

  return (
    <div id={`exam_card_${exam.id}`} className="glass-card overflow-hidden hover:shadow-md hover:border-slate-300 transition-all duration-300 flex flex-col h-full group">
      {/* Decorative colored top header bar */}
      <div className={`h-1.5 ${exam.status === 'published' ? 'bg-blue-600' : 'bg-slate-300'}`}></div>

      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Header row with skill type badge & status tag */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${style.bg} ${style.text}`}>
              <span>{style.emoji}</span>
              <span>{style.label}</span>
            </span>

            {exam.status === 'published' ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                {language === 'vi' ? 'ĐANG HIỆN' : 'PUBLISHED'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                {language === 'vi' ? 'NHÁP / ẨN' : 'DRAFT'}
              </span>
            )}
          </div>

          {/* Exam Title */}
          <h4 className="font-bold text-slate-800 text-sm leading-snug group-hover:text-blue-600 transition-colors line-clamp-2 h-10 mb-4">
            {exam.title}
          </h4>

          {/* Exam Metadata Info */}
          <div className="grid grid-cols-2 gap-3 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <Clock size={14} className="text-slate-400" />
              <span>{exam.duration} {language === 'vi' ? 'phút' : 'mins'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileText size={14} className="text-slate-400" />
              <span>{exam.questionsCount} {language === 'vi' ? 'câu hỏi' : 'questions'}</span>
            </div>
          </div>
        </div>

        {/* Footer info & Button actions */}
        <div>
          <div className="text-[11px] text-slate-400 mb-4 font-semibold">
            {language === 'vi' ? 'Ngày tạo:' : 'Created at:'} {exam.createdAt}
          </div>

          <div className="flex items-center gap-2 border-t border-slate-50 pt-3">
            <button
              onClick={() => onPreview(exam)}
              className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
              title={language === 'vi' ? 'Xem trước cấu trúc đề' : 'Preview exam structure'}
            >
              <Eye size={13} />
              {language === 'vi' ? 'Xem trước' : 'Preview'}
            </button>
            <button
              onClick={() => onEdit(exam)}
              className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-bold transition-all cursor-pointer"
              title={language === 'vi' ? 'Chỉnh sửa đề' : 'Edit exam'}
            >
              <Edit3 size={14} />
            </button>
            <button
              onClick={() => onDelete(exam.id)}
              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition-all cursor-pointer"
              title={language === 'vi' ? 'Xóa đề thi' : 'Delete exam'}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
