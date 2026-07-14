export type Role = 'owner' | 'admin' | 'student';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  status: 'active' | 'locked';
  createdAt: string;
  targetScore?: string;
  streak?: number;
  lastCheckInDate?: string;
  studySessions?: Record<string, number>; // date (YYYY-MM-DD) -> active study time in seconds
}

export interface Class {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  createdAt: string;
  studentIds: string[]; // List of Student User IDs in this class
}

export type ExamType = 'listening' | 'reading' | 'writing' | 'speaking' | 'full';

export interface Exam {
  id: string;
  title: string;
  type: ExamType;
  status: 'published' | 'draft';
  createdAt: string;
  duration: number; // in minutes
  questionsCount: number;
  difficulty?: string;
  coverImage?: string;
  showCoverImage?: boolean;
}

export interface Submission {
  studentId: string;
  status: 'done' | 'pending';
  submittedAt?: string;
  score?: number; // IELTS Band score e.g. 6.5
  duration?: number; // in minutes
}

export interface Assignment {
  id: string;
  classId: string;
  examId: string;
  title: string;
  type: ExamType;
  createdAt: string;
  deadline: string;
  status: 'active' | 'expired' | 'completed';
  submissions: Submission[];
}

export interface CenterSettings {
  logo: string;
  name: string;
  slogan: string;
  bannerUrl: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  facebook: string;
  zalo: string;
}

export interface CenterInformation {
  logo?: string;
  centerName?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  facebook?: string;
  zalo?: string;
  youtube?: string;
  instagram?: string;
  tiktok?: string;
  workingHours?: string;
  copyright?: string;
}

export interface AppNotification {
  id: string;
  role?: Role;
  userId?: string;
  textVi: string;
  textEn: string;
  timeVi: string;
  timeEn: string;
  isRead: boolean;
  createdAt: string;
}

export type RouteType = 
  | 'login' 
  | 'register' 
  | 'owner/dashboard' 
  | 'owner/permissions' 
  | 'owner/settings'
  | 'owner/users'
  | 'admin/dashboard' 
  | 'admin/exams' 
  | 'admin/classes' 
  | 'admin/classes/detail' // expects a classId in state
  | 'admin/students' 
  | 'admin/statistics' 
  | 'admin/settings'
  | 'student/dashboard'
  | 'student/exams'
  | 'student/class'
  | 'student/take-exam'; // expects examId or assignmentId in state

export interface VocabularyItem {
  id: string;
  userId: string;
  word: string;
  ipa?: string;
  pronunciation?: string;
  meaning?: string;
  vietnameseMeaning?: string;
  example?: string;
  collocation?: string;
  synonym?: string;
  source?: string;
  dateAdded: string;
  favorite: boolean;
}

export interface HighlightItem {
  id: string;
  userId: string;
  examId: string;
  text: string;
  color: 'yellow' | 'green' | 'pink' | 'blue';
  note?: string;
  createdAt: string;
}

export interface ExamBankFile {
  name: string;
  size: number;
  url: string;
}

export interface ExamBankItem {
  id: string;
  title: string;
  code: string;
  skill: ExamType;
  difficulty: string;
  timeLimit: number;
  description?: string;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
  wordFileUrl?: string;
  pdfFileUrl?: string;
  audioFiles?: ExamBankFile[];
  imageFiles?: ExamBankFile[];
  coverImage?: string;
  showCoverImage?: boolean;
  // New Parsing metadata & file organization
  isParsed?: boolean;
  parseStatus?: 'Not Parsed' | 'Parsing' | 'Parsed' | 'Parse Error';
  parsedData?: any;
  storageFiles?: {
    wordFileUrl?: string;
    pdfFileUrl?: string;
    audioFiles?: ExamBankFile[];
    imageFiles?: ExamBankFile[];
    listening?: {
      wordFileUrl?: string;
      audioFiles?: ExamBankFile[];
      imageFiles?: ExamBankFile[];
    };
    reading?: {
      wordFileUrl?: string;
      imageFiles?: ExamBankFile[];
    };
    writing?: {
      wordFileUrl?: string;
      imageFiles?: ExamBankFile[];
    };
    speaking?: {
      wordFileUrl?: string;
    };
  } | null;
}

