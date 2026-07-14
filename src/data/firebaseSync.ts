import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDoc 
} from 'firebase/firestore';
import { db } from './firebase';
import { User, Class, Exam, Assignment, CenterSettings, CenterInformation, AppNotification, VocabularyItem, HighlightItem } from '../types';
import { SecurityLog } from './mockData';
import { resolveExamBankItem, resolveFileUrl } from '../utils/localFileCache';

// Helper to fetch all document IDs in a collection
async function getCollectionDocIds(collectionName: string): Promise<string[]> {
  try {
    const querySnapshot = await getDocs(collection(db, collectionName));
    return querySnapshot.docs.map(doc => doc.id);
  } catch (e) {
    console.error(`Error fetching collection doc IDs for ${collectionName}:`, e);
    return [];
  }
}

// Safely remove any undefined properties so Firestore doesn't throw errors
function clean<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  return JSON.parse(JSON.stringify(obj));
}

// 1. Core Cloud Sync Function
export async function syncFromFirebase() {
  console.log('🔄 Starting Firebase cloud data synchronization...');
  
  try {
    // ---- USERS ----
    const usersSnapshot = await getDocs(collection(db, 'users'));
    let cloudUsers: User[] = [];
    if (usersSnapshot.empty) {
      // Seed Firestore with local storage data
      const localData = localStorage.getItem('ielts_users');
      if (localData) {
        try {
          const parsed = JSON.parse(localData) as User[];
          for (const u of parsed) {
            await setDoc(doc(db, 'users', u.id), clean(u));
          }
          cloudUsers = parsed;
        } catch (e) {
          console.error('Error parsing local users:', e);
        }
      }
    } else {
      cloudUsers = usersSnapshot.docs.map(doc => doc.data() as User);
      localStorage.setItem('ielts_users', JSON.stringify(cloudUsers));
    }

    // ---- CLASSES ----
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    let cloudClasses: Class[] = [];
    if (classesSnapshot.empty) {
      const localData = localStorage.getItem('ielts_classes');
      if (localData) {
        try {
          const parsed = JSON.parse(localData) as Class[];
          for (const c of parsed) {
            await setDoc(doc(db, 'classes', c.id), clean(c));
          }
          cloudClasses = parsed;
        } catch (e) {
          console.error('Error parsing local classes:', e);
        }
      }
    } else {
      cloudClasses = classesSnapshot.docs.map(doc => doc.data() as Class);
      localStorage.setItem('ielts_classes', JSON.stringify(cloudClasses));
    }

    // ---- EXAMS ----
    const examsSnapshot = await getDocs(collection(db, 'exams'));
    let cloudExams: Exam[] = [];
    if (examsSnapshot.empty) {
      const localData = localStorage.getItem('ielts_exams');
      if (localData) {
        try {
          const parsed = JSON.parse(localData) as Exam[];
          for (const ex of parsed) {
            await setDoc(doc(db, 'exams', ex.id), clean(ex));
          }
          cloudExams = parsed;
        } catch (e) {
          console.error('Error parsing local exams:', e);
        }
      }
    } else {
      cloudExams = examsSnapshot.docs.map(doc => doc.data() as Exam);
    }

    // Load from exam_bank and merge with cloudExams
    try {
      const examBankSnapshot = await getDocs(collection(db, 'exam_bank'));
      const rawBankItems = examBankSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as any);

      // Do NOT fully resolve cache tokens (massive base64 audio and image files) of every exam bank item during syncing,
      // as they are resolved lazily at play/render time. This keeps the stored items in localStorage extremely small
      // and prevents QuotaExceededError in the browser.
      const examBankItems = rawBankItems;

      for (const bankItem of examBankItems) {
        const parsedData = bankItem.parsedData || {};
        const sections = parsedData.sections || [];

        let questionsCount = 0;
        if (sections.length > 0) {
          sections.forEach((sec: any) => {
            if (sec.questionGroups) {
              sec.questionGroups.forEach((grp: any) => {
                if (grp.questions) {
                  questionsCount += grp.questions.length;
                }
              });
            }
          });
        }

        const mappedSections = sections.map((sec: any, sIdx: number) => {
          const questionsList: any[] = [];
          if (sec.questionGroups) {
            sec.questionGroups.forEach((grp: any) => {
              if (grp.questions) {
                grp.questions.forEach((q: any) => {
                  questionsList.push({
                    number: q.number,
                    questionType: grp.type,
                    questionText: q.text,
                    options: q.options || [],
                    correctAnswer: q.answer,
                    explanation: q.explanation || '',
                    questionInstruction: grp.instruction || ''
                  });
                });
              }
            });
          }

          const fallbackAudio = sec.audioUrl || bankItem.audioUrl || bankItem.audio || bankItem.audioFiles?.[0]?.url || bankItem.storageFiles?.audioFiles?.[0]?.url || bankItem.storageFiles?.listening?.audioFiles?.[0]?.url || '';
          const fallbackImage = sec.imageUrl || bankItem.imageUrl || bankItem.image || bankItem.imageFiles?.[0]?.url || bankItem.storageFiles?.imageFiles?.[0]?.url || bankItem.storageFiles?.listening?.imageFiles?.[0]?.url || '';

          return {
            sectionNumber: sIdx + 1,
            id: sec.id || `Section ${sIdx + 1}`,
            title: sec.title || '',
            audioUrl: fallbackAudio,
            imageUrl: fallbackImage,
            transcript: sec.transcript || '',
            translation: sec.translation || '',
            vocabulary: sec.vocabulary || '',
            questions: questionsList
          };
        });

        const mappedPassages = bankItem.skill === 'reading' ? sections.map((sec: any, sIdx: number) => {
          const pTitle = sec.passages?.[0]?.title || sec.title || `Passage ${sIdx + 1}`;
          const pContent = sec.passages?.[0]?.content || '';
          const questionsList: any[] = [];
          if (sec.questionGroups) {
            sec.questionGroups.forEach((grp: any) => {
              if (grp.questions) {
                grp.questions.forEach((q: any) => {
                  questionsList.push({
                    number: q.number,
                    questionType: grp.type,
                    questionText: q.text,
                    options: q.options || [],
                    correctAnswer: q.answer,
                    explanation: q.explanation || '',
                    questionInstruction: grp.instruction || ''
                  });
                });
              }
            });
          }

          const fallbackAudio = sec.audioUrl || bankItem.audioUrl || bankItem.audio || bankItem.audioFiles?.[0]?.url || bankItem.storageFiles?.audioFiles?.[0]?.url || bankItem.storageFiles?.listening?.audioFiles?.[0]?.url || '';
          const fallbackImage = sec.imageUrl || bankItem.imageUrl || bankItem.image || bankItem.imageFiles?.[0]?.url || bankItem.storageFiles?.imageFiles?.[0]?.url || bankItem.storageFiles?.listening?.imageFiles?.[0]?.url || '';

          return {
            passageNumber: sIdx + 1,
            title: pTitle,
            content: pContent,
            audioUrl: fallbackAudio,
            imageUrl: fallbackImage,
            translation: sec.translation || sec.passages?.[0]?.translation || '',
            vocabulary: sec.vocabulary || sec.passages?.[0]?.vocabulary || '',
            questions: questionsList
          };
        }) : [];

        const mappedExam: any = {
          id: bankItem.id,
          title: bankItem.title,
          type: bankItem.skill,
          status: bankItem.status,
          createdAt: bankItem.createdAt || bankItem.updatedAt || new Date().toISOString(),
          duration: Number(bankItem.timeLimit) || 40,
          questionsCount: questionsCount || Number(bankItem.questionsCount) || 0,
          difficulty: bankItem.difficulty,
          coverImage: await resolveFileUrl(bankItem.coverImage || ''),
          showCoverImage: bankItem.showCoverImage !== false,
          sections: mappedSections,
          passages: mappedPassages,
          writingTask1: parsedData.writingTask1,
          writingTask2: parsedData.writingTask2,
          speakingPart1: parsedData.speakingPart1,
          speakingPart2: parsedData.speakingPart2,
          speakingPart3: parsedData.speakingPart3,
        };

        const index = cloudExams.findIndex(ex => ex.id === bankItem.id);
        if (index > -1) {
          cloudExams[index] = mappedExam;
        } else {
          cloudExams.push(mappedExam);
        }
      }

      localStorage.setItem('ielts_exams', JSON.stringify(cloudExams));
    } catch (e) {
      console.error('Error fetching/merging exam_bank:', e);
    }

    // ---- ASSIGNMENTS ----
    const assignmentsSnapshot = await getDocs(collection(db, 'assignments'));
    let cloudAssignments: Assignment[] = [];
    if (assignmentsSnapshot.empty) {
      const localData = localStorage.getItem('ielts_assignments');
      if (localData) {
        try {
          const parsed = JSON.parse(localData) as Assignment[];
          for (const a of parsed) {
            await setDoc(doc(db, 'assignments', a.id), clean(a));
          }
          cloudAssignments = parsed;
        } catch (e) {
          console.error('Error parsing local assignments:', e);
        }
      }
    } else {
      cloudAssignments = assignmentsSnapshot.docs.map(doc => doc.data() as Assignment);
      localStorage.setItem('ielts_assignments', JSON.stringify(cloudAssignments));
    }

    // ---- SETTINGS ----
    const settingsDocRef = doc(db, 'settings', 'center_settings');
    const settingsSnapshot = await getDoc(settingsDocRef);
    let cloudSettings: CenterSettings | null = null;
    if (!settingsSnapshot.exists()) {
      const localData = localStorage.getItem('ielts_settings');
      if (localData) {
        try {
          const parsed = JSON.parse(localData) as CenterSettings;
          await setDoc(settingsDocRef, clean(parsed));
          cloudSettings = parsed;
        } catch (e) {
          console.error('Error parsing local settings:', e);
        }
      }
    } else {
      cloudSettings = settingsSnapshot.data() as CenterSettings;
      localStorage.setItem('ielts_settings', JSON.stringify(cloudSettings));
    }

    // ---- CENTER INFORMATION ----
    const centerInfoDocRef = doc(db, 'centerInformation', 'settings');
    const centerInfoSnapshot = await getDoc(centerInfoDocRef);
    let cloudCenterInfo: CenterInformation | null = null;
    if (!centerInfoSnapshot.exists()) {
      const localData = localStorage.getItem('ielts_center_information');
      if (localData) {
        try {
          cloudCenterInfo = JSON.parse(localData) as CenterInformation;
          await setDoc(centerInfoDocRef, clean(cloudCenterInfo));
        } catch (e) {
          console.error('Error parsing local center info:', e);
        }
      }
      if (!cloudCenterInfo) {
        cloudCenterInfo = {
          logo: "IELTS Master",
          centerName: "Trung tâm Anh ngữ IELTS Master",
          address: "123 Đường Ba Tháng Hai, Quận 10, TP. Hồ Chí Minh",
          phone: "0901234567",
          email: "contact@ieltsmaster.edu.vn",
          website: "https://ieltsmaster.edu.vn",
          facebook: "https://facebook.com/ieltsmaster",
          zalo: "https://zalo.me/0901234567",
          youtube: "https://youtube.com/@ieltsmaster",
          instagram: "https://instagram.com/ieltsmaster",
          tiktok: "https://tiktok.com/@ieltsmaster",
          workingHours: "Thứ 2 - Chủ nhật: 08:00 - 21:30",
          copyright: "© 2026 IELTS Master. All Rights Reserved."
        };
        await setDoc(centerInfoDocRef, clean(cloudCenterInfo));
        localStorage.setItem('ielts_center_information', JSON.stringify(cloudCenterInfo));
      }
    } else {
      cloudCenterInfo = centerInfoSnapshot.data() as CenterInformation;
      localStorage.setItem('ielts_center_information', JSON.stringify(cloudCenterInfo));
    }

    // ---- PASSWORDS ----
    const passwordsSnapshot = await getDocs(collection(db, 'passwords'));
    let cloudPasswords: Record<string, string> = {};
    if (passwordsSnapshot.empty) {
      const localData = localStorage.getItem('ielts_passwords');
      if (localData) {
        try {
          const parsed = JSON.parse(localData) as Record<string, string>;
          for (const [email, password] of Object.entries(parsed)) {
            const safeDocId = encodeURIComponent(email.trim().toLowerCase());
            await setDoc(doc(db, 'passwords', safeDocId), clean({ email, password }));
          }
          cloudPasswords = parsed;
        } catch (e) {
          console.error('Error parsing local passwords:', e);
        }
      }
    } else {
      passwordsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.email && data.password) {
          cloudPasswords[data.email.trim().toLowerCase()] = data.password;
        }
      });
      localStorage.setItem('ielts_passwords', JSON.stringify(cloudPasswords));
    }

    // ---- SECURITY LOGS ----
    const logsSnapshot = await getDocs(collection(db, 'security_logs'));
    let cloudLogs: SecurityLog[] = [];
    if (logsSnapshot.empty) {
      const localData = localStorage.getItem('ielts_security_logs');
      if (localData) {
        try {
          const parsed = JSON.parse(localData) as SecurityLog[];
          for (const log of parsed) {
            await setDoc(doc(db, 'security_logs', log.id), clean(log));
          }
          cloudLogs = parsed;
        } catch (e) {
          console.error('Error parsing local security logs:', e);
        }
      }
    } else {
      cloudLogs = logsSnapshot.docs.map(doc => doc.data() as SecurityLog);
      // Sort logs by time/id desc to match UI expectations
      cloudLogs.sort((a, b) => b.id.localeCompare(a.id));
      localStorage.setItem('ielts_security_logs', JSON.stringify(cloudLogs));
    }

    // ---- NOTIFICATIONS ----
    const notificationsSnapshot = await getDocs(collection(db, 'notifications'));
    let cloudNotifications: AppNotification[] = [];
    if (notificationsSnapshot.empty) {
      const localData = localStorage.getItem('ielts_notifications');
      if (localData) {
        try {
          const parsed = JSON.parse(localData) as AppNotification[];
          for (const n of parsed) {
            await setDoc(doc(db, 'notifications', n.id), clean(n));
          }
          cloudNotifications = parsed;
        } catch (e) {
          console.error('Error parsing local notifications:', e);
        }
      }
    } else {
      cloudNotifications = notificationsSnapshot.docs.map(doc => doc.data() as AppNotification);
      cloudNotifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      localStorage.setItem('ielts_notifications', JSON.stringify(cloudNotifications));
    }

    console.log('✅ Firebase cloud data synchronized successfully.');
    return {
      users: cloudUsers,
      classes: cloudClasses,
      exams: cloudExams,
      assignments: cloudAssignments,
      settings: cloudSettings,
      centerInformation: cloudCenterInfo,
      securityLogs: cloudLogs,
      notifications: cloudNotifications
    };

  } catch (error) {
    console.error('❌ Error during Firebase synchronization:', error);
    return null;
  }
}

