import React from 'react';
import { ClipboardList, Clock, CheckCircle, HelpCircle, Eye, Edit, Trash2, CalendarCheck, AlertTriangle } from 'lucide-react';
import { Assignment, Exam } from '../../types';
import { Language } from '../../data/translations';

interface AssignmentCardProps {
  key?: string | number;
  assignment: Assignment;
  exams: Exam[];
  language: Language;
  onViewDetails: (assignmentId: string) => void;
  onEdit: (assignment: Assignment) => void;
  onDelete: (id: string) => void;
}

export default function AssignmentCard({ assignment, exams, language, onViewDetails, onEdit, onDelete }: AssignmentCardProps) {
  // Find associated exam details
  const exam = exams.find(e => e.id === assignment.examId);

  // Compute stats
  const totalSubmissionsCount = assignment.submissions ? assignment.submissions.length : 0;
  const completedCount = assignment.submissions ? assignment.submissions.filter(s => s.status === 'done').length : 0;
  const pendingCount = totalSubmissionsCount - completedCount;

  // Average score for completed submissions
  const completedSubmissionsWithScores = assignment.submissions?.filter(s => s.status === 'done' && s.score !== undefined) || [];
  const averageScore = completedSubmissionsWithScores.length > 0
    ? (completedSubmissionsWithScores.reduce((acc, curr) => acc + (curr.score || 0), 0) / completedSubmissionsWithScores.length).toFixed(1)
    : (language === 'vi' ? 'Chưa có' : 'None');

  // Styles for assignment type badge
  const getTypeStyles = () => {
    switch (assignment.type) {
      case 'listening':
        return 'bg-teal-50 text-teal-700 border-teal-100';
      case 'reading':
        return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      case 'writing':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'speaking':
        return 'bg-purple-50 text-purple-700 border-purple-100';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-100';
    }
  };

  // Status Badge styles
  const getStatusBadge = () => {
    switch (assignment.status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
            {language === 'vi' ? 'ĐANG GIAO' : 'ACTIVE'}
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">
            {language === 'vi' ? 'HẾT HẠN' : 'EXPIRED'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
            {language === 'vi' ? 'HOÀN THÀNH' : 'COMPLETED'}
          </span>
        );
    }
  };

  const getTranslatedType = () => {
    switch (assignment.type) {
      case 'listening': return language === 'vi' ? 'Nghe (Listening)' : 'Listening';
      case 'reading': return language === 'vi' ? 'Đọc (Reading)' : 'Reading';
      case 'writing': return language === 'vi' ? 'Viết (Writing)' : 'Writing';
      case 'speaking': return language === 'vi' ? 'Nói (Speaking)' : 'Speaking';
      default: return language === 'vi' ? 'Thi thử (Full)' : 'Full Test';
    }
  };

  return (
    <div id={`assignment_card_${assignment.id}`} className="glass-card p-5 hover:shadow-md hover:border-slate-300 transition-all duration-300">
      {/* Header Info */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className={`px-2.5 py-1 text-xs font-bold border rounded-lg uppercase tracking-wider ${getTypeStyles()}`}>
          {getTranslatedType()}
        </span>
        {getStatusBadge()}
      </div>

      {/* Assignment Title */}
      <h4 className="font-bold text-slate-800 text-sm leading-snug line-clamp-1 mb-1">
        {assignment.title}
      </h4>
      <p className="text-xs text-slate-400 font-medium truncate mb-4">
        {language === 'vi' ? 'Đề:' : 'Exam:'} {exam ? exam.title : (language === 'vi' ? 'Đề đã xóa' : 'Deleted exam')}
      </p>

      {/* Statistics Section */}
      <div className="grid grid-cols-3 gap-2 bg-slate-50 border border-slate-100 rounded-xl p-3 text-center mb-4">
        <div>
          <div className="text-[10px] font-semibold text-slate-400 uppercase">{language === 'vi' ? 'Đã làm' : 'Done'}</div>
          <div className="text-sm font-extrabold text-emerald-600 mt-0.5">{completedCount}</div>
        </div>
        <div>
          <div className="text-[10px] font-semibold text-slate-400 uppercase">{language === 'vi' ? 'Chưa làm' : 'Pending'}</div>
          <div className="text-sm font-extrabold text-amber-500 mt-0.5">{pendingCount}</div>
        </div>
        <div>
          <div className="text-[10px] font-semibold text-slate-400 uppercase">{language === 'vi' ? 'Điểm TB' : 'Avg Band'}</div>
          <div className="text-sm font-extrabold text-blue-600 mt-0.5">
            {averageScore !== (language === 'vi' ? 'Chưa có' : 'None') ? `Band ${averageScore}` : '—'}
          </div>
        </div>
      </div>

      {/* Dates row */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-4 font-semibold">
        <div className="flex items-center gap-1">
          <span>{language === 'vi' ? 'Giao:' : 'Assigned:'}</span>
          <span className="text-slate-600">{assignment.createdAt}</span>
        </div>
        <div className="flex items-center gap-1">
          <span>{language === 'vi' ? 'Hạn nộp:' : 'Deadline:'}</span>
          <span className="text-red-500 font-bold">{assignment.deadline}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 border-t border-slate-50 pt-3">
        <button
          onClick={() => onViewDetails(assignment.id)}
          className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-all border border-blue-100 cursor-pointer"
        >
          <Eye size={13} />
          {language === 'vi' ? 'Xem chi tiết' : 'View details'}
        </button>
        <button
          onClick={() => onEdit(assignment)}
          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-100 hover:border-blue-100 rounded-lg transition-colors cursor-pointer"
          title={language === 'vi' ? 'Chỉnh sửa hạn nộp' : 'Edit deadline'}
        >
          <Edit size={13} />
        </button>
        <button
          onClick={() => onDelete(assignment.id)}
          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-100 hover:border-red-100 rounded-lg transition-colors cursor-pointer"
          title={language === 'vi' ? 'Hủy giao bài' : 'Deassign homework'}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
