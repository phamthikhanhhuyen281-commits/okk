import React, { useState } from 'react';
import { Search, ToggleLeft, ToggleRight, Eye, ShieldAlert, Check, X, ShieldX, Ban, Unlock } from 'lucide-react';
import { User, Class, Assignment } from '../../types';
import { Language } from '../../data/translations';

interface DataTableProps {
  students: User[];
  classes: Class[];
  assignments: Assignment[];
  language: Language;
  onToggleStatus: (userId: string) => void;
  onViewDetails: (userId: string) => void;
  notifications: any[];
  exams: any[];
}

export default function DataTable({ students, classes, assignments, language, onToggleStatus, onViewDetails, notifications, exams }: DataTableProps) {
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'locked'>('all');

  // Filter students
  const filteredStudents = students.filter(student => {
    // Basic search matches
    const matchesSearch = 
      student.name.toLowerCase().includes(search.toLowerCase()) ||
      student.email.toLowerCase().includes(search.toLowerCase()) ||
      student.phone.includes(search);

    // Status filter
    const matchesStatus = statusFilter === 'all' || student.status === statusFilter;

    // Class filter check: finds if student's ID is in the selected class's studentIds
    let matchesClass = true;
    if (classFilter !== 'all') {
      const selectedClass = classes.find(c => c.id === classFilter);
      matchesClass = selectedClass ? selectedClass.studentIds.includes(student.id) : false;
    }

    return matchesSearch && matchesStatus && matchesClass;
  });

  // Helper to get class name(s) for a student
  const getStudentClassesString = (studentId: string) => {
    const studentClasses = classes.filter(cls => cls.studentIds.includes(studentId));
    if (studentClasses.length === 0) return language === 'vi' ? 'Chưa xếp lớp' : 'Unassigned';
    return studentClasses.map(c => c.name.split(' - ')[0]).join(', ');
  };

  return (
    <div id="data_table_container" className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Search and Filters Header */}
      <div className="p-6 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            {language === 'vi' ? 'Danh Sách Học Viên Hệ Thống' : 'System Student Directory'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'vi' 
              ? 'Xem hồ sơ, tìm kiếm thông tin liên hệ, quản lý trạng thái khóa/mở khóa tài khoản học sinh.' 
              : 'View profiles, search contact details, and manage student account lock/unlock statuses.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder={language === 'vi' ? 'Tìm họ tên, email, sđt...' : 'Search name, email, phone...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-56 transition-all"
            />
          </div>

          {/* Class Filter */}
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-600 cursor-pointer"
          >
            <option value="all">{language === 'vi' ? 'Tất cả lớp học' : 'All classes'}</option>
            {classes.map(cls => (
              <option key={cls.id} value={cls.id}>{cls.name}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'locked')}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-600 cursor-pointer"
          >
            <option value="all">{language === 'vi' ? 'Mọi trạng thái' : 'All statuses'}</option>
            <option value="active">{language === 'vi' ? 'Hoạt động' : 'Active'}</option>
            <option value="locked">{language === 'vi' ? 'Đã khóa' : 'Locked'}</option>
          </select>
        </div>
      </div>

      {/* Table Area */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 text-xs font-bold uppercase tracking-wider">
              <th className="px-6 py-4">{language === 'vi' ? 'Họ và tên' : 'Full Name'}</th>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">{language === 'vi' ? 'Số điện thoại' : 'Phone Number'}</th>
              <th className="px-6 py-4">{language === 'vi' ? 'Lớp đang theo học' : 'Enrolled Classes'}</th>
              <th className="px-6 py-4">{language === 'vi' ? 'Thống kê làm đề' : 'Exam Statistics'}</th>
              <th className="px-6 py-4">{language === 'vi' ? 'Trạng thái' : 'Status'}</th>
              <th className="px-6 py-4 text-right">{language === 'vi' ? 'Hành động' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <ShieldX size={44} className="text-slate-300" />
                    <span className="font-medium text-slate-500 text-sm">
                      {language === 'vi' ? 'Không tìm thấy học viên phù hợp' : 'No matching students found'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {language === 'vi' ? 'Hãy thử xóa bộ lọc tìm kiếm' : 'Try clearing your search filter'}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredStudents.map((student) => {
                const classesString = getStudentClassesString(student.id);
                const isUnassigned = classesString === (language === 'vi' ? 'Chưa xếp lớp' : 'Unassigned');

                return (
                  <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Name column */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center border border-slate-200">
                          {student.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{student.name}</div>
                          <div className="text-[10px] text-slate-400 font-semibold uppercase">ID: {student.id.substring(0, 10)}</div>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-6 py-4 text-slate-700 font-medium">
                      {student.email}
                    </td>

                    {/* Phone */}
                    <td className="px-6 py-4 text-slate-600 font-semibold font-mono text-xs">
                      {student.phone}
                    </td>

                    {/* Enrolled classes */}
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-lg font-semibold ${
                        isUnassigned 
                          ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                      }`}>
                        {classesString}
                      </span>
                    </td>

                    {/* Exam Statistics */}
                    <td className="px-6 py-4">
                      {(() => {
                        const completedExamsList: { score: number; duration: number }[] = [];

                        // 1. Class assignments
                        assignments.forEach(a => {
                          const studentSub = a.submissions?.find(s => s.studentId === student.id && s.status === 'done');
                          if (studentSub) {
                            const exam = exams.find(e => e.id === a.examId);
                            completedExamsList.push({
                              score: studentSub.score || 0,
                              duration: studentSub.duration || exam?.duration || 15
                            });
                          }
                        });

                        // 2. Self practices
                        notifications.forEach(n => {
                          if (n.userId === student.id) {
                            const viMatch = n.textVi?.match(/hoàn thành tự luyện tập đề "([^"]+)"/);
                            const enMatch = n.textEn?.match(/completed self-practice exam "([^"]+)"/);
                            const title = viMatch?.[1] || enMatch?.[1];
                            if (title) {
                              const matchingExam = exams.find(e => e.title === title);
                              if (matchingExam) {
                                const scoreMatch = n.textVi?.match(/Band\s+([0-9.]+)/);
                                const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;
                                completedExamsList.push({
                                  score: score,
                                  duration: matchingExam.duration || 15
                                });
                              }
                            }
                          }
                        });

                        const completedCount = completedExamsList.length;
                        const completedWithScores = completedExamsList.filter(s => s.score > 0);
                        const averageScore = completedWithScores.length > 0
                          ? (completedWithScores.reduce((sum, s) => sum + s.score, 0) / completedWithScores.length).toFixed(1)
                          : null;

                        const totalMinutes = completedExamsList.reduce((sum, s) => sum + s.duration, 0);
                        const hrs = Math.floor(totalMinutes / 60);
                        const mins = totalMinutes % 60;
                        const studyTimeStr = hrs > 0 
                          ? (language === 'vi' ? `${hrs}g ${mins}p` : `${hrs}h ${mins}m`)
                          : (language === 'vi' ? `${mins} phút` : `${mins}m`);

                        return (
                          <div className="flex flex-col gap-1 text-[11px]">
                            <span className="inline-flex items-center gap-1 font-bold text-slate-700">
                              <span className="text-blue-500">📝</span> 
                              <span className="text-blue-600 font-extrabold">{completedCount}</span> {language === 'vi' ? 'đề đã làm' : 'exams done'}
                            </span>
                            <span className="inline-flex items-center gap-1 font-bold text-indigo-600">
                              <span className="text-indigo-500">⏱️</span> 
                              <span>{studyTimeStr}</span>
                            </span>
                            {averageScore && (
                              <span className="text-[10px] text-emerald-600 font-extrabold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg w-max shadow-sm mt-0.5">
                                ⭐ {language === 'vi' ? `Band TB: ${averageScore}` : `Avg Band: ${averageScore}`}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      {student.status === 'active' ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-600 text-xs font-bold">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          {language === 'vi' ? 'Hoạt động' : 'Active'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-red-500 text-xs font-bold bg-red-50 px-2 py-0.5 rounded border border-red-100">
                          <span className="w-2 h-2 rounded-full bg-red-500"></span>
                          {language === 'vi' ? 'Đang khóa' : 'Locked'}
                        </span>
                      )}
                    </td>

                    {/* Action buttons */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2.5">
                        <button
                          onClick={() => onViewDetails(student.id)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title={language === 'vi' ? 'Xem chi tiết học tập' : 'View study details'}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => onToggleStatus(student.id)}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            student.status === 'active' 
                              ? 'text-slate-400 hover:text-red-600 hover:bg-red-50' 
                              : 'text-red-500 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={
                            student.status === 'active' 
                              ? (language === 'vi' ? 'Khóa tài khoản' : 'Lock account') 
                              : (language === 'vi' ? 'Mở khóa tài khoản' : 'Unlock account')
                          }
                        >
                          {student.status === 'active' ? <Ban size={16} /> : <Unlock size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