// 2. Sync Save Helpers
export async function saveUsersCloud(users: User[]) {
  try {
    const existingDocIds = await getCollectionDocIds('users');
    const newDocIds = new Set(users.map(u => u.id));
    
    // Save/Update all active users
    for (const u of users) {
      await setDoc(doc(db, 'users', u.id), clean(u));
    }
    
    // Clean up orphaned records
    for (const id of existingDocIds) {
      if (!newDocIds.has(id)) {
        await deleteDoc(doc(db, 'users', id));
      }
    }
  } catch (e) {
    console.error('Error saving users to cloud:', e);
  }
}

export async function saveClassesCloud(classes: Class[]) {
  try {
    const existingDocIds = await getCollectionDocIds('classes');
    const newDocIds = new Set(classes.map(c => c.id));
    
    for (const c of classes) {
      await setDoc(doc(db, 'classes', c.id), clean(c));
    }
    
    for (const id of existingDocIds) {
      if (!newDocIds.has(id)) {
        await deleteDoc(doc(db, 'classes', id));
      }
    }
  } catch (e) {
    console.error('Error saving classes to cloud:', e);
  }
}

export async function saveExamsCloud(exams: Exam[]) {
  try {
    const existingDocIds = await getCollectionDocIds('exams');
    const newDocIds = new Set(exams.map(ex => ex.id));
    
    for (const ex of exams) {
      await setDoc(doc(db, 'exams', ex.id), clean(ex));
    }
    
    for (const id of existingDocIds) {
      if (!newDocIds.has(id)) {
        await deleteDoc(doc(db, 'exams', id));
      }
    }
  } catch (e) {
    console.error('Error saving exams to cloud:', e);
  }
}

