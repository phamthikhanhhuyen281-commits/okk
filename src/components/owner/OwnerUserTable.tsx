import React, { useState } from 'react';
import { Search, Eye, ShieldAlert, Ban, Unlock, ShieldCheck, Key, RefreshCw, UserCheck } from 'lucide-react';
import { User, Class } from '../../types';

interface OwnerUserTableProps {
  users: User[];
  classes: Class[];
  onToggleStatus: (userId: string) => void;
  onViewDetails: (userId: string) => void;
  language?: 'vi' | 'en';
}

export default function OwnerUserTable({ users, classes, onToggleStatus, onViewDetails, language = 'vi' }: OwnerUserTableProps) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'owner' | 'admin' | 'student'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'locked'>('all');

  const isVi = language === 'vi';

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      user.phone.includes(search);

    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Helper to get class name(s) for a student
  const getUserClassesString = (user: User) => {
    if (user.role === 'owner') return isVi ? 'Chủ Hệ Thống' : 'System Owner';
    if (user.role === 'admin') return isVi ? 'Quản Trị Viên' : 'Administrator';
    
    const studentClasses = classes.filter(cls => cls.studentIds.includes(user.id));
    if (studentClasses.length === 0) return isVi ? 'Chưa xếp lớp' : 'Unassigned';
    return studentClasses.map(c => c.name.split(' - ')[0]).join(', ');
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Search and Filters Header */}
      <div className="p-6 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            {isVi ? 'Danh Sách Tài Khoản Hệ Thống' : 'System Accounts Directory'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {isVi 
              ? 'Giám sát trạng thái hoạt động của Chủ sở hữu, Quản trị viên và Học viên trên toàn hệ thống.'
              : 'Monitor activation state and system records of Owner, Administrator, and Student roles.'}
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
              placeholder={isVi ? 'Tìm tên, email, sđt...' : 'Search name, email, phone...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 w-52 transition-all"
            />
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600 font-medium"
          >
            <option value="all">{isVi ? 'Tất cả vai trò' : 'All Roles'}</option>
            <option value="owner">{isVi ? 'Chủ sở hữu (Owner)' : 'Owner'}</option>
            <option value="admin">{isVi ? 'Quản trị viên (Admin)' : 'Admin'}</option>
            <option value="student">{isVi ? 'Học sinh (Student)' : 'Student'}</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600 font-medium"
          >
            <option value="all">{isVi ? 'Mọi trạng thái' : 'All Statuses'}</option>
            <option value="active">{isVi ? 'Đang hoạt động' : 'Active'}</option>
            <option value="locked">{isVi ? 'Bị khóa' : 'Locked'}</option>
          </select>
        </div>
      </div>

      {/* Table Area */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 text-xs font-bold uppercase tracking-wider">
              <th className="px-6 py-4">{isVi ? 'Thành viên' : 'Member'}</th>
              <th className="px-6 py-4">{isVi ? 'Vai trò' : 'Role'}</th>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">{isVi ? 'Số điện thoại' : 'Phone'}</th>
              <th className="px-6 py-4">{isVi ? 'Lớp / Phân khu' : 'Class / Assignment'}</th>
              <th className="px-6 py-4">{isVi ? 'Trạng thái' : 'Status'}</th>
              <th className="px-6 py-4 text-right">{isVi ? 'Tác động' : 'Action'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <span className="text-3xl">🔍</span>
                    <span className="font-semibold text-slate-500 text-sm">
                      {isVi ? 'Không tìm thấy tài khoản phù hợp' : 'No matching accounts found'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {isVi ? 'Hãy thử thay đổi từ khóa hoặc bộ lọc' : 'Try modifying keywords or search filter'}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const classesString = getUserClassesString(user);
                const isOwner = user.role === 'owner';
                const isAdmin = user.role === 'admin';
                const isUnassigned = classesString === (isVi ? 'Chưa xếp lớp' : 'Unassigned');

                return (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Name column */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full font-extrabold flex items-center justify-center border ${
                          isOwner 
                            ? 'bg-amber-50 text-amber-700 border-amber-200' 
                            : isAdmin
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}>
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                            {user.name}
                            {isOwner && (
                              <span className="text-amber-500 text-xs" title={isVi ? "Chủ sở hữu tối thượng" : "Supreme system owner"}>👑</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-semibold uppercase">ID: {user.id.substring(0, 10)}</div>
                        </div>
                      </div>
                    </td>

                    {/* Role Column */}
                    <td className="px-6 py-4">
                      {isOwner ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-extrabold uppercase tracking-wider shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          OWNER
                        </span>
                      ) : isAdmin ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[10px] font-extrabold uppercase tracking-wider shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                          ADMIN
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600 text-[10px] font-extrabold uppercase tracking-wider">
                          STUDENT
                        </span>
                      )}
                    </td>

                    {/* Email */}
                    <td className="px-6 py-4 text-slate-700 font-semibold text-xs">
                      {user.email}
                    </td>

                    {/* Phone */}
                    <td className="px-6 py-4 text-slate-600 font-semibold font-mono text-xs">
                      {user.phone}
                    </td>

                    {/* Enrolled classes / section */}
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-lg font-semibold ${
                        isOwner 
                          ? 'bg-amber-50/50 text-amber-700 border border-amber-100' 
                          : isAdmin
                            ? 'bg-blue-50/50 text-blue-700 border border-blue-100'
                            : isUnassigned 
                              ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                      }`}>
                        {classesString}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      {user.status === 'active' ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-600 text-xs font-extrabold">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          {isVi ? 'Đang hoạt động' : 'Active'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-red-500 text-xs font-extrabold bg-red-50 px-2.5 py-1 rounded-lg border border-red-100">
                          <span className="w-2 h-2 rounded-full bg-red-500"></span>
                          {isVi ? 'Đã bị khóa' : 'Locked'}
                        </span>
                      )}
                    </td>

                    {/* Action buttons */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2.5">
                        <button
                          onClick={() => onViewDetails(user.id)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title={isVi ? "Xem thông tin chi tiết" : "View profile details"}
                        >
                          <Eye size={16} />
                        </button>
                        
                        {isOwner ? (
                          <span className="text-[10px] text-amber-600 font-bold bg-amber-50 border border-amber-100 px-2 py-1 rounded-md" title={isVi ? "Đặc quyền tối cao không thể khóa" : "Supreme immunity privileges"}>
                            {isVi ? 'Miễn nhiễm khóa' : 'Immune'}
                          </span>
                        ) : (
                          <button
                            onClick={() => onToggleStatus(user.id)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              user.status === 'active' 
                                ? 'text-slate-400 hover:text-red-600 hover:bg-red-50' 
                                : 'text-red-500 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={user.status === 'active' ? (isVi ? "Khóa tài khoản" : "Lock account") : (isVi ? "Mở khóa tài khoản" : "Unlock account")}
                          >
                            {user.status === 'active' ? <Ban size={16} /> : <Unlock size={16} />}
                          </button>
                        )}
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
