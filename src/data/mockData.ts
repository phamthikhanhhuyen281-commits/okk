import { User, Class, Exam, Assignment, CenterSettings, AppNotification } from '../types';
import { 
  saveUsersCloud, 
  saveClassesCloud, 
  saveExamsCloud, 
  saveAssignmentsCloud, 
  saveSettingsCloud, 
  saveUserPasswordCloud, 
  addSecurityLogCloud, 
  saveNotificationsCloud, 
  clearAllCloudData 
} from './firebaseSync';

const INITIAL_USERS: User[] = [
  {
    id: 'user-owner-1',
    name: 'Phạm Khánh Huyền',
    email: 'phamthikhanhhuyen281@gmail.com',
    phone: '0923456789',
    role: 'owner',
    status: 'active',
    createdAt: '2026-02-15'
  }
];

const INITIAL_CLASSES: Class[] = [];

const INITIAL_EXAMS: Exam[] = [];

const INITIAL_ASSIGNMENTS: Assignment[] = [];

const INITIAL_SETTINGS: CenterSettings = {
  logo: '🎓',
  name: 'Aegis IELTS Academy',
  slogan: 'Trải nghiệm lộ trình cá nhân hóa, bứt phá band điểm IELTS',
  bannerUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
  description: 'Hệ thống luyện thi IELTS trực tuyến thông minh hàng đầu. Với thư viện đề thi phong phú, giao diện thi thực tế và các công cụ thống kê trực quan dành cho trung tâm, chúng tôi giúp học viên cải thiện điểm số vượt bậc một cách nhanh chóng.',
  address: '123 Đường Ba Tháng Hai, Phường 11, Quận 10, TP. Hồ Chí Minh',
  phone: '1900 8888',
  email: 'contact@aegisielts.edu.vn',
  facebook: 'facebook.com/aegisielts.academy',
  zalo: 'zalo.me/0901234567'
};

// LocalStorage helpers with fallback
export function getStoredUsers(): User[] {
  const data = localStorage.getItem('ielts_users');
  let list: User[] = [];
  if (!data) {
    list = [...INITIAL_USERS];
    localStorage.setItem('ielts_users', JSON.stringify(INITIAL_USERS));
  } else {
    try {
      list = JSON.parse(data);
    } catch (e) {
      list = [...INITIAL_USERS];
      localStorage.setItem('ielts_users', JSON.stringify(INITIAL_USERS));
    }
  }

  // Absolute Owner Guarantee & Dynamic Mock User Purge: To completely prevent duplicate keys (like user-owner-1)
  // and completely purge all mock student accounts from showing if they were previously stored,
  // we filter out any existing users matching ID 'user-owner-1', the owner emails, or any mock student IDs.
  const mockUserIds = ['user-student-1', 'user-student-2', 'user-student-3', 'user-student-4', 'user-student-5', 'user-student-6'];
  list = list.filter(u => 
    u.id !== 'user-owner-1' && 
    u.email.trim().toLowerCase() !== 'phamthikhanhhuyen281@gmail.com' &&
    !mockUserIds.includes(u.id)
  );

  // Guarantee that developer email hp7769361@gmail.com is pre-registered as a student "Huyền" if not already present
  const hasDeveloperStudent = list.some(u => u.email.trim().toLowerCase() === 'hp7769361@gmail.com');
  if (!hasDeveloperStudent) {
    list.push({
      id: 'user-student-developer',
      name: 'Huyền',
      email: 'hp7769361@gmail.com',
      phone: '0987654321',
      role: 'student',
      status: 'active',
      createdAt: '2026-07-11'
    });
  }

  list.unshift({
    id: 'user-owner-1',
    name: 'Phạm Khánh Huyền',
    email: 'phamthikhanhhuyen281@gmail.com',
    phone: '0923456789',
    role: 'owner',
    status: 'active',
    createdAt: '2026-02-15'
  });

  // Enforce absolute single-owner and single-admin invariants:
  // 1. Only phamthikhanhhuyen281@gmail.com can be Owner. Any other user's role with 'owner' is converted to 'student'.
  // 2. At most ONE user can be Admin. If there are multiple, keep the first one found and demote the rest to student.
  let foundAdminEmail: string | null = null;
  list = list.map(u => {
    const isOwnerEmail = u.email.trim().toLowerCase() === 'phamthikhanhhuyen281@gmail.com';
    if (isOwnerEmail) {
      return { ...u, role: 'owner' as const };
    }
    
    let role = u.role;
    if (role === 'owner') {
      role = 'student';
    }
    
    if (role === 'admin') {
      if (!foundAdminEmail) {
        foundAdminEmail = u.email.trim().toLowerCase();
      } else if (foundAdminEmail !== u.email.trim().toLowerCase()) {
        role = 'student';
      }
    }
    
    return { ...u, role };
  });

  localStorage.setItem('ielts_users', JSON.stringify(list));
  return list;
}