export async function saveAssignmentsCloud(assignments: Assignment[]) {
  try {
    const existingDocIds = await getCollectionDocIds('assignments');
    const newDocIds = new Set(assignments.map(a => a.id));
    
    for (const a of assignments) {
      await setDoc(doc(db, 'assignments', a.id), clean(a));
    }
    
    for (const id of existingDocIds) {
      if (!newDocIds.has(id)) {
        await deleteDoc(doc(db, 'assignments', id));
      }
    }
  } catch (e) {
    console.error('Error saving assignments to cloud:', e);
  }
}

export async function saveSettingsCloud(settings: CenterSettings) {
  try {
    await setDoc(doc(db, 'settings', 'center_settings'), clean(settings));
  } catch (e) {
    console.error('Error saving settings to cloud:', e);
  }
}

export async function saveUserPasswordCloud(email: string, pass: string) {
  try {
    const safeDocId = encodeURIComponent(email.trim().toLowerCase());
    await setDoc(doc(db, 'passwords', safeDocId), clean({ email, password: pass }));
  } catch (e) {
    console.error('Error saving password to cloud:', e);
  }
}

export async function addSecurityLogCloud(log: SecurityLog) {
  try {
    await setDoc(doc(db, 'security_logs', log.id), clean(log));
  } catch (e) {
    console.error('Error saving security log to cloud:', e);
  }
}

