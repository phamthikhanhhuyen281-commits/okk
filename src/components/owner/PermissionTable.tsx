import React, { useState } from 'react';
import { Search, ShieldAlert, ShieldCheck, UserCheck, UserMinus, ShieldX } from 'lucide-react';
import { User } from '../../types';

interface PermissionTableProps {
  users: User[];
  currentUserId: string;
  onGrantAdmin: (userId: string) => void;
  onRevokeAdmin: (userId: string) => void;
  language?: 'vi' | 'en';
}

export default function PermissionTable({ users, currentUserId, onGrantAdmin, onRevokeAdmin, language = 'vi' }: PermissionTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'student'>('all');
  const [directAssignValue, setDirectAssignValue] = useState('');
  const [directMessage, setDirectMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const isVi = language === 'vi';

  // Filter out owners - Owner does not appear in standard list & cannot modify other owners
  const filterableUsers = users.filter(u => u.role !== 'owner' && u.id !== currentUserId);

  const filteredUsers = filterableUsers.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone.includes(searchTerm);
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  // Find current unique Admin
  const activeAdmin = users.find(u => u.role === 'admin');

  const handleDirectAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDirectMessage(null);
    
    const inputVal = directAssignValue.trim().toLowerCase();
    if (!inputVal) return;

    // Search for a candidate matching either email or phone
    const candidate = users.find(u => 
      u.role !== 'owner' && 
      (u.email.toLowerCase() === inputVal || u.phone === inputVal)
    );

    if (!candidate) {
      setDirectMessage({
        text: isVi 
          ? '❌ Không tìm thấy tài khoản học viên nào có Email hoặc Số điện thoại trên. Vui lòng đảm bảo họ đã đăng ký tài khoản trước!'
          : '❌ No student account found with the given Email or Phone number. Please verify they have registered first!',
        isError: true
      });
      return;
    }

    if (candidate.role === 'admin') {
      setDirectMessage({
        text: isVi 
          ? `💡 Tài khoản "${candidate.name}" đã là Admin duy nhất của hệ thống rồi.`
          : `💡 Account "${candidate.name}" is already the exclusive Administrator of the system.`,
        isError: false
      });
      return;
    }

    // Trigger admin granting
    onGrantAdmin(candidate.id);
    setDirectAssignValue('');
    setDirectMessage({
      text: isVi 
        ? `⏳ Đã kích hoạt yêu cầu cấp quyền Admin cho: ${candidate.name}.`
        : `⏳ Activated Administrator authority upgrade request for: ${candidate.name}.`,
      isError: false
    });
  };

  return (
    <div className="space-y-6">
      {/* EXCLUSIVE ADMIN CONTROL BAR */}
      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 border border-slate-800 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-extrabold uppercase tracking-widest">
              <ShieldAlert size={12} className="text-blue-400" />
              {isVi ? 'Cơ Chế Phân Quyền Bảo Mật Tuyệt Đối' : 'EXCLUSIVITY SECURITY PROTOCOL'}
            </span>
            <h3 className="text-lg font-bold tracking-tight">
              {isVi ? 'Cấp Quyền Quản Trị Viên (Admin) Duy Nhất' : 'Authorize Exclusive Center Administrator'}
            </h3>
            <p className="text-xs text-slate-300 leading-normal">
              {isVi 
                ? 'Hệ thống được thiết kế với cơ chế bảo mật tối cao. Chỉ cho phép duy nhất 1 tài khoản làm Admin quản trị trung tâm tại một thời điểm. Khi bạn cấp quyền cho một tài khoản mới, quyền Admin của tài khoản cũ (nếu có) sẽ tự động bị thu hồi ngay lập tức để ngăn ngừa rò rỉ quyền hạn.'
                : 'The platform enforces maximum authority containment. Only exactly ONE account is permitted to hold Administrator credentials at any given time. Upgrading a new account instantly revokes access from the prior administrator to eliminate privilege accumulation risks.'}
            </p>
          </div>

          {/* Secure Form to Quick Grant Admin */}
          <form onSubmit={handleDirectAssignSubmit} className="w-full lg:w-96 bg-white/5 border border-white/10 rounded-xl p-4 space-y-3 shrink-0">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                {isVi ? 'Nhập Email hoặc SĐT Học Viên Cần Cấp Quyền:' : 'Enter Email or Phone number to upgrade:'}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder={isVi ? "Ví dụ: student@ielts.com..." : "E.g., student@ielts.com..."}
                  value={directAssignValue}
                  onChange={(e) => setDirectAssignValue(e.target.value)}
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[11px] px-3.5 py-2 rounded-lg transition-all cursor-pointer shrink-0 animate-pulse"
                >
                  {isVi ? 'Cấp Quyền' : 'Authorize'}
                </button>
              </div>
            </div>
            {directMessage && (
              <p className={`text-[11px] leading-normal ${directMessage.isError ? 'text-red-300 font-medium' : 'text-emerald-300 font-medium'}`}>
                {directMessage.text}
              </p>
            )}
          </form>
        </div>

        {/* Current Active Admin Info Card */}
        <div className="mt-6 pt-5 border-t border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/5 border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/20 text-blue-300 rounded-full flex items-center justify-center text-xl font-bold border border-blue-500/30">
                🛡️
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">
                  {isVi ? 'Admin Duy Nhất Hiện Tại' : 'Active Exclusive Administrator'}
                </div>
                {activeAdmin ? (
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-extrabold text-white text-sm">{activeAdmin.name}</span>
                    <span className="text-xs text-slate-300">({activeAdmin.email} • {activeAdmin.phone})</span>
                  </div>
                ) : (
                  <p className="text-xs text-yellow-400 font-bold mt-1">
                    {isVi 
                      ? '⚠️ CHƯA CÓ ADMIN NÀO ĐƯỢC CHỈ ĐỊNH. Hệ thống đang hoạt động ở chế độ tự động đóng kín bảo mật.'
                      : '⚠️ NO ADMINISTRATOR ASSIGNED. Platform is currently operating in secure autolocked containment mode.'}
                  </p>
                )}
              </div>
            </div>

            {activeAdmin && (
              <button
                type="button"
                onClick={() => onRevokeAdmin(activeAdmin.id)}
                className="px-3.5 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 hover:border-red-500/40 text-red-300 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0"
              >
                {isVi ? 'Thu hồi quyền Admin ngay' : 'Revoke Admin Access Now'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div id="permission_table_container" className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {isVi ? 'Danh Sách Học Viên Đăng Ký Hệ Thống' : 'Registered Users Registry'}
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              {isVi 
                ? 'Tìm kiếm và quản lý quyền truy cập hoặc thay đổi trạng thái hoạt động của từng học viên.'
                : 'Search, investigate accounts, and grant or withdraw executive administrative permissions.'}
            </p>
          </div>

          {/* Filters and Search */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                <Search size={16} />
              </span>
              <input
                type="text"
                placeholder={isVi ? "Tìm tên, email, sđt..." : "Search name, email, phone..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
              />
            </div>

            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setRoleFilter('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${roleFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {isVi ? 'Tất cả' : 'All'}
              </button>
              <button
                onClick={() => setRoleFilter('admin')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${roleFilter === 'admin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Admin
              </button>
              <button
                onClick={() => setRoleFilter('student')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${roleFilter === 'student' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {isVi ? 'Học sinh' : 'Student'}
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">{isVi ? 'Thành Viên' : 'Member'}</th>
                <th className="px-6 py-4">{isVi ? 'Thông Tin Liên Hệ' : 'Contact Credentials'}</th>
                <th className="px-6 py-4">{isVi ? 'Vai Trò Hiện Tại' : 'Assigned Role'}</th>
                <th className="px-6 py-4">{isVi ? 'Ngày Tham Gia' : 'Joined Date'}</th>
                <th className="px-6 py-4">{isVi ? 'Trạng Tháii' : 'Status'}</th>
                <th className="px-6 py-4 text-right">{isVi ? 'Thao Tác Quyền' : 'Administrative Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <ShieldX size={40} className="text-slate-300" />
                      <span>{isVi ? 'Không tìm thấy người dùng nào phù hợp.' : 'No matching registered users found.'}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm ${
                          user.role === 'admin' ? 'bg-blue-600' : 'bg-emerald-600'
                        }`}>
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{user.name}</div>
                          <div className="text-xs text-slate-400">ID: {user.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-700 font-medium">{user.email}</div>
                      <div className="text-xs text-slate-500">{user.phone}</div>
                    </td>
                    <td className="px-6 py-4">
                      {user.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full border border-blue-100">
                          <ShieldCheck size={12} />
                          ADMIN
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-100">
                          <UserCheck size={12} />
                          STUDENT
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {user.createdAt}
                    </td>
                    <td className="px-6 py-4">
                      {user.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          {isVi ? 'Hoạt động' : 'Active'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-500 text-xs font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                          {isVi ? 'Bị khóa' : 'Locked'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {user.role === 'admin' ? (
                        <button
                          onClick={() => onRevokeAdmin(user.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 rounded-lg text-xs font-bold transition-all cursor-pointer"
                        >
                          <UserMinus size={13} />
                          {isVi ? 'Thu hồi quyền Admin' : 'Revoke Admin Access'}
                        </button>
                      ) : (
                        <button
                          onClick={() => onGrantAdmin(user.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition-all cursor-pointer"
                        >
                          <ShieldCheck size={13} />
                          {isVi ? 'Cấp quyền Admin' : 'Promote to Admin'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
