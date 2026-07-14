import React from 'react';
import { ShieldCheck, AlertTriangle, X, ShieldAlert } from 'lucide-react';
import { User } from '../../types';

interface RoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  user: User | null;
  actionType: 'grant' | 'revoke' | null;
}

export default function RoleModal({ isOpen, onClose, onConfirm, user, actionType }: RoleModalProps) {
  if (!isOpen || !user || !actionType) return null;

  const isGrant = actionType === 'grant';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all scale-100 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-6 py-5 flex items-center justify-between text-white ${
          isGrant ? 'bg-blue-600' : 'bg-red-600'
        }`}>
          <div className="flex items-center gap-2">
            {isGrant ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
            <span className="font-bold tracking-tight">Xác Nhận Thay Đổi Quyền</span>
          </div>
          <button 
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex items-start gap-4 mb-5">
            <div className={`p-3 rounded-full shrink-0 ${
              isGrant ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'
            }`}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900 mb-1">
                {isGrant ? 'Cấp quyền Quản trị viên (Admin)' : 'Thu hồi quyền Quản trị viên (Admin)'}
              </h4>
              <p className="text-sm text-slate-500 leading-relaxed">
                {isGrant ? (
                  <>
                    Bạn có chắc chắn muốn cấp quyền <strong className="text-slate-800">Admin (Trung tâm)</strong> cho tài khoản <strong className="text-blue-600">{user.name}</strong> ({user.email})? 
                    <br />
                    <span className="text-xs text-amber-600 block mt-1.5 font-semibold">
                      ⚠️ Lưu ý: Hệ thống chỉ cho phép duy nhất 1 Admin. Nếu đồng ý, quyền Admin của tài khoản cũ (nếu có) sẽ bị thu hồi hoàn toàn.
                    </span>
                  </>
                ) : (
                  <>
                    Bạn có chắc chắn muốn thu hồi quyền Admin của tài khoản <strong className="text-red-600">{user.name}</strong> ({user.email})? Tài khoản này sẽ quay lại làm học sinh thông thường.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Details list */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-6 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Học viên:</span>
              <span className="font-semibold text-slate-800">{user.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Email:</span>
              <span className="font-semibold text-slate-800">{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Vai trò sau xử lý:</span>
              <span className={`font-bold ${isGrant ? 'text-blue-600' : 'text-emerald-600'}`}>
                {isGrant ? 'ADMIN (TRUNG TÂM)' : 'STUDENT (HỌC SINH)'}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-sm font-semibold transition-all"
            >
              Hủy bỏ
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 text-white rounded-xl text-sm font-semibold shadow-md transition-all ${
                isGrant ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {isGrant ? 'Đồng Ý Cấp Quyền' : 'Xác Nhận Thu Hồi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