export async function saveNotificationsCloud(notifications: AppNotification[]) {
  try {
    const existingDocIds = await getCollectionDocIds('notifications');
    const newDocIds = new Set(notifications.map(n => n.id));
    
    for (const n of notifications) {
      await setDoc(doc(db, 'notifications', n.id), clean(n));
    }
    
    for (const id of existingDocIds) {
      if (!newDocIds.has(id)) {
        await deleteDoc(doc(db, 'notifications', id));
      }
    }
  } catch (e) {
    console.error('Error saving notifications to cloud:', e);
  }
}

export async function getVocabulariesCloud(userId: string): Promise<VocabularyItem[]> {
  try {
    const querySnapshot = await getDocs(collection(db, 'vocabularies'));
    const items = querySnapshot.docs.map(doc => doc.data() as VocabularyItem);
    return items.filter(item => item.userId === userId);
  } catch (e) {
    console.error('Error fetching vocabularies:', e);
    return [];
  }
}

export async function saveVocabularyCloud(vocab: VocabularyItem): Promise<void> {
  try {
    await setDoc(doc(db, 'vocabularies', vocab.id), clean(vocab));
  } catch (e) {
    console.error('Error saving vocabulary to cloud:', e);
  }
}

export async function deleteVocabularyCloud(vocabId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'vocabularies', vocabId));
  } catch (e) {
    console.error('Error deleting vocabulary from cloud:', e);
  }
}