export function saveUsers(users: User[]): void {
  localStorage.setItem('ielts_users', JSON.stringify(users));
  saveUsersCloud(users);
}

export function getStoredClasses(): Class[] {
  const data = localStorage.getItem('ielts_classes');
  let list: Class[] = [];
  if (!data) {
    list = INITIAL_CLASSES;
    localStorage.setItem('ielts_classes', JSON.stringify(INITIAL_CLASSES));
  } else {
    try {
      list = JSON.parse(data);
    } catch (e) {
      list = INITIAL_CLASSES;
      localStorage.setItem('ielts_classes', JSON.stringify(INITIAL_CLASSES));
    }
  }

  // Purge mock class IDs completely so only real ones remain
  const mockClassIds = ['class-1', 'class-2', 'class-3', 'class-4', 'class-real-1'];
  list = list.filter(cls => !mockClassIds.includes(cls.id));

  // Clean up any remaining mock student IDs from classes dynamically
  const mockUserIds = ['user-student-1', 'user-student-2', 'user-student-3', 'user-student-4', 'user-student-5', 'user-student-6'];
  list = list.map(cls => ({
    ...cls,
    studentIds: cls.studentIds.filter(id => !mockUserIds.includes(id))
  }));

  return list;
}

export function saveClasses(classes: Class[]): void {
  localStorage.setItem('ielts_classes', JSON.stringify(classes));
  saveClassesCloud(classes);
}

export function getStoredExams(): Exam[] {
  const data = localStorage.getItem('ielts_exams');
  let list: Exam[] = [];
  if (!data) {
    list = INITIAL_EXAMS;
    localStorage.setItem('ielts_exams', JSON.stringify(INITIAL_EXAMS));
  } else {
    try {
      list = JSON.parse(data);
    } catch (e) {
      list = INITIAL_EXAMS;
      localStorage.setItem('ielts_exams', JSON.stringify(INITIAL_EXAMS));
    }
  }

  // Purge mock exam IDs completely so only real ones remain
  const mockExamIds = [
    'exam-listening-1', 'exam-listening-2', 
    'exam-reading-1', 'exam-reading-2', 
    'exam-writing-1', 'exam-writing-2', 
    'exam-speaking-1', 'exam-speaking-2', 
    'exam-full-1',
    'exam-reading-real-1', 'exam-listening-real-2', 'exam-writing-real-3'
  ];
  list = list.filter(ex => !mockExamIds.includes(ex.id));

  return list;
}

export function saveExams(exams: Exam[]): void {
  localStorage.setItem('ielts_exams', JSON.stringify(exams));
  saveExamsCloud(exams);
}

export function getStoredAssignments(): Assignment[] {
  const data = localStorage.getItem('ielts_assignments');
  let list: Assignment[] = [];
  if (!data) {
    list = INITIAL_ASSIGNMENTS;
    localStorage.setItem('ielts_assignments', JSON.stringify(INITIAL_ASSIGNMENTS));
  } else {
    try {
      list = JSON.parse(data);
    } catch (e) {
      list = INITIAL_ASSIGNMENTS;
      localStorage.setItem('ielts_assignments', JSON.stringify(INITIAL_ASSIGNMENTS));
    }
  }

  // Purge mock assignment IDs completely so only real ones remain
  const mockAssignmentIds = ['assign-1', 'assign-2', 'assign-3', 'assign-real-1'];
  list = list.filter(a => !mockAssignmentIds.includes(a.id));

  // Clean up mock submissions
  const mockUserIds = ['user-student-1', 'user-student-2', 'user-student-3', 'user-student-4', 'user-student-5', 'user-student-6'];
  list = list.map(assign => ({
    ...assign,
    submissions: assign.submissions ? assign.submissions.filter(sub => !mockUserIds.includes(sub.studentId)) : []
  }));

  return list;
}