export async function getHighlightsCloud(userId: string): Promise<HighlightItem[]> {
  try {
    const querySnapshot = await getDocs(collection(db, 'highlights'));
    const items = querySnapshot.docs.map(doc => doc.data() as HighlightItem);
    return items.filter(item => item.userId === userId);
  } catch (e) {
    console.error('Error fetching highlights:', e);
    return [];
  }
}

export async function saveHighlightCloud(highlight: HighlightItem): Promise<void> {
  try {
    await setDoc(doc(db, 'highlights', highlight.id), clean(highlight));
  } catch (e) {
    console.error('Error saving highlight to cloud:', e);
  }
}

export async function deleteHighlightCloud(highlightId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'highlights', highlightId));
  } catch (e) {
    console.error('Error deleting highlight from cloud:', e);
  }
}

export async function saveCenterInformationCloud(centerInfo: CenterInformation) {
  try {
    await setDoc(doc(db, 'centerInformation', 'settings'), clean(centerInfo));
  } catch (e) {
    console.error('Error saving center information to cloud:', e);
  }
}

export async function clearAllCloudData() {
  try {
    // Delete all docs in each collection
    const collections = ['users', 'classes', 'exams', 'assignments', 'passwords', 'security_logs', 'notifications', 'vocabularies', 'highlights', 'centerInformation'];
    for (const colName of collections) {
      const querySnapshot = await getDocs(collection(db, colName));
      for (const d of querySnapshot.docs) {
        await deleteDoc(doc(db, colName, d.id));
      }
    }
    await deleteDoc(doc(db, 'settings', 'center_settings'));
    console.log('🧹 Cloud data cleared successfully.');
  } catch (e) {
    console.error('Error clearing cloud data:', e);
  }
}