export function saveAssignments(assignments: Assignment[]): void {
  localStorage.setItem('ielts_assignments', JSON.stringify(assignments));
  saveAssignmentsCloud(assignments);
}

export function getStoredSettings(): CenterSettings {
  const data = localStorage.getItem('ielts_settings');
  if (!data) {
    localStorage.setItem('ielts_settings', JSON.stringify(INITIAL_SETTINGS));
    return INITIAL_SETTINGS;
  }
  return JSON.parse(data);
}

export function saveSettings(settings: CenterSettings): void {
  localStorage.setItem('ielts_settings', JSON.stringify(settings));
  saveSettingsCloud(settings);
}

// Stats helper
export function getAdminStats() {
  const users = getStoredUsers();
  const classes = getStoredClasses();
  const exams = getStoredExams();
  const assignments = getStoredAssignments();

  // 1. Total student count - ONLY students added to classes, count unique students.
  const activeStudentIdsInClasses = new Set<string>();
  classes.forEach(cls => {
    cls.studentIds.forEach(id => {
      activeStudentIdsInClasses.add(id);
    });
  });
  
  // Clean check: make sure these IDs belong to users whose role is 'student'
  const enrolledStudents = users.filter(u => u.role === 'student' && activeStudentIdsInClasses.has(u.id));
  const totalStudentsEnrolledCount = enrolledStudents.length;

  // 2. Total classes
  const totalClassesCount = classes.length;

  // 3. Total exams
  const totalExamsCount = exams.length;

  // 4. Total active assignments
  const activeAssignmentsCount = assignments.filter(a => a.status === 'active').length;

  return {
    enrolledStudentsCount: totalStudentsEnrolledCount,
    classesCount: totalClassesCount,
    examsCount: totalExamsCount,
    activeAssignmentsCount: activeAssignmentsCount
  };
}

export function getStoredPasswords(): Record<string, string> {
  const data = localStorage.getItem('ielts_passwords');
  let passwords: Record<string, string> = {};
  if (!data) {
    passwords = {
      'phamthikhanhhuyen281@gmail.com': 'HuyenOwner@2026'
    };
    localStorage.setItem('ielts_passwords', JSON.stringify(passwords));
  } else {
    try {
      passwords = JSON.parse(data);
    } catch (e) {
      passwords = {
        'phamthikhanhhuyen281@gmail.com': 'HuyenOwner@2026'
      };
      localStorage.setItem('ielts_passwords', JSON.stringify(passwords));
    }
  }

  // Purge any remaining mock student credentials dynamically
  const mockEmails = ['student@ielts.com', 'quan.nguyen@gmail.com', 'duong.vu@yahoo.com'];
  mockEmails.forEach(email => {
    delete passwords[email];
  });

  // Ensure absolute secure protection for owner email in local credentials storage
  const ownerEmail = 'phamthikhanhhuyen281@gmail.com';
  if (!passwords[ownerEmail] || passwords[ownerEmail] === '') {
    passwords[ownerEmail] = 'HuyenOwner@2026';
  }
  localStorage.setItem('ielts_passwords', JSON.stringify(passwords));

  return passwords;
}

export function saveUserPassword(email: string, password: string): void {
  const passwords = getStoredPasswords();
  passwords[email.trim().toLowerCase()] = password;
  localStorage.setItem('ielts_passwords', JSON.stringify(passwords));
  saveUserPasswordCloud(email, password);
}

export interface SecurityLog {
  id: string;
  action: string;
  detail: string;
  time: string;
}

export function getStoredSecurityLogs(): SecurityLog[] {
  const data = localStorage.getItem('ielts_security_logs');
  if (!data) {
    const initialLogs: SecurityLog[] = [
      { id: 'log-1', action: 'Kích hoạt hệ thống', detail: 'Hệ thống bảo mật Aegis IELTS khởi chạy thành công', time: '08:00 Hôm nay' },
      { id: 'log-2', action: 'Bảo mật Owner', detail: 'Tài khoản phamthikhanhhuyen281@gmail.com được cấp đặc quyền tối thượng', time: '08:05 Hôm nay' },
      { id: 'log-3', action: 'Đồng bộ hóa database', detail: 'Khởi tạo phân vùng bảo mật Firestore Secure Partition thành công', time: '09:12 Hôm nay' }
    ];
    localStorage.setItem('ielts_security_logs', JSON.stringify(initialLogs));
    return initialLogs;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

export function addSecurityLog(action: string, detail: string): void {
  const logs = getStoredSecurityLogs();
  const formatTime = () => {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    return `${hrs}:${mins} Hôm nay`;
  };
  const newLog: SecurityLog = {
    id: `log-${Date.now()}`,
    action,
    detail,
    time: formatTime()
  };
  const updatedLogs = [newLog, ...logs].slice(0, 10);
  localStorage.setItem('ielts_security_logs', JSON.stringify(updatedLogs));
  addSecurityLogCloud(newLog);
}

export function resetSystemData(): void {
  localStorage.removeItem('ielts_users');
  localStorage.removeItem('ielts_classes');
  localStorage.removeItem('ielts_exams');
  localStorage.removeItem('ielts_assignments');
  localStorage.removeItem('ielts_settings');
  localStorage.removeItem('ielts_passwords');
  localStorage.removeItem('ielts_security_logs');
  localStorage.removeItem('ielts_notifications');
  localStorage.removeItem('ielts_current_user');
  localStorage.removeItem('ielts_current_route');
  
  clearAllCloudData();
  
  // Re-run getStoredUsers to populate
  getStoredUsers();
  getStoredClasses();
  getStoredExams();
  getStoredAssignments();
  getStoredSettings();
  getStoredPasswords();
  getStoredSecurityLogs();
  getStoredNotifications();
}

export function getStoredNotifications(): AppNotification[] {
  let data = localStorage.getItem('ielts_notifications');
  
  if (!data) {
    const initialNotifications: AppNotification[] = [
      {
        id: 'sys-ready-notification',
        textVi: '🛡️ Hệ thống quản lý Aegis IELTS Academy đã khởi động và sẵn sàng hoạt động.',
        textEn: '🛡️ Aegis IELTS Academy management system is initialized and ready.',
        timeVi: 'Vừa xong',
        timeEn: 'Just now',
        isRead: false,
        createdAt: new Date().toISOString()
      }
    ];
    localStorage.setItem('ielts_notifications', JSON.stringify(initialNotifications));
    return initialNotifications;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

export function saveNotifications(notifications: AppNotification[]): void {
  localStorage.setItem('ielts_notifications', JSON.stringify(notifications));
  saveNotificationsCloud(notifications);
}

export function formatNotificationTime(isoString: string, lang: 'vi' | 'en'): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  
  // Extract exact hour and minutes
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  if (diffMs < 0) {
    return lang === 'vi' ? `Vừa xong (lúc ${timeStr})` : `Just now (at ${timeStr})`;
  }
  
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) {
    return lang === 'vi' ? `Vừa xong (lúc ${timeStr})` : `Just now (at ${timeStr})`;
  }
  if (diffMins < 60) {
    return lang === 'vi' ? `${diffMins} phút trước (lúc ${timeStr})` : `${diffMins} mins ago (at ${timeStr})`;
  }
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    // Check if it is the same calendar day
    const isToday = date.getDate() === now.getDate() && 
                    date.getMonth() === now.getMonth() && 
                    date.getFullYear() === now.getFullYear();
    if (isToday) {
      return lang === 'vi' ? `${diffHours} giờ trước (lúc ${timeStr})` : `${diffHours} hours ago (at ${timeStr})`;
    }
  }
  
  const diffDays = Math.max(1, Math.floor(diffHours / 24));
  const dateStr = date.toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', { month: 'numeric', day: 'numeric' });
  return lang === 'vi' ? `${diffDays} ngày trước (lúc ${timeStr} ngày ${dateStr})` : `${diffDays} days ago (at ${timeStr} on ${dateStr})`;
}
