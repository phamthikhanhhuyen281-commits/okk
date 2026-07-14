import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Music, Image, File, Trash2, Plus, Edit, Eye, Check, X, 
  Upload, Play, Pause, Search, Sparkles, BookOpen, AlertCircle, 
  Calendar, Clock, ArrowLeft, CheckCircle2, Sliders, EyeOff, ExternalLink,
  ChevronRight, ArrowUp, ArrowDown, Settings, ListPlus, Volume2, Globe, HelpCircle,
  Hash, BookMarked, Save, FileSpreadsheet, RefreshCw, Send, CheckSquare, ArrowRight
} from 'lucide-react';
import { db } from '../../data/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ExamBankItem, ExamBankFile, ExamType } from '../../types';
import { localFileCache, isLargeBase64, createCacheToken, resolveExamBankItem, resolveFileUrl, offloadLargeBase64Fields } from '../../utils/localFileCache';
import ExamSectionPractice from '../student/ExamSectionPractice';
import FullTestRunner from '../student/FullTestRunner';

const resolveParsedData = async (parsedData: any): Promise<any> => {
  if (!parsedData) return parsedData;
  const resolved = { ...parsedData };
  if (resolved.sections) {
    resolved.sections = await Promise.all(
      resolved.sections.map(async (sec: any) => {
        const resolvedSec = { ...sec };
        if (resolvedSec.audioUrl) {
          resolvedSec.audioUrl = await resolveFileUrl(resolvedSec.audioUrl);
        }
        if (resolvedSec.imageUrl) {
          resolvedSec.imageUrl = await resolveFileUrl(resolvedSec.imageUrl);
        }
        if (resolvedSec.passages) {
          resolvedSec.passages = await Promise.all(
            resolvedSec.passages.map(async (p: any) => {
              const resolvedP = { ...p };
              if (resolvedP.audioUrl) {
                resolvedP.audioUrl = await resolveFileUrl(resolvedP.audioUrl);
              }
              if (resolvedP.imageUrl) {
                resolvedP.imageUrl = await resolveFileUrl(resolvedP.imageUrl);
              }
              return resolvedP;
            })
          );
        }
        return resolvedSec;
      })
    );
  }

  const skillParts = ['writingTask1', 'writingTask2', 'speakingPart1', 'speakingPart2', 'speakingPart3'];
  for (const part of skillParts) {
    if (resolved[part]) {
      const pObj = { ...resolved[part] };
      if (pObj.imageUrl) pObj.imageUrl = await resolveFileUrl(pObj.imageUrl);
      if (pObj.audioUrl) pObj.audioUrl = await resolveFileUrl(pObj.audioUrl);
      resolved[part] = pObj;
    }
  }

  return resolved;
};

interface ExamEditorProps {
  item: ExamBankItem;
  language: 'vi' | 'en';
  onClose: () => void;
  onReParse?: () => void;
  initialPreviewMode?: boolean;
}

export default function ExamEditor({ item, language, onClose, onReParse, initialPreviewMode = false }: ExamEditorProps) {
  // State for the entire structured exam data
  const [examData, setExamData] = useState<any>(null);
  const [examInfo, setExamInfo] = useState<any>({
    title: '',
    code: '',
    skill: 'listening',
    difficulty: 'Medium',
    timeLimit: 40,
    description: '',
    status: 'draft',
    instruction: '',
    coverImage: '',
    showCoverImage: true
  });

  // Editor states
  const [selectedNode, setSelectedNode] = useState<{
    type: 'info' | 'section' | 'vocabulary' | 'media' | 'transcript' | 'writing' | 'speaking';
    sectionIndex?: number;
    subType?: 'passage' | 'questions' | 'transcript' | 'speaking-part';
    subIndex?: number; // e.g. passageIndex, questionGroupIndex, speakingPartIndex
  }>({ type: 'info' });

  const [savingStatus, setSavingStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [isPreviewMode, setIsPreviewMode] = useState(initialPreviewMode);
  
  // Validation, Review, and Publish states
  const [validationErrors, setValidationErrors] = useState<any[]>([]);
  const [hasValidated, setHasValidated] = useState(false);
  const [isPreviewStudentMode, setIsPreviewStudentMode] = useState(initialPreviewMode);
  const [isPublishing, setIsPublishing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Save Notification Modal State (Centered screen alert)
  const [saveNotification, setSaveNotification] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' } | null>(null);

  const showCenterNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setSaveNotification({ isOpen: true, message, type });
  };

  // Custom non-blocking confirm modal state
  const [confirmDialog, setConfirmDialog] = useState<{
    titleVi: string;
    titleEn: string;
    messageVi: string;
    messageEn: string;
    onConfirm: () => void;
  } | null>(null);

  // Get current logged-in user if available for logging 'publishedBy' / 'updatedBy'
  const [currentUser, setCurrentUser] = useState<any>(() => {
    const saved = localStorage.getItem('ielts_current_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };
  const [audioPlayState, setAudioPlayState] = useState<{ [url: string]: boolean }>({});
  const [activeAudioUrl, setActiveAudioUrl] = useState<string | null>(null);
  const audioRefs = useRef<{ [url: string]: HTMLAudioElement | null }>({});

  // Loading skeleton on initialization
  const [isLoading, setIsLoading] = useState(true);

  const [resolvedItem, setResolvedItem] = useState<ExamBankItem>(item);

  // Initialize and populate state from Firestore Item
  useEffect(() => {
    let active = true;
    const resolveData = async () => {
      setIsLoading(true);
      try {
        const resolved = await resolveExamBankItem(item);
        if (!active) return;
        setResolvedItem(resolved);

        // Setup basic info
        setExamInfo({
          title: resolved.title || '',
          code: resolved.code || '',
          skill: resolved.skill || 'listening',
          difficulty: resolved.difficulty || 'Medium',
          timeLimit: resolved.timeLimit || 40,
          description: resolved.description || '',
          status: resolved.status || 'draft',
          instruction: resolved.description || '',
          coverImage: resolved.coverImage || '',
          showCoverImage: resolved.showCoverImage !== false
        });

        // Setup structured questions parsedData
        if (resolved.isParsed && (resolved as any).parsedData) {
          const parsedCopy = JSON.parse(JSON.stringify((resolved as any).parsedData));
          const fullyResolvedParsed = await resolveParsedData(parsedCopy);
          if (!active) return;
          setExamData(fullyResolvedParsed);
        } else {
          // Create empty template structure based on skill type
          const skill = resolved.skill || 'listening';
          const selSec = (resolved as any).selectedSection;
          const hasSpecificSection = selSec !== undefined && selSec !== 'all' && selSec !== '';
          const targetSectionNum = hasSpecificSection ? Number(selSec) : null;
          let defaultSections: any[] = [];
          
          if (skill === 'listening') {
            const rangeNums = targetSectionNum ? [targetSectionNum] : [1, 2, 3, 4];
            defaultSections = rangeNums.map((num) => ({
              id: `SECTION ${num}`,
              sectionNumber: num,
              passages: [],
              questionGroups: [
                {
                  range: `${(num - 1) * 10 + 1}-${(num - 1) * 10 + 5}`,
                  type: 'Multiple Choice',
                  instruction: 'Choose the correct letter A, B, C or D.',
                  questions: [
                    {
                      number: (num - 1) * 10 + 1,
                      text: `Nội dung câu hỏi số ${(num - 1) * 10 + 1}?`,
                      options: ['A. Option 1', 'B. Option 2', 'C. Option 3', 'D. Option 4'],
                      answer: 'A',
                      explanation: 'Lời giải thích chi tiết.'
                    }
                  ]
                }
              ],
              transcript: 'Nội dung Transcript nghe tại đây...'
            }));
          } else if (skill === 'reading') {
            const rangeNums = targetSectionNum ? [targetSectionNum] : [1, 2, 3];
            defaultSections = rangeNums.map((num) => ({
              id: `PASSAGE ${num}`,
              sectionNumber: num,
              passages: [{ title: `Passage ${num}`, content: 'Vui lòng nhập nội dung bài đọc tại đây.' }],
              questionGroups: [
                {
                  range: `${(num - 1) * 13 + 1}-${(num - 1) * 13 + 5}`,
                  type: 'Multiple Choice',
                  instruction: 'Choose the correct letter A, B, C or D.',
                  questions: [
                    {
                      number: (num - 1) * 13 + 1,
                      text: `Nội dung câu hỏi số ${(num - 1) * 13 + 1}?`,
                      options: ['A. Option 1', 'B. Option 2', 'C. Option 3', 'D. Option 4'],
                      answer: 'A',
                      explanation: 'Lời giải thích chi tiết.'
                    }
                  ]
                }
              ],
              transcript: ''
            }));
          } else if (skill === 'writing') {
            const rangeNums = targetSectionNum ? [targetSectionNum] : [1, 2];
            defaultSections = rangeNums.map((num) => ({
              id: `TASK ${num}`,
              sectionNumber: num,
              passages: [{ title: `Task ${num}`, content: 'Vui lòng nhập đề bài viết tại đây.' }],
              questionGroups: [
                {
                  range: `${num}`,
                  type: 'Writing Task',
                  instruction: `Write about the following topic...`,
                  questions: [
                    {
                      number: num,
                      text: `Đề bài Task ${num}`,
                      options: [],
                      answer: '',
                      explanation: 'Bài viết mẫu tham khảo.'
                    }
                  ]
                }
              ],
              transcript: ''
            }));
          } else if (skill === 'speaking') {
            const rangeNums = targetSectionNum ? [targetSectionNum] : [1, 2, 3];
            defaultSections = rangeNums.map((num) => ({
              id: `PART ${num}`,
              sectionNumber: num,
              passages: num === 2 ? [{ title: `Part 2 Cue Card`, content: 'Describe a time when you...' }] : [],
              questionGroups: [
                {
                  range: `Part ${num}`,
                  type: 'Speaking Part',
                  instruction: `Speaking Part ${num} questions`,
                  questions: [
                    {
                      number: num,
                      text: `Speaking Part ${num} question content`,
                      options: [],
                      answer: 'Sample answer context.',
                      explanation: 'Gợi ý từ vựng/cấu trúc.'
                    }
                  ]
                }
              ],
              transcript: ''
            }));
          } else {
            defaultSections = [
              {
                id: 'SECTION 1',
                passages: [],
                questionGroups: [],
                transcript: ''
              }
            ];
          }

          const emptyData: any = {
            info: {
              title: resolved.title || '',
              code: resolved.code || '',
              skill: skill,
              difficulty: resolved.difficulty || 'Medium',
              timeLimit: resolved.timeLimit || 40,
              description: resolved.description || ''
            },
            sections: defaultSections,
            vocabulary: [
              {
                word: 'Example',
                ipa: '/ɪɡˈzɑːm.pəl/',
                definition: 'Ví dụ minh họa',
                collocation: 'give an example',
                example: 'This is an example of a good IELTS test.'
              }
            ]
          };
          if (!active) return;
          setExamData(emptyData);
        }
      } catch (err) {
        console.error('Error resolving data:', err);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    resolveData();

    return () => {
      active = false;
    };
  }, [item]);

  // AUTO-SAVE FUNCTIONALITY: Triggered when examInfo or examData changes (debounced)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (!examData) return;

    setSavingStatus('saving');
    const delayDebounce = setTimeout(async () => {
      try {
        const docRef = doc(db, 'exam_bank', item.id);
        const parsedDataToSave = await offloadLargeBase64Fields({
          ...examData,
          info: {
            ...examData.info,
            title: examInfo.title,
            code: examInfo.code,
            skill: examInfo.skill,
            difficulty: examInfo.difficulty,
            timeLimit: Number(examInfo.timeLimit),
            description: examInfo.description
          }
        }, `exam_bank_${item.id}_parsedData`, item.id);

        await updateDoc(docRef, {
          title: examInfo.title,
          code: examInfo.code,
          skill: examInfo.skill,
          difficulty: examInfo.difficulty,
          timeLimit: Number(examInfo.timeLimit),
          description: examInfo.description,
          status: examInfo.status,
          coverImage: examInfo.coverImage || '',
          showCoverImage: examInfo.showCoverImage !== false,
          isParsed: true,
          parseStatus: 'Parsed',
          parsedData: parsedDataToSave,
          updatedAt: new Date().toISOString()
        });
        setSavingStatus('saved');
      } catch (err) {
        console.error('Auto save error:', err);
        setSavingStatus('error');
      }
    }, 2000); // 2 seconds debounce

    return () => clearTimeout(delayDebounce);
  }, [examData, examInfo]);

  // MANUAL SAVE DRAFT & ACTIONS
  const handleManualSave = async (customStatus?: 'draft' | 'published') => {
    setSavingStatus('saving');
    try {
      const finalStatus = customStatus || examInfo.status;
      const docRef = doc(db, 'exam_bank', item.id);

      // Build mapping of original file URLs to updated ones
      const urlLookup = new Map<string, { url: string; name: string; size: number }>();
      originalMediaFiles.forEach((orig, idx) => {
        const updated = mediaList[idx];
        if (updated && orig.url) {
          urlLookup.set(orig.url, { url: updated.url, name: updated.name, size: updated.size });
        }
      });

      // Internal sanitizing helper
      const getUpdatedAndSanitizedUrl = async (oldUrl: string | undefined, fieldPath: string, defaultName: string, fileType: string): Promise<string> => {
        if (!oldUrl) return '';
        const lookup = urlLookup.get(oldUrl);
        const activeUrl = lookup ? lookup.url : oldUrl;
        const name = lookup ? lookup.name : defaultName;
        const size = lookup ? lookup.size : 0;
        
        if (!activeUrl) return '';
        if (isLargeBase64(activeUrl)) {
          const cacheKey = `exam_bank_${item.id}_${fieldPath}`;
          await localFileCache.set(cacheKey, activeUrl);
          return createCacheToken(cacheKey, name, size, fileType);
        }
        return activeUrl;
      };

      const getUpdatedAndSanitizedFileList = async (oldFiles: ExamBankFile[] | undefined, fieldPath: string, fileType: string): Promise<ExamBankFile[]> => {
        if (!oldFiles || !Array.isArray(oldFiles)) return [];
        const result: ExamBankFile[] = [];
        for (let i = 0; i < oldFiles.length; i++) {
          const f = oldFiles[i];
          const lookup = f.url ? urlLookup.get(f.url) : null;
          const activeUrl = lookup ? lookup.url : f.url;
          const name = lookup ? lookup.name : f.name;
          const size = lookup ? lookup.size : f.size;
          
          if (activeUrl) {
            const uniquePath = `${fieldPath}_${i}`;
            let sanitizedUrl = activeUrl;
            if (isLargeBase64(activeUrl)) {
              const cacheKey = `exam_bank_${item.id}_${uniquePath}`;
              await localFileCache.set(cacheKey, activeUrl);
              sanitizedUrl = createCacheToken(cacheKey, name, size, fileType);
            }
            result.push({ name, size, url: sanitizedUrl });
          }
        }
        return result;
      };

      const getSanitizedFileListFromMediaList = async (files: ExamBankFile[], fileType: string): Promise<ExamBankFile[]> => {
        const result: ExamBankFile[] = [];
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          const isMatch = fileType === 'audio' 
            ? (f.name.toLowerCase().includes('audio') || f.name.toLowerCase().endsWith('.mp3') || f.name.toLowerCase().endsWith('.m4a') || f.name.toLowerCase().endsWith('.wav') || f.url?.startsWith('data:audio'))
            : (f.name.toLowerCase().includes('image') || f.name.toLowerCase().endsWith('.png') || f.name.toLowerCase().endsWith('.jpg') || f.name.toLowerCase().endsWith('.jpeg') || f.url?.startsWith('data:image'));
          
          if (isMatch && f.url) {
            let sanitizedUrl = f.url;
            if (isLargeBase64(f.url)) {
              const cacheKey = `exam_bank_${item.id}_media_added_${fileType}_${i}_${Math.random().toString(36).substring(2, 7)}`;
              await localFileCache.set(cacheKey, f.url);
              sanitizedUrl = createCacheToken(cacheKey, f.name, f.size, fileType);
            }
            result.push({ name: f.name, size: f.size, url: sanitizedUrl });
          }
        }
        return result;
      };

      // Sanitize root-level fields
      const wordFileInList = mediaList.find(f => f.name.toLowerCase().includes('word') || f.name.toLowerCase().endsWith('.docx'));
      const pdfFileInList = mediaList.find(f => f.name.toLowerCase().includes('pdf') || f.name.toLowerCase().endsWith('.pdf'));

      let sanitizedWordUrl = '';
      if (wordFileInList && wordFileInList.url) {
        sanitizedWordUrl = wordFileInList.url;
        if (isLargeBase64(wordFileInList.url)) {
          const cacheKey = `exam_bank_${item.id}_word`;
          await localFileCache.set(cacheKey, wordFileInList.url);
          sanitizedWordUrl = createCacheToken(cacheKey, wordFileInList.name, wordFileInList.size, 'word');
        }
      } else if (item.wordFileUrl) {
        sanitizedWordUrl = await getUpdatedAndSanitizedUrl(item.wordFileUrl, 'word', 'Word_Doc.docx', 'word');
      }

      let sanitizedPdfUrl = '';
      if (pdfFileInList && pdfFileInList.url) {
        sanitizedPdfUrl = pdfFileInList.url;
        if (isLargeBase64(pdfFileInList.url)) {
          const cacheKey = `exam_bank_${item.id}_pdf`;
          await localFileCache.set(cacheKey, pdfFileInList.url);
          sanitizedPdfUrl = createCacheToken(cacheKey, pdfFileInList.name, pdfFileInList.size, 'pdf');
        }
      } else if (item.pdfFileUrl) {
        sanitizedPdfUrl = await getUpdatedAndSanitizedUrl(item.pdfFileUrl, 'pdf', 'PDF_Doc.pdf', 'pdf');
      }

      const sanitizedAudios = await getSanitizedFileListFromMediaList(mediaList, 'audio');
      const sanitizedImages = await getSanitizedFileListFromMediaList(mediaList, 'image');

      // Sanitize storageFiles
      let sanitizedStorageFiles: any = null;
      if (item.storageFiles) {
        const sf = item.storageFiles;
        
        let processedListening: any = null;
        if (sf.listening) {
          processedListening = {
            wordFileUrl: await getUpdatedAndSanitizedUrl(sf.listening.wordFileUrl, 'storage_listening_word', 'Listening_Word.docx', 'word'),
            audioFiles: await getUpdatedAndSanitizedFileList(sf.listening.audioFiles, 'storage_listening_audios', 'audio'),
            imageFiles: await getUpdatedAndSanitizedFileList(sf.listening.imageFiles, 'storage_listening_images', 'image')
          };
        }

        let processedReading: any = null;
        if (sf.reading) {
          processedReading = {
            wordFileUrl: await getUpdatedAndSanitizedUrl(sf.reading.wordFileUrl, 'storage_reading_word', 'Reading_Word.docx', 'word'),
            imageFiles: await getUpdatedAndSanitizedFileList(sf.reading.imageFiles, 'storage_reading_images', 'image')
          };
        }

        let processedWriting: any = null;
        if (sf.writing) {
          processedWriting = {
            wordFileUrl: await getUpdatedAndSanitizedUrl(sf.writing.wordFileUrl, 'storage_writing_word', 'Writing_Word.docx', 'word'),
            imageFiles: await getUpdatedAndSanitizedFileList(sf.writing.imageFiles, 'storage_writing_images', 'image')
          };
        }

        let processedSpeaking: any = null;
        if (sf.speaking) {
          processedSpeaking = {
            wordFileUrl: await getUpdatedAndSanitizedUrl(sf.speaking.wordFileUrl, 'storage_speaking_word', 'Speaking_Word.docx', 'word')
          };
        }

        sanitizedStorageFiles = {
          wordFileUrl: await getUpdatedAndSanitizedUrl(sf.wordFileUrl, 'storage_word', 'Word_Doc.docx', 'word'),
          pdfFileUrl: await getUpdatedAndSanitizedUrl(sf.pdfFileUrl, 'storage_pdf', 'PDF_Doc.pdf', 'pdf'),
          audioFiles: await getUpdatedAndSanitizedFileList(sf.audioFiles, 'storage_audio', 'audio'),
          imageFiles: await getUpdatedAndSanitizedFileList(sf.imageFiles, 'storage_image', 'image'),
          listening: processedListening,
          reading: processedReading,
          writing: processedWriting,
          speaking: processedSpeaking
        };
      }

      const parsedDataToSave = await offloadLargeBase64Fields({
        ...examData,
        info: {
          ...examData.info,
          title: examInfo.title,
          code: examInfo.code,
          skill: examInfo.skill,
          difficulty: examInfo.difficulty,
          timeLimit: Number(examInfo.timeLimit),
          description: examInfo.description
        }
      }, `exam_bank_${item.id}_parsedData`, item.id);

      const updateData: any = {
        title: examInfo.title,
        code: examInfo.code,
        skill: examInfo.skill,
        difficulty: examInfo.difficulty,
        timeLimit: Number(examInfo.timeLimit),
        description: examInfo.description,
        status: finalStatus,
        coverImage: examInfo.coverImage || '',
        showCoverImage: examInfo.showCoverImage !== false,
        isParsed: true,
        parseStatus: 'Parsed',
        
        // Save the updated/replaced media fields
        wordFileUrl: sanitizedWordUrl,
        pdfFileUrl: sanitizedPdfUrl,
        audioFiles: sanitizedAudios,
        imageFiles: sanitizedImages,
        storageFiles: sanitizedStorageFiles,

        parsedData: parsedDataToSave,
        updatedAt: new Date().toISOString()
      };
      
      if (currentUser?.name) {
        updateData.updatedBy = currentUser.name;
      }
      
      await updateDoc(docRef, updateData);
      
      if (customStatus) {
        setExamInfo((prev: any) => ({ ...prev, status: customStatus }));
      }
      setSavingStatus('saved');
      
      showCenterNotification(
        language === 'vi' 
          ? `✓ Đã lưu đề thi thành công (${finalStatus === 'published' ? 'Đã xuất bản' : 'Bản nháp'})!` 
          : `✓ Exam saved successfully as ${finalStatus === 'published' ? 'Published' : 'Draft'}!`,
        'success'
      );
      showToast(
        language === 'vi' 
          ? `✓ Đã lưu đề thi thành công (${finalStatus === 'published' ? 'Đã xuất bản' : 'Bản nháp'})!` 
          : `✓ Exam saved successfully as ${finalStatus === 'published' ? 'Published' : 'Draft'}!`,
        'success'
      );
    } catch (err) {
      console.error('Manual save failed:', err);
      setSavingStatus('error');
      showCenterNotification(
        language === 'vi' ? 'Không thể lưu đề thi!' : 'Error saving exam data!',
        'error'
      );
      showToast(
        language === 'vi' ? 'Không thể lưu đề thi!' : 'Error saving exam data!',
        'error'
      );
    }
  };

  // Student Preview Helper & Mock data
  const mockStudentUser: any = {
    id: 'admin-preview',
    name: currentUser?.name || 'Admin Preview',
    email: currentUser?.email || 'admin@rart.vn',
    phone: '',
    role: 'student' as const,
    status: 'active' as const,
    createdAt: new Date().toISOString()
  };

  const handleFixError = (node: any) => {
    if (!node) return;
    setSelectedNode(node);
    setIsPreviewMode(false);
    setIsPreviewStudentMode(false);
  };

  const mapEditorDataToStudentExam = (): any => {
    const studentExam: any = {
      id: resolvedItem.id,
      title: examInfo.title,
      type: examInfo.skill,
      status: examInfo.status,
      duration: Number(examInfo.timeLimit) || 40,
      questionsCount: examData?.sections?.reduce((acc: number, sec: any) => {
        return acc + (sec.questionGroups?.reduce((acc2: number, grp: any) => acc2 + (grp.questions?.length || 0), 0) || 0);
      }, 0) || 0,
      difficulty: examInfo.difficulty,
      sections: examData?.sections?.map((sec: any, sIdx: number) => {
        const fallbackAudio = sec.audioUrl || resolvedItem.audioFiles?.[0]?.url || resolvedItem.storageFiles?.audioFiles?.[0]?.url || resolvedItem.storageFiles?.listening?.audioFiles?.[0]?.url || '';
        const fallbackImage = sec.imageUrl || resolvedItem.imageFiles?.[0]?.url || resolvedItem.storageFiles?.imageFiles?.[0]?.url || resolvedItem.storageFiles?.listening?.imageFiles?.[0]?.url || '';

        const mappedSec: any = {
          sectionNumber: sec.sectionNumber || sIdx + 1,
          id: sec.id || `Section ${sIdx + 1}`,
          title: sec.title || '',
          audioUrl: fallbackAudio,
          imageUrl: fallbackImage,
          transcript: sec.transcript || '',
          translation: sec.translation || '',
          vocabulary: sec.vocabulary || '',
          questions: []
        };

        const questionsList: any[] = [];
        sec.questionGroups?.forEach((grp: any) => {
          grp.questions?.forEach((q: any) => {
            questionsList.push({
              number: q.number,
              questionType: grp.type,
              questionText: q.text,
              options: q.options || [],
              correctAnswer: q.answer,
              explanation: q.explanation || ''
            });
          });
        });
        mappedSec.questions = questionsList;
        return mappedSec;
      }) || [],
      
      passages: examInfo.skill === 'reading' ? examData?.sections?.map((sec: any, sIdx: number) => {
        const pTitle = sec.passages?.[0]?.title || sec.title || `Passage ${sIdx + 1}`;
        const pContent = sec.passages?.[0]?.content || '';
        
        const questionsList: any[] = [];
        sec.questionGroups?.forEach((grp: any) => {
          grp.questions?.forEach((q: any) => {
            questionsList.push({
              number: q.number,
              questionType: grp.type,
              questionText: q.text,
              options: q.options || [],
              correctAnswer: q.answer,
              explanation: q.explanation || ''
            });
          });
        });

        const fallbackAudio = sec.audioUrl || resolvedItem.audioFiles?.[0]?.url || resolvedItem.storageFiles?.audioFiles?.[0]?.url || resolvedItem.storageFiles?.listening?.audioFiles?.[0]?.url || '';
        const fallbackImage = sec.imageUrl || resolvedItem.imageFiles?.[0]?.url || resolvedItem.storageFiles?.imageFiles?.[0]?.url || resolvedItem.storageFiles?.listening?.imageFiles?.[0]?.url || '';

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
      }) : [],

      writingTask1: examInfo.skill === 'writing' ? {
        prompt: examData?.sections?.[0]?.passages?.[0]?.content || examData?.sections?.[0]?.title || '',
        imageUrl: examData?.sections?.[0]?.imageUrl || '',
        audioUrl: examData?.sections?.[0]?.audioUrl || '',
        sampleAnswer: examData?.sections?.[0]?.questionGroups?.[0]?.questions?.[0]?.explanation || ''
      } : undefined,
      writingTask2: examInfo.skill === 'writing' && examData?.sections?.length > 1 ? {
        prompt: examData?.sections?.[1]?.passages?.[0]?.content || examData?.sections?.[1]?.title || '',
        imageUrl: examData?.sections?.[1]?.imageUrl || '',
        audioUrl: examData?.sections?.[1]?.audioUrl || '',
        sampleAnswer: examData?.sections?.[1]?.questionGroups?.[0]?.questions?.[0]?.explanation || ''
      } : undefined,

      speakingPart1: examInfo.skill === 'speaking' ? {
        topics: examData?.sections?.[0]?.questionGroups?.map((g: any) => g.instruction) || [],
        imageUrl: examData?.sections?.[0]?.imageUrl || '',
        audioUrl: examData?.sections?.[0]?.audioUrl || '',
        sampleAnswers: examData?.sections?.[0]?.questionGroups?.flatMap((g: any) => g.questions?.map((q: any) => `${q.text}\nSample: ${q.answer}`))?.join('\n\n') || ''
      } : undefined,
      speakingPart2: examInfo.skill === 'speaking' && examData?.sections?.length > 1 ? {
        topic: examData?.sections?.[1]?.passages?.[0]?.content || '',
        imageUrl: examData?.sections?.[1]?.imageUrl || '',
        audioUrl: examData?.sections?.[1]?.audioUrl || '',
        sampleAnswers: examData?.sections?.[1]?.questionGroups?.[0]?.questions?.map((q: any) => q.answer)?.join('\n') || ''
      } : undefined,
      speakingPart3: examInfo.skill === 'speaking' && examData?.sections?.length > 2 ? {
        topics: examData?.sections?.[2]?.questionGroups?.map((g: any) => g.instruction) || [],
        imageUrl: examData?.sections?.[2]?.imageUrl || '',
        audioUrl: examData?.sections?.[2]?.audioUrl || '',
        sampleAnswers: examData?.sections?.[2]?.questionGroups?.flatMap((g: any) => g.questions?.map((q: any) => `${q.text}\nSample: ${q.answer}`))?.join('\n\n') || ''
      } : undefined
    };

    return studentExam;
  };

  // VALIDATION LOGIC ENGINE
  const runValidation = () => {
    const errors: any[] = [];

    // 1. General Info Validation
    if (!examInfo.title || examInfo.title.trim() === '') {
      errors.push({
        id: 'info-title',
        category: 'info',
        message: language === 'vi' ? 'Tên đề thi không được để trống.' : 'Exam title cannot be empty.',
        nodeToSelect: { type: 'info' }
      });
    }

    if (!examInfo.code || examInfo.code.trim() === '') {
      errors.push({
        id: 'info-code',
        category: 'info',
        message: language === 'vi' ? 'Mã đề thi không được để trống.' : 'Exam code cannot be empty.',
        nodeToSelect: { type: 'info' }
      });
    }

    if (!examInfo.timeLimit || Number(examInfo.timeLimit) <= 0) {
      errors.push({
        id: 'info-timelimit',
        category: 'info',
        message: language === 'vi' ? 'Thời gian làm bài phải lớn hơn 0 phút.' : 'Time limit must be greater than 0 minutes.',
        nodeToSelect: { type: 'info' }
      });
    }

    // 2. Sections Validation
    if (!examData || !examData.sections || examData.sections.length === 0) {
      errors.push({
        id: 'sections-empty',
        category: 'info',
        message: language === 'vi' ? 'Đề thi phải có ít nhất một phần thi (Section).' : 'Exam must contain at least one section.',
        nodeToSelect: { type: 'info' }
      });
    } else {
      examData.sections.forEach((sec: any, sIdx: number) => {
        const secLabel = sec.id || `Section ${sIdx + 1}`;

        // Reading validations
        if (examInfo.skill === 'reading') {
          if (!sec.passages || sec.passages.length === 0) {
            errors.push({
              id: `sec-${sIdx}-passages-empty`,
              category: 'section',
              message: language === 'vi' 
                ? `${secLabel}: Kỹ năng Reading yêu cầu ít nhất một bài đọc (Passage).` 
                : `${secLabel}: Reading skill requires at least one reading passage.`,
              nodeToSelect: { type: 'section', sectionIndex: sIdx }
            });
          } else {
            sec.passages.forEach((psg: any, pIdx: number) => {
              if (!psg.title || psg.title.trim() === '') {
                errors.push({
                  id: `sec-${sIdx}-psg-${pIdx}-title`,
                  category: 'section',
                  message: language === 'vi'
                    ? `${secLabel}: Tiêu đề của bài đọc số ${pIdx + 1} không được để trống.`
                    : `${secLabel}: Title of reading passage #${pIdx + 1} cannot be empty.`,
                  nodeToSelect: { type: 'section', sectionIndex: sIdx }
                });
              }
              if (!psg.content || psg.content.trim() === '' || psg.content.includes('Vui lòng nhập nội dung')) {
                errors.push({
                  id: `sec-${sIdx}-psg-${pIdx}-content`,
                  category: 'section',
                  message: language === 'vi'
                    ? `${secLabel}: Nội dung của bài đọc số ${pIdx + 1} chưa được nhập hoặc để trống.`
                    : `${secLabel}: Content of reading passage #${pIdx + 1} is empty.`,
                  nodeToSelect: { type: 'section', sectionIndex: sIdx }
                });
              }
            });
          }
        }

        // Listening validations
        if (examInfo.skill === 'listening') {
          if (!sec.transcript || sec.transcript.trim() === '' || sec.transcript.includes('Nội dung Transcript')) {
            errors.push({
              id: `sec-${sIdx}-transcript-empty`,
              category: 'section',
              message: language === 'vi'
                ? `${secLabel}: Chưa có nội dung transcript nghe.`
                : `${secLabel}: Missing listening transcript content.`,
              nodeToSelect: { type: 'section', sectionIndex: sIdx }
            });
          }
        }

        // Question groups validation
        if (!sec.questionGroups || sec.questionGroups.length === 0) {
          errors.push({
            id: `sec-${sIdx}-groups-empty`,
            category: 'section',
            message: language === 'vi'
              ? `${secLabel}: Phải có ít nhất một nhóm câu hỏi.`
              : `${secLabel}: Must have at least one question group.`,
            nodeToSelect: { type: 'section', sectionIndex: sIdx }
          });
        } else {
          sec.questionGroups.forEach((grp: any, gIdx: number) => {
            const grpLabel = `Nhóm ${grp.range || gIdx + 1}`;

            if (!grp.type || grp.type.trim() === '') {
              errors.push({
                id: `sec-${sIdx}-grp-${gIdx}-type`,
                category: 'question',
                message: language === 'vi'
                  ? `${secLabel} > ${grpLabel}: Loại câu hỏi (Question Type) không được để trống.`
                  : `${secLabel} > ${grpLabel}: Question Type cannot be empty.`,
                nodeToSelect: { type: 'section', sectionIndex: sIdx, subType: 'questions', subIndex: gIdx }
              });
            }

            if (!grp.instruction || grp.instruction.trim() === '') {
              errors.push({
                id: `sec-${sIdx}-grp-${gIdx}-instruction`,
                category: 'question',
                message: language === 'vi'
                  ? `${secLabel} > ${grpLabel}: Hướng dẫn làm bài (Instruction) không được để trống.`
                  : `${secLabel} > ${grpLabel}: Instruction cannot be empty.`,
                nodeToSelect: { type: 'section', sectionIndex: sIdx, subType: 'questions', subIndex: gIdx }
              });
            }

            if (!grp.questions || grp.questions.length === 0) {
              errors.push({
                id: `sec-${sIdx}-grp-${gIdx}-questions-empty`,
                category: 'question',
                message: language === 'vi'
                  ? `${secLabel} > ${grpLabel}: Nhóm câu hỏi không được rỗng.`
                  : `${secLabel} > ${grpLabel}: Question group cannot be empty.`,
                nodeToSelect: { type: 'section', sectionIndex: sIdx, subType: 'questions', subIndex: gIdx }
              });
            } else {
              grp.questions.forEach((q: any, qIdx: number) => {
                const qNum = q.number || (qIdx + 1);

                if (!q.text || q.text.trim() === '' || q.text.includes('Nội dung câu hỏi')) {
                  errors.push({
                    id: `sec-${sIdx}-grp-${gIdx}-q-${qIdx}-text`,
                    category: 'question',
                    message: language === 'vi'
                      ? `${secLabel} > ${grpLabel}: Nội dung câu hỏi số ${qNum} không được để trống.`
                      : `${secLabel} > ${grpLabel}: Question text for #${qNum} cannot be empty.`,
                    nodeToSelect: { type: 'section', sectionIndex: sIdx, subType: 'questions', subIndex: gIdx }
                  });
                }

                if (!q.answer || q.answer.trim() === '') {
                  errors.push({
                    id: `sec-${sIdx}-grp-${gIdx}-q-${qIdx}-answer`,
                    category: 'question',
                    message: language === 'vi'
                      ? `${secLabel} > ${grpLabel}: Đáp án của câu hỏi số ${qNum} không được để trống.`
                      : `${secLabel} > ${grpLabel}: Answer for question #${qNum} cannot be empty.`,
                    nodeToSelect: { type: 'section', sectionIndex: sIdx, subType: 'questions', subIndex: gIdx }
                  });
                }

                // MCQ options check
                const isMCQ = grp.type.toLowerCase().includes('multiple choice') || (q.options && q.options.length > 0);
                if (isMCQ) {
                  if (!q.options || q.options.length < 2) {
                    errors.push({
                      id: `sec-${sIdx}-grp-${gIdx}-q-${qIdx}-options-length`,
                      category: 'question',
                      message: language === 'vi'
                        ? `${secLabel} > ${grpLabel}: Câu hỏi trắc nghiệm số ${qNum} phải có ít nhất 2 phương án lựa chọn.`
                        : `${secLabel} > ${grpLabel}: Multiple choice question #${qNum} must have at least 2 options.`,
                      nodeToSelect: { type: 'section', sectionIndex: sIdx, subType: 'questions', subIndex: gIdx }
                    });
                  } else {
                    q.options.forEach((opt: string, oIdx: number) => {
                      if (!opt || opt.trim() === '') {
                        errors.push({
                          id: `sec-${sIdx}-grp-${gIdx}-q-${qIdx}-opt-${oIdx}`,
                          category: 'question',
                          message: language === 'vi'
                            ? `${secLabel} > ${grpLabel}: Phương án thứ ${oIdx + 1} của câu hỏi trắc nghiệm số ${qNum} không được để trống.`
                            : `${secLabel} > ${grpLabel}: Option #${oIdx + 1} of question #${qNum} cannot be empty.`,
                          nodeToSelect: { type: 'section', sectionIndex: sIdx, subType: 'questions', subIndex: gIdx }
                        });
                      }
                    });
                  }
                }
              });
            }
          });
        }
      });
    }

    // 3. Media Validation (e.g. Listening needs audio files)
    if (examInfo.skill === 'listening') {
      const hasAudio = mediaList && mediaList.some(f => 
        f.name.toLowerCase().includes('audio') || 
        f.name.toLowerCase().endsWith('.mp3') || 
        f.name.toLowerCase().endsWith('.wav') || 
        f.name.toLowerCase().endsWith('.m4a') || 
        f.url?.startsWith('data:audio') ||
        f.url?.startsWith('localcache:')
      );
      if (!hasAudio) {
        errors.push({
          id: 'media-listening-audio',
          category: 'media',
          message: language === 'vi'
            ? 'Đề thi Listening chưa có tệp âm thanh nghe (Audio File).'
            : 'Listening exam must have at least one audio file.',
          nodeToSelect: { type: 'media' }
        });
      }
    }

    setValidationErrors(errors);
    setHasValidated(true);
    return errors;
  };

  // Run validation on entering Review Mode
  useEffect(() => {
    if (isPreviewMode) {
      runValidation();
    }
  }, [isPreviewMode, examInfo, examData]);

  // NEW GATED PUBLISH FUNCTIONALITY
  const handlePublish = async () => {
    const errors = runValidation();
    if (errors.length > 0) {
      showToast(
        language === 'vi'
          ? 'Không thể xuất bản! Vui lòng sửa toàn bộ lỗi dữ liệu được liệt kê.'
          : 'Cannot publish! Please fix all validation errors listed below.',
        'error'
      );
      return;
    }

    setIsPublishing(true);
    setSavingStatus('saving');
    try {
      const docRef = doc(db, 'exam_bank', item.id);
      const publishDate = new Date().toISOString();
      const editorName = currentUser?.name || 'Admin';

      const parsedDataToSave = await offloadLargeBase64Fields({
        ...examData,
        info: {
          ...examData.info,
          title: examInfo.title,
          code: examInfo.code,
          skill: examInfo.skill,
          difficulty: examInfo.difficulty,
          timeLimit: Number(examInfo.timeLimit),
          description: examInfo.description,
          status: 'published'
        }
      }, `exam_bank_${item.id}_parsedData`, item.id);

      await updateDoc(docRef, {
        title: examInfo.title,
        code: examInfo.code,
        skill: examInfo.skill,
        difficulty: examInfo.difficulty,
        timeLimit: Number(examInfo.timeLimit),
        description: examInfo.description,
        status: 'published',
        publishedAt: publishDate,
        publishedBy: editorName,
        validationStatus: 'Passed',
        isParsed: true,
        parseStatus: 'Parsed',
        parsedData: parsedDataToSave,
        updatedAt: publishDate,
        updatedBy: editorName
      });

      setExamInfo((prev: any) => ({ ...prev, status: 'published' }));
      setSavingStatus('saved');
      setIsPublishing(false);
      
      showCenterNotification(
        language === 'vi'
          ? '🎉 Đề thi đã được xuất bản thành công!'
          : '🎉 Exam published successfully!',
        'success'
      );
      showToast(
        language === 'vi'
          ? '🎉 Đề thi đã được xuất bản thành công!'
          : '🎉 Exam published successfully!',
        'success'
      );
    } catch (err) {
      console.error('Publish failed:', err);
      setSavingStatus('error');
      setIsPublishing(false);
      showToast(
        language === 'vi' ? 'Không thể xuất bản đề thi!' : 'Error publishing exam!',
        'error'
      );
    }
  };

  // NATIVE DRAG & DROP FOR SECTIONS, GROUPS, QUESTIONS
  const [draggedItem, setDraggedItem] = useState<{
    type: 'section' | 'group' | 'question';
    sectionIndex: number;
    groupIndex?: number;
    questionIndex?: number;
  } | null>(null);

  const handleDragStart = (e: React.DragEvent, type: 'section' | 'group' | 'question', sIdx: number, gIdx?: number, qIdx?: number) => {
    setDraggedItem({ type, sectionIndex: sIdx, groupIndex: gIdx, questionIndex: qIdx });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, type: 'section' | 'group' | 'question', targetSIdx: number, targetGIdx?: number, targetQIdx?: number) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.type !== type || !examData) return;

    const newSections = [...examData.sections];

    if (type === 'section') {
      const draggedSec = newSections[draggedItem.sectionIndex];
      newSections.splice(draggedItem.sectionIndex, 1);
      newSections.splice(targetSIdx, 0, draggedSec);
    } else if (type === 'group' && targetGIdx !== undefined && draggedItem.groupIndex !== undefined) {
      if (draggedItem.sectionIndex !== targetSIdx) return; // Only allow sorting within same section
      const groups = [...newSections[targetSIdx].questionGroups];
      const draggedGrp = groups[draggedItem.groupIndex];
      groups.splice(draggedItem.groupIndex, 1);
      groups.splice(targetGIdx, 0, draggedGrp);
      newSections[targetSIdx].questionGroups = groups;
    } else if (type === 'question' && targetQIdx !== undefined && draggedItem.questionIndex !== undefined && draggedItem.groupIndex !== undefined && targetGIdx !== undefined) {
      if (draggedItem.sectionIndex !== targetSIdx || draggedItem.groupIndex !== targetGIdx) return; // Only reorder in same group
      const questions = [...newSections[targetSIdx].questionGroups[targetGIdx].questions];
      const draggedQ = questions[draggedItem.questionIndex];
      questions.splice(draggedItem.questionIndex, 1);
      questions.splice(targetQIdx, 0, draggedQ);
      newSections[targetSIdx].questionGroups[targetGIdx].questions = questions;
    }

    setExamData({ ...examData, sections: newSections });
    setDraggedItem(null);
  };

  // HELPER REORDER BUTTONS
  const moveSection = (index: number, direction: 'up' | 'down') => {
    if (!examData) return;
    const newSections = [...examData.sections];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newSections.length) return;
    
    const temp = newSections[index];
    newSections[index] = newSections[targetIdx];
    newSections[targetIdx] = temp;
    
    setExamData({ ...examData, sections: newSections });
  };

  const moveGroup = (sIdx: number, gIdx: number, direction: 'up' | 'down') => {
    if (!examData) return;
    const newSections = [...examData.sections];
    const groups = [...newSections[sIdx].questionGroups];
    const targetIdx = direction === 'up' ? gIdx - 1 : gIdx + 1;
    if (targetIdx < 0 || targetIdx >= groups.length) return;

    const temp = groups[gIdx];
    groups[gIdx] = groups[targetIdx];
    groups[targetIdx] = temp;

    newSections[sIdx].questionGroups = groups;
    setExamData({ ...examData, sections: newSections });
  };

  const moveQuestion = (sIdx: number, gIdx: number, qIdx: number, direction: 'up' | 'down') => {
    if (!examData) return;
    const newSections = [...examData.sections];
    const questions = [...newSections[sIdx].questionGroups[gIdx].questions];
    const targetIdx = direction === 'up' ? qIdx - 1 : qIdx + 1;
    if (targetIdx < 0 || targetIdx >= questions.length) return;

    const temp = questions[qIdx];
    questions[qIdx] = questions[targetIdx];
    questions[targetIdx] = temp;

    newSections[sIdx].questionGroups[gIdx].questions = questions;
    setExamData({ ...examData, sections: newSections });
  };

  // SECTION MANAGEMENT
  const handleAddSection = () => {
    if (!examData) return;
    const nextNum = examData.sections.length + 1;
    const newSec = {
      id: `SECTION ${nextNum}`,
      passages: examInfo.skill === 'reading' ? [{ title: `Passage ${nextNum}`, content: 'Nội dung bài đọc mới...' }] : [],
      questionGroups: [],
      transcript: examInfo.skill === 'listening' ? 'Nhập transcript nghe tại đây...' : ''
    };
    setExamData({
      ...examData,
      sections: [...examData.sections, newSec]
    });
    setSelectedNode({ type: 'section', sectionIndex: examData.sections.length });
  };

  const handleDeleteSection = (index: number) => {
    if (!examData) return;
    if (examData.sections.length <= 1) {
      alert(language === 'vi' ? 'Đề thi phải có ít nhất một Section!' : 'An exam must have at least one Section!');
      return;
    }
    setConfirmDialog({
      titleVi: 'Xác nhận xóa Section',
      titleEn: 'Confirm Section Deletion',
      messageVi: 'Bạn có chắc chắn muốn xóa Section này?',
      messageEn: 'Are you sure you want to delete this Section?',
      onConfirm: () => {
        const newSections = examData.sections.filter((_: any, i: number) => i !== index);
        setExamData({ ...examData, sections: newSections });
        setSelectedNode({ type: 'info' });
        setConfirmDialog(null);
      }
    });
  };

  // QUESTION GROUP MANAGEMENT
  const handleAddQuestionGroup = (sIdx: number) => {
    if (!examData) return;
    const newSections = [...examData.sections];
    const newGrp = {
      range: '1-5',
      type: 'Sentence Completion',
      instruction: 'Write ONE WORD ONLY.',
      questions: []
    };
    newSections[sIdx].questionGroups.push(newGrp);
    setExamData({ ...examData, sections: newSections });
  };

  const handleDeleteQuestionGroup = (sIdx: number, gIdx: number) => {
    if (!examData) return;
    setConfirmDialog({
      titleVi: 'Xác nhận xóa nhóm câu hỏi',
      titleEn: 'Confirm Question Group Deletion',
      messageVi: 'Bạn có chắc chắn muốn xóa nhóm câu hỏi này?',
      messageEn: 'Are you sure you want to delete this Question Group?',
      onConfirm: () => {
        const newSections = [...examData.sections];
        newSections[sIdx].questionGroups = newSections[sIdx].questionGroups.filter((_: any, i: number) => i !== gIdx);
        setExamData({ ...examData, sections: newSections });
        setConfirmDialog(null);
      }
    });
  };

  // QUESTION MANAGEMENT
  const handleAddQuestion = (sIdx: number, gIdx: number) => {
    if (!examData) return;
    const newSections = [...examData.sections];
    const grp = newSections[sIdx].questionGroups[gIdx];
    
    // Find highest question number to suggest next
    let nextQNum = 1;
    newSections.forEach(s => {
      s.questionGroups.forEach((g: any) => {
        g.questions.forEach((q: any) => {
          if (q.number >= nextQNum) nextQNum = q.number + 1;
        });
      });
    });

    const newQ = {
      number: nextQNum,
      text: `Nội dung câu hỏi số ${nextQNum}?`,
      options: ['A. Option 1', 'B. Option 2', 'C. Option 3', 'D. Option 4'],
      answer: '',
      explanation: ''
    };
    grp.questions.push(newQ);
    setExamData({ ...examData, sections: newSections });
  };

  const handleDeleteQuestion = (sIdx: number, gIdx: number, qIdx: number) => {
    if (!examData) return;
    const newSections = [...examData.sections];
    newSections[sIdx].questionGroups[gIdx].questions = newSections[sIdx].questionGroups[gIdx].questions.filter((_: any, i: number) => i !== qIdx);
    setExamData({ ...examData, sections: newSections });
  };

  // VOCABULARY MANAGEMENT
  const handleAddVocabulary = () => {
    if (!examData) return;
    const newVocab = {
      word: 'New Word',
      ipa: '/.../',
      definition: 'Ý nghĩa của từ',
      collocation: 'Cụm từ đi kèm',
      example: 'Câu ví dụ mẫu.'
    };
    setExamData({
      ...examData,
      vocabulary: [...(examData.vocabulary || []), newVocab]
    });
  };

  const handleDeleteVocabulary = (idx: number) => {
    if (!examData) return;
    const newVocab = examData.vocabulary.filter((_: any, i: number) => i !== idx);
    setExamData({ ...examData, vocabulary: newVocab });
  };

  // MEDIA / STORAGE MANAGEMENT (Word, Audio, PDF, Img)
  const [mediaList, setMediaList] = useState<ExamBankFile[]>([]);
  const [originalMediaFiles, setOriginalMediaFiles] = useState<ExamBankFile[]>([]);
  useEffect(() => {
    // Flatten and aggregate files from resolvedItem
    const files: ExamBankFile[] = [];
    if (resolvedItem.wordFileUrl) files.push({ name: 'Word Document (.docx)', size: 0, url: resolvedItem.wordFileUrl });
    if (resolvedItem.pdfFileUrl) files.push({ name: 'PDF Version (.pdf)', size: 0, url: resolvedItem.pdfFileUrl });
    if (resolvedItem.audioFiles) files.push(...resolvedItem.audioFiles);
    if (resolvedItem.imageFiles) files.push(...resolvedItem.imageFiles);
    
    // Add sectional audio/images for full tests
    if (resolvedItem.storageFiles) {
      const sf = resolvedItem.storageFiles;
      if (sf.listening) {
        if (sf.listening.audioFiles) files.push(...sf.listening.audioFiles);
        if (sf.listening.imageFiles) files.push(...sf.listening.imageFiles);
      }
      if (sf.reading && sf.reading.imageFiles) files.push(...sf.reading.imageFiles);
      if (sf.writing && sf.writing.imageFiles) files.push(...sf.writing.imageFiles);
    }
    setMediaList(files);
    setOriginalMediaFiles(JSON.parse(JSON.stringify(files)));
  }, [resolvedItem]);

  // Handle local File Replacement
  const handleReplaceMediaFile = (fileObj: ExamBankFile) => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = fileObj.name.includes('Audio') || fileObj.name.includes('.mp3') ? 'audio/*' : 'image/*';
    fileInput.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (uploadEvent: any) => {
          const base64Url = uploadEvent.target.result;
          setMediaList(prev => prev.map(m => m.url === fileObj.url ? { ...m, name: file.name, size: file.size, url: base64Url } : m));
          alert(language === 'vi' ? `✓ Thay thế tệp "${file.name}" thành công!` : `✓ Replaced "${file.name}" successfully!`);
        };
        reader.readAsDataURL(file);
      }
    };
    fileInput.click();
  };

  // Handle uploading brand new audio file
  const handleUploadNewAudio = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'audio/*';
    fileInput.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (uploadEvent: any) => {
          const base64Url = uploadEvent.target.result;
          const newFileObj: ExamBankFile = {
            name: file.name,
            size: file.size,
            url: base64Url
          };
          setMediaList(prev => [...prev, newFileObj]);
          showToast(language === 'vi' ? `✓ Đã thêm file nghe: ${file.name}` : `✓ Added audio file: ${file.name}`);
        };
        reader.readAsDataURL(file);
      }
    };
    fileInput.click();
  };

  // Handle uploading brand new diagram image
  const handleUploadNewImage = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (uploadEvent: any) => {
          const base64Url = uploadEvent.target.result;
          const newFileObj: ExamBankFile = {
            name: file.name,
            size: file.size,
            url: base64Url
          };
          setMediaList(prev => [...prev, newFileObj]);
          showToast(language === 'vi' ? `✓ Đã thêm sơ đồ: ${file.name}` : `✓ Added image file: ${file.name}`);
        };
        reader.readAsDataURL(file);
      }
    };
    fileInput.click();
  };

  // Word Counter helper
  const countWords = (text: string) => {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  };

  // PLAY AUDIO TEST CARD
  const togglePlayAudio = (url: string) => {
    const audio = audioRefs.current[url];
    if (!audio) return;
    
    if (audioPlayState[url]) {
      audio.pause();
      setAudioPlayState(prev => ({ ...prev, [url]: false }));
    } else {
      // Pause all others
      Object.keys(audioRefs.current).forEach(u => {
        if (u !== url && audioRefs.current[u]) {
          audioRefs.current[u]?.pause();
          setAudioPlayState(prev => ({ ...prev, [u]: false }));
        }
      });
      audio.play().catch(err => console.log('Audio playback error', err));
      setAudioPlayState(prev => ({ ...prev, [url]: true }));
      setActiveAudioUrl(url);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col text-white select-none overflow-hidden font-sans">
      
      {/* 1. TOP CONTROL BAR (Auto-save Indicator, Global Controls) */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between shrink-0 shadow-lg">
        {isPreviewMode ? (
          /* ==================================================== */
          /* SPECIAL REVIEW & PREVIEW HEADER */
          /* ==================================================== */
          <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Left side: Exam Info */}
            <div className="flex items-center gap-4">
              <button 
                onClick={() => {
                  setIsPreviewMode(false);
                  setIsPreviewStudentMode(false);
                }}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-black border border-slate-700"
              >
                <ArrowLeft size={16} />
                <span>{language === 'vi' ? 'Quay lại Exam Editor' : 'Back to Editor'}</span>
              </button>
              
              <div className="h-8 w-[1px] bg-slate-800 hidden md:block" />
              
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-md font-black tracking-tight text-white">
                    {examInfo.title || 'Untitled Test'}
                  </h1>
                  <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded-full uppercase border border-slate-700 font-bold">
                    {examInfo.code}
                  </span>
                  <span className={`text-[9px] px-2.5 py-0.5 rounded-full uppercase font-black border tracking-wider ${
                    examInfo.skill === 'listening' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                    examInfo.skill === 'reading' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                    examInfo.skill === 'writing' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                    'bg-pink-500/10 text-pink-400 border-pink-500/20'
                  }`}>
                    {examInfo.skill}
                  </span>
                  <span className={`text-[9px] px-2.5 py-0.5 rounded-full uppercase font-black border tracking-wider ${
                    examInfo.status === 'published' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}>
                    {examInfo.status === 'published' ? (language === 'vi' ? 'Đã Xuất Bản' : 'Published') : (language === 'vi' ? 'Bản Nháp' : 'Draft')}
                  </span>
                </div>
                
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 font-semibold font-mono">
                  <span>
                    {language === 'vi' ? 'Cập nhật cuối:' : 'Last Updated:'} <span className="text-slate-200">{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'N/A'}</span>
                  </span>
                  <span className="hidden md:inline text-slate-700">•</span>
                  <span>
                    {language === 'vi' ? 'Người sửa cuối:' : 'Last Editor:'} <span className="text-slate-200">{(item as any).updatedBy || 'Admin'}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Right side: Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={runValidation}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-black transition-all border border-slate-700 cursor-pointer flex items-center gap-1.5"
                title={language === 'vi' ? 'Kiểm tra toàn bộ cấu trúc dữ liệu đề thi' : 'Run validation on exam dataset'}
              >
                <CheckSquare size={14} className="text-indigo-400" />
                <span>Validate</span>
              </button>

              <button
                onClick={() => setIsPreviewStudentMode(!isPreviewStudentMode)}
                className={`p-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 border ${
                  isPreviewStudentMode 
                    ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/25 animate-pulse' 
                    : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white border-indigo-500 shadow-md shadow-indigo-500/10'
                }`}
              >
                <Eye size={14} />
                <span>{language === 'vi' ? 'Exam Preview (Học viên)' : 'Exam Preview (Student Mode)'}</span>
              </button>

              <button
                onClick={handlePublish}
                disabled={isPublishing || validationErrors.length > 0}
                className={`p-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-lg ${
                  validationErrors.length > 0 
                    ? 'bg-slate-800/40 text-slate-500 border border-slate-800 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-500/15'
                }`}
              >
                <CheckCircle2 size={14} />
                <span>{isPublishing ? (language === 'vi' ? 'Đang Xuất Bản...' : 'Publishing...') : (language === 'vi' ? 'Publish' : 'Publish')}</span>
              </button>
            </div>
          </div>
        ) : (
          /* ==================================================== */
          /* NORMAL EDIT MODE HEADER */
          /* ==================================================== */
          <>
            <div className="flex items-center gap-4">
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-black"
              >
                <ArrowLeft size={16} />
                <span>{language === 'vi' ? 'Quay Lại' : 'Back'}</span>
              </button>
              
              <div className="h-6 w-[1px] bg-slate-800" />
              
              <div>
                <h1 className="text-sm font-black tracking-wider uppercase text-slate-100 flex items-center gap-2">
                  <span>{language === 'vi' ? 'Trình Biên Tập Đề IELTS' : 'IELTS Coursework Studio'}</span>
                  <span className="text-[10px] bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-full font-bold">Pro Edition</span>
                </h1>
                <p className="text-xs text-slate-400 font-mono mt-0.5 max-w-sm truncate">
                  {examInfo.title || 'Untitled Test'} ({examInfo.code})
                </p>
              </div>
            </div>

            {/* Status Indicators & Save/Publish Commands */}
            <div className="flex items-center gap-4">
              
              {/* Auto Save State Badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <span className={`w-2 h-2 rounded-full ${
                  savingStatus === 'saved' ? 'bg-emerald-500' :
                  savingStatus === 'saving' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'
                }`} />
                <span className="text-[10px] font-mono font-extrabold uppercase tracking-wide">
                  {savingStatus === 'saved' && (language === 'vi' ? 'Đã lưu đám mây' : 'Cloud Synced')}
                  {savingStatus === 'saving' && (language === 'vi' ? 'Đang lưu tự động...' : 'Auto Saving...')}
                  {savingStatus === 'error' && (language === 'vi' ? 'Lỗi kết nối Firestore' : 'Database Sync Error')}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {onReParse && (
                  <button
                    onClick={onReParse}
                    className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-slate-700"
                    title={language === 'vi' ? 'Phân tích lại file Word' : 'Re-parse from Word'}
                  >
                    <RefreshCw size={14} />
                    <span className="hidden md:inline">{language === 'vi' ? 'Parse Lại' : 'Re-parse'}</span>
                  </button>
                )}

                <button
                  onClick={() => setIsPreviewMode(true)}
                  className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-indigo-500 shadow-md shadow-indigo-500/20"
                >
                  <Eye size={14} />
                  <span>{language === 'vi' ? 'Review & Preview' : 'Review & Preview'}</span>
                </button>

                <button
                  onClick={() => handleManualSave('draft')}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700 cursor-pointer flex items-center gap-1.5"
                >
                  <Save size={14} />
                  <span className="hidden md:inline">{language === 'vi' ? 'Lưu Nháp' : 'Save Draft'}</span>
                </button>
              </div>

            </div>
          </>
        )}
      </div>

      {/* 2. LOADING SKELETON */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center bg-slate-950 p-10">
          <div className="space-y-4 max-w-lg w-full text-center">
            <div className="w-12 h-12 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mx-auto mb-4" />
            <div className="h-4 bg-slate-800 rounded-full w-2/3 mx-auto animate-pulse" />
            <div className="h-3 bg-slate-800 rounded-full w-1/2 mx-auto animate-pulse" />
            <div className="h-3 bg-slate-800 rounded-full w-1/3 mx-auto animate-pulse" />
          </div>
        </div>
      ) : isPreviewMode ? (
        /* ==================================================== */
        /* REVIEW & PREVIEW COMPONENT */
        /* ==================================================== */
        isPreviewStudentMode ? (
          /* Student interactive practice mode */
          <div className="flex-1 bg-slate-950 flex flex-col overflow-hidden animate-fade-in">
            <div className="bg-slate-900 px-6 py-4.5 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-ping" />
                <div>
                  <span className="text-xs text-white font-black uppercase tracking-wider block">
                    {language === 'vi' ? 'EXAM PREVIEW (GIAO DIỆN HỌC VIÊN)' : 'EXAM PREVIEW (STUDENT PRACTICE MODE)'}
                  </span>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {examInfo.title} • {examInfo.code}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPreviewStudentMode(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-xl text-xs font-black transition-all border border-slate-700 cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft size={14} />
                {language === 'vi' ? 'Quay lại Studio' : 'Back to Studio'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-slate-950">
              <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Left Area (8 cols): Simulated Student runner */}
                <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-6">
                  {examInfo.skill === 'full' ? (
                    <FullTestRunner
                      exam={mapEditorDataToStudentExam()}
                      currentUser={mockStudentUser}
                      onBack={() => setIsPreviewStudentMode(false)}
                      onAddVocab={() => Promise.resolve()}
                      onAddHighlight={() => Promise.resolve()}
                      onDeleteHighlight={() => Promise.resolve()}
                      highlightList={[]}
                      vocabList={[]}
                      language={language}
                    />
                  ) : (
                    <ExamSectionPractice
                      exam={mapEditorDataToStudentExam()}
                      currentUser={mockStudentUser}
                      onBack={() => setIsPreviewStudentMode(false)}
                      onAddVocab={() => Promise.resolve()}
                      onAddHighlight={() => Promise.resolve()}
                      onDeleteHighlight={() => Promise.resolve()}
                      highlightList={[]}
                      vocabList={[]}
                      language={language}
                    />
                  )}
                </div>

                {/* Right Area (4 cols): Validation Summary panel */}
                <div className="lg:col-span-4 space-y-6">
                  {/* Validation Checklist Card */}
                  {(() => {
                    const isFullTest = examInfo.skill === 'full';
                    const sectionCount = examData?.sections?.length || 0;
                    const sectionPass = isFullTest ? sectionCount >= 4 : sectionCount >= 1;

                    // Question check
                    const totalQuestions = examData?.sections?.reduce((acc: number, sec: any) => {
                      return acc + (sec.questionGroups?.reduce((accG: number, g: any) => accG + (g.questions?.length || 0), 0) || 0);
                    }, 0) || 0;
                    const hasEmptyQuestion = validationErrors.some(e => e.id.includes('text') && e.category === 'question');
                    const questionPass = totalQuestions > 0 && !hasEmptyQuestion;

                    // Answer check
                    const hasEmptyAnswer = validationErrors.some(e => e.id.includes('answer') && e.category === 'question');
                    const answerPass = totalQuestions > 0 && !hasEmptyAnswer;

                    // Transcript check
                    const isListening = examInfo.skill === 'listening';
                    const hasListeningSectionWithoutTranscript = isListening && examData?.sections?.some((s: any) => !s.transcript || s.transcript.trim() === '');
                    const transcriptPass = !isListening || !hasListeningSectionWithoutTranscript;

                    // Vocabulary check
                    const hasVocabulary = examData?.vocabulary && examData.vocabulary.length > 0;
                    const vocabularyPass = !!hasVocabulary;

                    // Audio check
                    const hasAudio = item.audioFiles && item.audioFiles.length > 0;
                    const audioPass = !isListening || hasAudio;

                    // Image check
                    const hasImage = item.imageFiles && item.imageFiles.length > 0;

                    // Timer check
                    const timerPass = examInfo.timeLimit && Number(examInfo.timeLimit) > 0;

                    // JSON check
                    const jsonPass = !!examData && Array.isArray(examData.sections);

                    const checklist = [
                      {
                        key: 'section',
                        labelVi: 'Phần thi (Sections)',
                        labelEn: 'Sections Outline',
                        status: sectionPass,
                        descVi: isFullTest ? `${sectionCount}/4 Sections` : `${sectionCount} Section(s)`,
                        descEn: isFullTest ? `${sectionCount}/4 Sections` : `${sectionCount} Section(s)`,
                        icon: BookOpen,
                      },
                      {
                        key: 'question',
                        labelVi: 'Nội dung câu hỏi',
                        labelEn: 'Question Content',
                        status: questionPass,
                        descVi: totalQuestions > 0 ? `${totalQuestions} câu hỏi đầy đủ` : 'Chưa có câu hỏi',
                        descEn: totalQuestions > 0 ? `${totalQuestions} questions OK` : 'No questions',
                        icon: HelpCircle,
                      },
                      {
                        key: 'answer',
                        labelVi: 'Đáp án chính xác',
                        labelEn: 'Correct Answers',
                        status: answerPass,
                        descVi: answerPass ? 'Đã điền đầy đủ' : 'Thiếu đáp án',
                        descEn: answerPass ? 'All populated' : 'Missing answers',
                        icon: CheckSquare,
                      },
                      {
                        key: 'transcript',
                        labelVi: 'Bài dịch & Giải thích',
                        labelEn: 'Transcript & Explanations',
                        status: transcriptPass,
                        descVi: transcriptPass ? 'Sẵn sàng' : 'Chưa nhập transcript',
                        descEn: transcriptPass ? 'Ready' : 'Missing transcript',
                        icon: FileText,
                      },
                      {
                        key: 'vocabulary',
                        labelVi: 'Danh mục từ vựng',
                        labelEn: 'Vocabulary Library',
                        status: vocabularyPass,
                        descVi: vocabularyPass ? 'Đã nạp thành công' : 'Chưa nạp từ vựng',
                        descEn: vocabularyPass ? 'Loaded successfully' : 'No vocabulary',
                        icon: Settings,
                      },
                      {
                        key: 'audio',
                        labelVi: 'Tệp âm thanh (Audio)',
                        labelEn: 'Listening Tape',
                        status: audioPass,
                        descVi: audioPass ? 'Đã gắn tệp nghe' : 'Thiếu file audio',
                        descEn: audioPass ? 'Audio attached' : 'Missing audio',
                        icon: Music,
                      },
                      {
                        key: 'image',
                        labelVi: 'Sơ đồ hình ảnh',
                        labelEn: 'Diagram Images',
                        status: true,
                        descVi: hasImage ? 'Đã liên kết' : 'Không có (Tùy chọn)',
                        descEn: hasImage ? 'Attached' : 'None (Optional)',
                        icon: Image,
                      },
                      {
                        key: 'timer',
                        labelVi: 'Thời lượng giới hạn',
                        labelEn: 'Time Limit Countdown',
                        status: timerPass,
                        descVi: timerPass ? `${examInfo.timeLimit} phút` : 'Chưa cấu hình',
                        descEn: timerPass ? `${examInfo.timeLimit} mins` : 'Not set',
                        icon: Clock,
                      },
                      {
                        key: 'json',
                        labelVi: 'Dữ liệu JSON',
                        labelEn: 'JSON Schema Validation',
                        status: jsonPass,
                        descVi: jsonPass ? 'Hợp lệ tuyệt đối' : 'Lỗi định dạng',
                        descEn: jsonPass ? 'Strictly valid' : 'Format error',
                        icon: Sliders,
                      },
                    ];

                    return (
                      <>
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl text-left">
                          <h3 className="text-xs font-black tracking-widest text-slate-300 uppercase flex items-center gap-1.5 border-b border-slate-800 pb-3">
                            <Sliders size={14} className="text-blue-500" />
                            {language === 'vi' ? 'BẢNG TÓM TẮT TÍNH HỢP LỆ' : 'VALIDATION SUMMARY'}
                          </h3>

                          <div className="grid grid-cols-1 gap-2.5">
                            {checklist.map((item, idx) => {
                              const IconComp = item.icon;
                              return (
                                <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-950/50 rounded-xl border border-slate-800/60 text-xs">
                                  <div className="flex items-center gap-2">
                                    <div className={`p-1.5 rounded-lg bg-slate-900 border border-slate-800`}>
                                      <IconComp size={13} className="text-slate-400" />
                                    </div>
                                    <div>
                                      <p className="font-extrabold text-slate-300">{language === 'vi' ? item.labelVi : item.labelEn}</p>
                                      <p className="text-[10px] text-slate-500 mt-0.5">{language === 'vi' ? item.descVi : item.descEn}</p>
                                    </div>
                                  </div>

                                  <div>
                                    {item.status ? (
                                      <span className="inline-flex items-center gap-0.5 text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-black">
                                        <Check size={10} />
                                        {language === 'vi' ? 'HỢP LỆ' : 'VALID'}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-0.5 text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full font-black animate-pulse">
                                        <X size={10} />
                                        {language === 'vi' ? 'THIẾU/LỖI' : 'ERR'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Publish Status CTA and Errors List */}
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl text-left">
                          <h3 className="text-xs font-black tracking-widest text-slate-300 uppercase flex items-center gap-1.5 border-b border-slate-800 pb-3">
                            <Send size={14} className="text-emerald-500" />
                            {language === 'vi' ? 'XUẤT BẢN ĐỀ THI' : 'PUBLISH OPTIONS'}
                          </h3>

                          {validationErrors.length > 0 ? (
                            <div className="p-3 bg-red-950/30 border border-red-500/20 rounded-xl text-left">
                              <p className="text-[10px] font-black text-red-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                                <AlertCircle size={12} />
                                {language === 'vi' ? 'CẢNH BÁO LỖI HỆ THỐNG' : 'SYSTEM DATA WARNING'}
                              </p>
                              <p className="text-[11px] text-slate-300 leading-relaxed font-semibold">
                                {language === 'vi' 
                                  ? `Đề thi hiện tại có ${validationErrors.length} lỗi cấu trúc dữ liệu. Chức năng Xuất Bản đã bị vô hiệu hóa để đảm bảo an toàn.`
                                  : `This exam has ${validationErrors.length} structural issues. Publishing is disabled until all errors are fixed.`}
                              </p>
                            </div>
                          ) : (
                            <div className="p-3 bg-emerald-950/30 border border-emerald-500/20 rounded-xl text-left">
                              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                                <CheckCircle2 size={12} />
                                {language === 'vi' ? 'ĐỀ THI HOÀN HẢO' : 'DATA READY TO SHIPPED'}
                              </p>
                              <p className="text-[11px] text-slate-300 leading-relaxed font-semibold">
                                {language === 'vi' 
                                  ? 'Đề thi đã đầy đủ và đạt tiêu chuẩn chất lượng. Sẵn sàng hoạt động trên hệ thống học viên!'
                                  : 'The exam successfully complies with all standards and schemas. Live and active instantly.'}
                              </p>
                            </div>
                          )}

                          <button
                            onClick={handlePublish}
                            disabled={isPublishing || validationErrors.length > 0}
                            className={`w-full py-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg ${
                              validationErrors.length > 0 
                                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed' 
                                : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-500/15'
                            }`}
                          >
                            <CheckCircle2 size={15} />
                            <span>{isPublishing ? (language === 'vi' ? 'Đang Xuất Bản...' : 'Publishing...') : (language === 'vi' ? 'Xuất bản đề thi' : 'Publish Exam')}</span>
                          </button>

                          {validationErrors.length > 0 && (
                            <div className="space-y-2 mt-4 pt-3 border-t border-slate-800">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                                {language === 'vi' ? 'DANH SÁCH LỖI (CLICK ĐỂ SỬA):' : 'ISSUE TRACKER LOG (CLICK TO FIX):'}
                              </span>
                              <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                {validationErrors.map((err) => (
                                  <div 
                                    key={err.id}
                                    onClick={() => handleFixError(err.nodeToSelect)}
                                    className="p-2.5 bg-slate-950/80 border border-slate-800/80 hover:border-rose-500/40 rounded-xl text-left cursor-pointer transition-all hover:bg-slate-950 group/err"
                                  >
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="text-[8px] bg-rose-500/15 text-rose-400 font-extrabold px-1.5 py-0.5 rounded uppercase font-mono">
                                        {err.category}
                                      </span>
                                      <span className="text-[8px] text-indigo-400 opacity-0 group-hover/err:opacity-100 font-bold transition-all flex items-center gap-0.5">
                                        Sửa ngay <ArrowRight size={8} />
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-slate-300 font-semibold leading-relaxed line-clamp-2">
                                      {err.message}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>

              </div>
            </div>
          </div>
        ) : (
          /* General Review Dashboard */
          <div className="flex-1 overflow-y-auto bg-slate-900 p-6 md:p-8 custom-scrollbar animate-fade-in">
            <div className="max-w-6xl mx-auto space-y-6">
              
              {/* UNPARSED WARNING BANNER */}
              {!resolvedItem?.isParsed && (
                <div className="bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-2xl p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20 shrink-0">
                      <Sparkles size={18} className="animate-pulse text-amber-400" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider">
                        {language === 'vi' ? 'Đề thi chưa được phân tích (Unparsed)' : 'Unparsed Word Document Detected'}
                      </h4>
                      <p className="text-[11px] text-slate-300 font-semibold leading-relaxed mt-1">
                        {language === 'vi' 
                          ? 'Bạn đã tải lên tệp Word thành công nhưng đề thi này đang ở cấu trúc câu hỏi mẫu mặc định. Hãy bấm vào nút bên cạnh để phân tích tự động nội dung đề thi từ tệp Word!' 
                          : 'You successfully uploaded a Word file, but this exam is currently using a default question template. Please run the parser to convert your document into interactive questions!'}
                      </p>
                    </div>
                  </div>
                  {onReParse && (
                    <button
                      onClick={onReParse}
                      className="shrink-0 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-amber-500/10 border border-amber-400/30 font-sans"
                    >
                      <RefreshCw size={13} className="animate-spin-slow" />
                      <span>{language === 'vi' ? 'Phân tích file Word' : 'Parse Word File'}</span>
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Left Side: Exam outline checklist & details (8 cols) */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* 1. Banner Info Card */}
                <div className="bg-slate-950 border border-slate-800/80 p-6 rounded-3xl space-y-4 shadow-xl">
                  <span className="text-[10px] bg-slate-800 text-slate-300 font-black uppercase px-2.5 py-1 rounded-full border border-slate-700">
                    {language === 'vi' ? 'Tổng quan đề thi' : 'General Meta'}
                  </span>
                  <h1 className="text-2xl font-black text-white tracking-tight">{examInfo.title || 'Untitled Exam'}</h1>
                  <p className="text-xs text-slate-400 leading-relaxed font-semibold">{examInfo.description || (language === 'vi' ? 'Chưa có mô tả đề thi.' : 'No exam description provided.')}</p>
                  
                  <div className="grid grid-cols-3 gap-4 pt-2 text-center">
                    <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800/50">
                      <span className="block text-[10px] text-slate-500 uppercase tracking-widest font-black">{language === 'vi' ? 'Độ khó' : 'Difficulty'}</span>
                      <span className="block text-sm font-black text-white mt-1 uppercase font-mono">{examInfo.difficulty}</span>
                    </div>
                    <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800/50">
                      <span className="block text-[10px] text-slate-500 uppercase tracking-widest font-black">{language === 'vi' ? 'Thời lượng' : 'Time Limit'}</span>
                      <span className="block text-sm font-black text-indigo-400 mt-1 uppercase font-mono">{examInfo.timeLimit} MINS</span>
                    </div>
                    <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800/50">
                      <span className="block text-[10px] text-slate-500 uppercase tracking-widest font-black">{language === 'vi' ? 'Số câu hỏi' : 'Total Questions'}</span>
                      <span className="block text-sm font-black text-emerald-400 mt-1 uppercase font-mono">
                        {examData?.sections?.reduce((acc: number, sec: any) => {
                          return acc + (sec.questionGroups?.reduce((acc2: number, grp: any) => acc2 + (grp.questions?.length || 0), 0) || 0);
                        }, 0) || 0} Qs
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Structured Sections Card */}
                <div className="bg-slate-950/60 border border-slate-800/60 rounded-3xl p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <span className="text-xs font-black tracking-wider text-slate-300 uppercase flex items-center gap-1.5">
                      <BookOpen size={14} className="text-indigo-400" />
                      {language === 'vi' ? 'CẤU TRÚC PHẦN THI' : 'EXAM OUTLINE'}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {examData?.sections?.length || 0} Sections
                    </span>
                  </div>

                  <div className="space-y-4">
                    {examData?.sections?.map((sec: any, sIdx: number) => {
                      const totalQs = sec.questionGroups?.reduce((acc: number, g: any) => acc + (g.questions?.length || 0), 0) || 0;
                      return (
                        <div key={sIdx} className="bg-slate-900/40 p-4 border border-slate-800/50 rounded-2xl space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-extrabold text-indigo-400 font-mono">{sec.id}</span>
                            <span className="text-[10px] font-mono font-bold text-slate-400">
                              {totalQs} {language === 'vi' ? 'câu hỏi' : 'questions'} • {sec.questionGroups?.length || 0} {language === 'vi' ? 'nhóm' : 'groups'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 font-bold">{sec.title || (language === 'vi' ? '(Chưa đặt tên phần thi)' : '(Unnamed section)')}</p>
                          
                          {sec.passages?.length > 0 && (
                            <div className="mt-2 text-[10px] bg-slate-950 p-2 border border-slate-800/40 rounded-xl text-slate-400 flex items-center gap-1.5">
                              <span className="text-slate-500">📖</span>
                              <span className="font-semibold truncate">{sec.passages[0].title}</span>
                              <span className="font-mono text-slate-600">({countWords(sec.passages[0].content)} words)</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Media & Resources Card */}
                <div className="bg-slate-950/60 border border-slate-800/60 rounded-3xl p-6 space-y-4">
                  <span className="text-xs font-black tracking-wider text-slate-300 uppercase flex items-center gap-1.5">
                    <Music size={14} className="text-indigo-400" />
                    {language === 'vi' ? 'TÀI NGUYÊN ĐA PHƯƠNG TIỆN' : 'MEDIA FILES'}
                  </span>
                  
                  {resolvedItem.audioFiles && resolvedItem.audioFiles.length > 0 ? (
                    <div className="space-y-2">
                      {resolvedItem.audioFiles.map((f: ExamBankFile, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-800/50 rounded-xl">
                          <div className="flex items-center gap-2">
                            <Volume2 size={14} className="text-sky-400" />
                            <span className="text-xs text-slate-300 font-semibold font-mono truncate max-w-xs">{f.name}</span>
                          </div>
                          {f.url && f.url.trim() !== '' && !f.url.startsWith('localcache:') ? (
                            <audio src={f.url} controls className="h-6 w-48 scale-90 origin-right" />
                          ) : (
                            <span className="text-[10px] text-slate-500 italic">
                              {f.url?.startsWith('localcache:')
                                ? (language === 'vi' ? 'Đang tải âm thanh từ bộ nhớ...' : 'Loading cached audio...')
                                : (language === 'vi' ? 'Không có nguồn âm thanh' : 'No audio source')}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">
                      {language === 'vi' ? 'Không phát hiện tệp âm thanh nghe nào.' : 'No audio resources attached.'}
                    </p>
                  )}
                </div>

              </div>

              {/* Right Side: Validation Control Panel (5 cols) */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* 4. Core Validation Status Card */}
                {validationErrors.length > 0 ? (
                  <div className="bg-gradient-to-br from-rose-950/80 to-slate-950 border border-rose-500/30 p-6 rounded-3xl shadow-xl space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center border border-rose-500/30">
                        <AlertCircle size={20} className="animate-bounce" />
                      </div>
                      <div>
                        <h2 className="text-sm font-black text-white uppercase tracking-wider">{language === 'vi' ? 'ĐỀ THI CÓ LỖI CẤU TRÚC' : 'STRUCTURAL ERRORS FOUND'}</h2>
                        <span className="text-xs text-rose-400 font-extrabold font-mono">{validationErrors.length} {language === 'vi' ? 'Lỗi cần khắc phục' : 'Errors to be resolved'}</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                      {language === 'vi' 
                        ? 'Chức năng xuất bản đề đã bị khóa để ngăn chặn việc học sinh làm đề thi bị thiếu thông tin hoặc sai cấu trúc dữ liệu. Vui lòng bấm vào từng lỗi bên dưới để trực tiếp sửa lỗi.'
                        : 'Publication capability is currently locked. This prevents students from loading corrupt or incomplete exams. Click any error block below to jump directly to the field.'}
                    </p>
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-emerald-950/80 to-slate-950 border border-emerald-500/30 p-6 rounded-3xl shadow-xl space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center border border-emerald-500/30">
                        <CheckCircle2 size={20} />
                      </div>
                      <div>
                        <h2 className="text-sm font-black text-white uppercase tracking-wider">{language === 'vi' ? 'ĐỀ THI ĐÃ SẴN SÀNG' : 'EXAM DATA PASSED'}</h2>
                        <span className="text-xs text-emerald-400 font-extrabold font-mono">{language === 'vi' ? 'Hoàn toàn không có lỗi' : '0 validation errors'}</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                      {language === 'vi' 
                        ? 'Xin chúc mừng! Đề thi đã xuất sắc vượt qua các bài kiểm tra cấu trúc dữ liệu nghiêm ngặt. Đề thi đã hoàn hảo và sẵn sàng để phát hành cho học sinh luyện tập.'
                        : 'Excellent work! The exam successfully passed all strict data schema checks. The document is perfect and ready to be issued to students for study.'}
                    </p>
                  </div>
                )}

                {/* 5. Detailed Interactive Error Lists */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-3xl p-6 space-y-4">
                  <span className="text-xs font-black tracking-wider text-slate-300 uppercase block">
                    {language === 'vi' ? 'DANH SÁCH LỖI BIÊN TẬP' : 'VALIDATION ENGINE LOG'}
                  </span>

                  {validationErrors.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
                      {validationErrors.map((err) => (
                        <div 
                          key={err.id}
                          onClick={() => handleFixError(err.nodeToSelect)}
                          className="p-3.5 bg-slate-900 border border-slate-800/80 hover:border-rose-500/40 rounded-2xl text-left cursor-pointer transition-all hover:bg-slate-900/90 group/err relative"
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] bg-rose-500/10 text-rose-400 font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                              {err.category}
                            </span>
                            <span className="text-[10px] text-indigo-400 font-extrabold opacity-0 group-hover/err:opacity-100 transition-opacity">
                              {language === 'vi' ? 'Sửa ngay →' : 'Fix now →'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed font-bold">
                            {err.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-slate-900/40 border border-slate-800/60 rounded-2xl">
                      <p className="text-xs text-slate-500 italic">
                        {language === 'vi' ? '✓ Tuyệt vời! Không tìm thấy lỗi chỉnh sửa nào.' : '✓ Exceptional! No editing flaws discovered.'}
                      </p>
                    </div>
                  )}
                </div>

              </div>
              
            </div>
          </div>
        </div>
      )
      ) : (
        /* ==================================================== */
        /* EDIT MODE GRID SCREEN */
        /* ==================================================== */
        <div className="flex-1 flex overflow-hidden">
          
          {/* A. LEFT SIDEBAR (Exam structure checklist & navigation) */}
          <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
            
            {/* Header / New node trigger */}
            <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between shrink-0">
              <span className="text-xs font-black tracking-wider text-slate-400 uppercase">
                {language === 'vi' ? 'CẤU TRÚC ĐỀ THI' : 'EXAM OUTLINE'}
              </span>
              <button
                onClick={handleAddSection}
                className="p-1 hover:bg-slate-800 rounded-lg text-indigo-400 hover:text-indigo-300 cursor-pointer"
                title={language === 'vi' ? 'Thêm Section mới' : 'Add new section'}
              >
                <Plus size={16} />
              </button>
            </div>

            {/* Hierarchy Tree scrolling wrapper */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
              
              {/* Node 1: GENERAL INFO (Exam Details) */}
              <button
                onClick={() => setSelectedNode({ type: 'info' })}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  selectedNode.type === 'info'
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <Settings size={15} className={selectedNode.type === 'info' ? 'text-white' : 'text-indigo-400'} />
                <div className="flex-1 min-w-0">
                  <span className="block text-xs font-extrabold truncate">{language === 'vi' ? 'Thông Tin Tổng Quan' : 'General Settings'}</span>
                  <span className="block text-[9px] font-mono text-slate-400 uppercase mt-0.5">{examInfo.status} • {examInfo.difficulty}</span>
                </div>
              </button>

              {/* Node 2: SECTIONS LIST */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2.5 block">
                  {language === 'vi' ? 'CÁC PHẦN THI (SECTIONS)' : 'EXAM SECTIONS'}
                </span>
                
                {examData?.sections.map((sec: any, sIdx: number) => {
                  const isActive = selectedNode.type === 'section' && selectedNode.sectionIndex === sIdx;
                  const totalQ = sec.questionGroups?.reduce((acc: number, g: any) => acc + (g.questions?.length || 0), 0) || 0;
                  
                  let nodeLabel = sec.id;
                  if (examInfo.skill === 'listening') {
                    nodeLabel = language === 'vi' ? `Phần nghe ${sIdx + 1}` : `Section ${sIdx + 1}`;
                  } else if (examInfo.skill === 'reading') {
                    nodeLabel = language === 'vi' ? `Bài đọc ${sIdx + 1}` : `Passage ${sIdx + 1}`;
                  } else if (examInfo.skill === 'writing') {
                    nodeLabel = language === 'vi' ? `Task viết ${sIdx + 1}` : `Writing Task ${sIdx + 1}`;
                  } else if (examInfo.skill === 'speaking') {
                    nodeLabel = language === 'vi' ? `Phần nói ${sIdx + 1}` : `Speaking Part ${sIdx + 1}`;
                  }

                  return (
                    <div 
                      key={sIdx}
                      draggable
                      onDragStart={(e) => handleDragStart(e, 'section', sIdx)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, 'section', sIdx)}
                      className={`group/sec border rounded-xl overflow-hidden transition-all ${
                        isActive 
                          ? 'bg-slate-950 border-indigo-500 shadow-md shadow-indigo-500/5' 
                          : 'bg-slate-950/20 border-slate-800 hover:border-slate-800'
                      }`}
                    >
                      {/* Section Main Header Link */}
                      <div className="flex items-center justify-between p-3 cursor-pointer select-none">
                        <div 
                          onClick={() => setSelectedNode({ type: 'section', sectionIndex: sIdx })}
                          className="flex-1 min-w-0 flex items-center gap-2"
                        >
                          <Hash size={13} className="text-indigo-400" />
                          <div className="flex-1 min-w-0">
                            <span className="block text-xs font-extrabold text-slate-200 truncate">{nodeLabel}</span>
                            <span className="block text-[9px] font-mono text-slate-500 uppercase mt-0.5">
                              {totalQ} Questions {sec.passages?.length > 0 ? '• Passage' : ''}
                            </span>
                          </div>
                        </div>

                        {/* Reorder/Delete fast triggers */}
                        <div className="flex items-center gap-1 opacity-0 group-hover/sec:opacity-100 transition-opacity">
                          <button
                            disabled={sIdx === 0}
                            onClick={(e) => { e.stopPropagation(); moveSection(sIdx, 'up'); }}
                            className="p-1 hover:bg-slate-800 rounded-md text-slate-400 disabled:opacity-30"
                          >
                            <ArrowUp size={11} />
                          </button>
                          <button
                            disabled={sIdx === examData.sections.length - 1}
                            onClick={(e) => { e.stopPropagation(); moveSection(sIdx, 'down'); }}
                            className="p-1 hover:bg-slate-800 rounded-md text-slate-400 disabled:opacity-30"
                          >
                            <ArrowDown size={11} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteSection(sIdx); }}
                            className="p-1 hover:bg-red-500/20 text-red-400 rounded-md hover:text-red-300"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>

                      {/* Nested details (Sub passages / Question groups) */}
                      {sec.questionGroups?.length > 0 && (
                        <div className="bg-slate-950/40 border-t border-slate-900 p-2 space-y-1">
                          {sec.questionGroups.map((g: any, gIdx: number) => (
                            <button
                              key={gIdx}
                              onClick={() => setSelectedNode({ type: 'section', sectionIndex: sIdx, subType: 'questions', subIndex: gIdx })}
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-[11px] font-semibold transition-all cursor-pointer ${
                                selectedNode.type === 'section' && selectedNode.sectionIndex === sIdx && selectedNode.subType === 'questions' && selectedNode.subIndex === gIdx
                                  ? 'bg-slate-800 text-white font-extrabold border-l-2 border-indigo-400'
                                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                              }`}
                            >
                              <span className="truncate">Group {g.range} ({g.type})</span>
                              <ChevronRight size={10} className="text-slate-600" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Node 3: VOCABULARY LIST */}
              <button
                onClick={() => setSelectedNode({ type: 'vocabulary' })}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  selectedNode.type === 'vocabulary'
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <BookMarked size={15} className={selectedNode.type === 'vocabulary' ? 'text-white' : 'text-purple-400'} />
                  <div className="flex-1">
                    <span className="block text-xs font-extrabold">{language === 'vi' ? 'Sổ Từ Vựng (Vocabulary)' : 'Vocabulary Book'}</span>
                    <span className="block text-[9px] font-mono text-slate-400 mt-0.5">{examData?.vocabulary?.length || 0} Terms Found</span>
                  </div>
                </div>
                <ChevronRight size={12} className={selectedNode.type === 'vocabulary' ? 'text-white' : 'text-slate-600'} />
              </button>

              {/* Node 4: ATTACHED MEDIA ASSETS */}
              <button
                onClick={() => setSelectedNode({ type: 'media' })}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  selectedNode.type === 'media'
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Globe size={15} className={selectedNode.type === 'media' ? 'text-white' : 'text-emerald-400'} />
                  <div className="flex-1">
                    <span className="block text-xs font-extrabold">{language === 'vi' ? 'Kho Tài Nguyên (Media)' : 'Exam Media & Files'}</span>
                    <span className="block text-[9px] font-mono text-slate-400 mt-0.5">{mediaList.length} Attachments</span>
                  </div>
                </div>
                <ChevronRight size={12} className={selectedNode.type === 'media' ? 'text-white' : 'text-slate-600'} />
              </button>

            </div>
          </div>

          {/* B. RIGHT PANEL EDITING WORKSPACE (Tab-sensitive forms) */}
          <div className="flex-1 bg-slate-950 flex flex-col min-h-0 overflow-y-auto p-8 custom-scrollbar">
            
            {/* COMPARTMENT 0: UNPARSED WARNING BANNER */}
            {!resolvedItem?.isParsed && (
              <div className="mb-6 bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-2xl p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20 shrink-0">
                    <Sparkles size={18} className="animate-pulse text-amber-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider">
                      {language === 'vi' ? 'Đề thi chưa được phân tích (Unparsed)' : 'Unparsed Word Document Detected'}
                    </h4>
                    <p className="text-[11px] text-slate-300 font-semibold leading-relaxed mt-1">
                      {language === 'vi' 
                        ? 'Bạn đã tải lên tệp Word thành công nhưng đề thi này đang ở cấu trúc câu hỏi mẫu mặc định. Hãy bấm vào nút bên cạnh để phân tích tự động nội dung đề thi từ tệp Word!' 
                        : 'You successfully uploaded a Word file, but this exam is currently using a default question template. Please run the parser to convert your document into interactive questions!'}
                    </p>
                  </div>
                </div>
                {onReParse && (
                  <button
                    onClick={onReParse}
                    className="shrink-0 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-amber-500/10 border border-amber-400/30 font-sans"
                  >
                    <RefreshCw size={13} className="animate-spin-slow" />
                    <span>{language === 'vi' ? 'Phân tích file Word' : 'Parse Word File'}</span>
                  </button>
                )}
              </div>
            )}

            {/* COMPARTMENT 1: GENERAL EXAM INFO SETTINGS */}
            {selectedNode.type === 'info' && (
              <div className="max-w-3xl space-y-6 animate-fade-in">
                <div className="border-b border-slate-800 pb-4">
                  <h2 className="text-xl font-black text-white">{language === 'vi' ? 'Thông Tin Chi Tiết Đề Thi' : 'Configure Exam Information'}</h2>
                  <p className="text-xs text-slate-400 mt-1">{language === 'vi' ? 'Cập nhật tiêu đề, mã đề, độ khó và các giới hạn thời gian làm bài.' : 'Manage metadata, classifications, difficulty metrics, and durations.'}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Title */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400">{language === 'vi' ? 'Tên đề thi' : 'Exam Title'}</label>
                    <input
                      type="text"
                      value={examInfo.title}
                      onChange={(e) => setExamInfo({ ...examInfo, title: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-100 focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>

                  {/* Code */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400">{language === 'vi' ? 'Mã đề thi' : 'Exam Code'}</label>
                    <input
                      type="text"
                      value={examInfo.code}
                      onChange={(e) => setExamInfo({ ...examInfo, code: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono text-slate-100 focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>

                  {/* Skill */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400">{language === 'vi' ? 'Kỹ năng IELTS' : 'IELTS Skill'}</label>
                    <select
                      value={examInfo.skill}
                      onChange={(e) => setExamInfo({ ...examInfo, skill: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-100 focus:outline-hidden focus:border-indigo-500"
                    >
                      <option value="listening">Listening</option>
                      <option value="reading">Reading</option>
                      <option value="writing">Writing</option>
                      <option value="speaking">Speaking</option>
                      <option value="full">Full Academic Test</option>
                    </select>
                  </div>

                  {/* Difficulty */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400">{language === 'vi' ? 'Độ khó' : 'Target Difficulty'}</label>
                    <select
                      value={examInfo.difficulty}
                      onChange={(e) => setExamInfo({ ...examInfo, difficulty: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-100 focus:outline-hidden focus:border-indigo-500"
                    >
                      <option value="Easy">Easy (Dễ)</option>
                      <option value="Medium">Medium (Trung bình)</option>
                      <option value="Hard">Hard (Khó)</option>
                    </select>
                  </div>

                  {/* Time limit */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400">{language === 'vi' ? 'Thời gian làm bài (phút)' : 'Time Limit (minutes)'}</label>
                    <input
                      type="number"
                      value={examInfo.timeLimit}
                      onChange={(e) => setExamInfo({ ...examInfo, timeLimit: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono font-bold text-slate-100 focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>

                  {/* Status */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400">{language === 'vi' ? 'Trạng thái phát hành' : 'Publish Status'}</label>
                    <select
                      value={examInfo.status}
                      onChange={(e) => setExamInfo({ ...examInfo, status: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-100 focus:outline-hidden focus:border-indigo-500"
                    >
                      <option value="draft">Draft (Bản nháp)</option>
                      <option value="published">Published (Đã xuất bản - Học viên có thể xem)</option>
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400">{language === 'vi' ? 'Mô tả bài thi' : 'Exam Description'}</label>
                  <textarea
                    rows={4}
                    value={examInfo.description}
                    onChange={(e) => setExamInfo({ ...examInfo, description: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs font-semibold text-slate-200 focus:outline-hidden focus:border-indigo-500 resize-none"
                    placeholder="Mô tả tóm tắt nội dung bài thi..."
                  />
                </div>

                {/* Cover Image Selection */}
                <div className="bg-slate-900/40 p-4.5 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-slate-200">{language === 'vi' ? 'Ảnh bìa đề thi (Cover Image)' : 'Exam Cover Image'}</h4>
                      <p className="text-[10px] text-slate-400">{language === 'vi' ? 'Hiển thị hình ảnh đẹp mắt cho đề thi trên trang của học sinh.' : 'Show an attractive cover image for the exam in the practice portal.'}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={examInfo.showCoverImage !== false}
                        onChange={(e) => setExamInfo({ ...examInfo, showCoverImage: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                      <span className="ml-2 text-[10px] font-bold text-slate-400">{examInfo.showCoverImage !== false ? (language === 'vi' ? 'Bật' : 'On') : (language === 'vi' ? 'Tắt' : 'Off')}</span>
                    </label>
                  </div>

                  {examInfo.showCoverImage !== false && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">{language === 'vi' ? 'Đường dẫn hình ảnh (URL)' : 'Image URL'}</label>
                        <input 
                          type="text"
                          value={examInfo.coverImage || ''}
                          onChange={(e) => setExamInfo({ ...examInfo, coverImage: e.target.value })}
                          placeholder="https://images.unsplash.com/... hoặc chọn mẫu bên dưới"
                          className="w-full px-3 py-2.5 text-xs bg-slate-950 border border-slate-800 text-slate-100 rounded-xl focus:border-indigo-500 outline-none font-mono animate-fade-in"
                        />
                      </div>

                      {/* Presets Grid */}
                      <div className="space-y-1.5 animate-fade-in">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">{language === 'vi' ? 'Chọn ảnh mẫu có sẵn' : 'Choose a preset image'}</label>
                        <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                          {[
                            { name: 'Library', url: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=600&auto=format&fit=crop' },
                            { name: 'Desk', url: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&auto=format&fit=crop' },
                            { name: 'Campus', url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=600&auto=format&fit=crop' },
                            { name: 'Notebook', url: 'https://images.unsplash.com/photo-1517842645767-c639042777db?w=600&auto=format&fit=crop' },
                            { name: 'Audio', url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop' },
                            { name: 'Nature', url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=600&auto=format&fit=crop' },
                            { name: 'Classroom', url: 'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=600&auto=format&fit=crop' },
                            { name: 'Flower', url: 'https://images.unsplash.com/photo-1561181286-d3fee7d55364?w=600&auto=format&fit=crop' }
                          ].map((p, pIdx) => (
                            <button
                              key={pIdx}
                              type="button"
                              onClick={() => setExamInfo({ ...examInfo, coverImage: p.url })}
                              className={`relative h-12 rounded-lg overflow-hidden border-2 transition-all group ${examInfo.coverImage === p.url ? 'border-indigo-500 scale-95 shadow-xs' : 'border-transparent hover:border-slate-700'}`}
                            >
                              <img src={p.url} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200" referrerPolicy="no-referrer" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <span className="text-[8px] text-white font-bold tracking-wider">{p.name}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* COMPARTMENT 2: SECTION WORKSPACE (Editable Passage, Transcript, Question groups) */}
            {selectedNode.type === 'section' && selectedNode.sectionIndex !== undefined && (() => {
              const sIdx = selectedNode.sectionIndex;
              const sec = examData?.sections[sIdx];
              if (!sec) return null;

              return (
                <div className="max-w-4xl space-y-8 animate-fade-in">
                  
                  {/* Section Title details */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div>
                      <span className="text-[10px] font-mono text-indigo-400 font-extrabold uppercase">Section Editing Room</span>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="text"
                          value={sec.id}
                          onChange={(e) => {
                            const newSections = [...examData.sections];
                            newSections[sIdx].id = e.target.value;
                            setExamData({ ...examData, sections: newSections });
                          }}
                          className="bg-transparent border-b border-dashed border-slate-700 text-lg font-black text-white focus:outline-hidden focus:border-indigo-400 px-1 font-mono uppercase"
                        />
                      </div>
                    </div>
                  </div>

                  {/* SECTION MEDIA & ATTACHMENTS (IMAGE & AUDIO) */}
                  <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                      <span className="text-xs font-black tracking-wider text-slate-300 uppercase flex items-center gap-2">
                        <Sliders size={14} className="text-indigo-400" />
                        {language === 'vi' ? 'PHƯƠNG TIỆN & ĐÍNH KÈM PHẦN THI' : 'SECTION MEDIA & ATTACHMENTS'}
                      </span>
                    </div>
                    
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {language === 'vi' 
                        ? 'Thêm tệp âm thanh (Audio) và hình ảnh (Image) minh họa cụ thể cho phần thi này. Thích hợp cho bài nghe, biểu đồ, sơ đồ trong Reading/Writing hoặc chủ đề Speaking.' 
                        : 'Add audio tracks and diagram/illustrations specifically for this section. Ideal for listening tracks, reading charts/diagrams, writing tasks, or speaking cue cards.'}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Audio Attachment */}
                      <div className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-850">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black uppercase text-indigo-400 flex items-center gap-1.5">
                            <Music size={12} />
                            {language === 'vi' ? 'Audio Bài Nghe' : 'Audio Attachment'}
                          </label>
                          {sec.audioUrl && (
                            <span className="text-[9px] bg-emerald-500/15 text-emerald-400 font-bold px-2 py-0.5 rounded-full font-mono uppercase">
                              Active
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={sec.audioUrl || ''}
                            onChange={(e) => {
                              const newSections = [...examData.sections];
                              newSections[sIdx].audioUrl = e.target.value;
                              setExamData({ ...examData, sections: newSections });
                            }}
                            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 focus:outline-hidden focus:border-indigo-500"
                            placeholder="https://example.com/audio.mp3"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = 'audio/*';
                              input.onchange = (e: any) => {
                                const file = e.target?.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (evt: any) => {
                                    const base64 = evt.target.result;
                                    const newSections = [...examData.sections];
                                    newSections[sIdx].audioUrl = base64;
                                    setExamData({ ...examData, sections: newSections });
                                    showToast(language === 'vi' ? '✓ Tải lên audio thành công!' : '✓ Audio uploaded successfully!');
                                  };
                                  reader.readAsDataURL(file);
                                }
                              };
                              input.click();
                            }}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all shrink-0 cursor-pointer"
                          >
                            <Upload size={12} />
                            <span>{language === 'vi' ? 'Tải lên' : 'Upload'}</span>
                          </button>
                        </div>

                        {sec.audioUrl && sec.audioUrl.trim() !== '' && (
                          <div className="flex items-center justify-between gap-2 pt-1">
                            {!sec.audioUrl.startsWith('localcache:') ? (
                              <audio id={`audio-preview-${sIdx}`} src={sec.audioUrl} className="hidden" />
                            ) : null}
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={sec.audioUrl.startsWith('localcache:')}
                                onClick={() => {
                                  if (sec.audioUrl.startsWith('localcache:')) return;
                                  const audioEl: any = document.getElementById(`audio-preview-${sIdx}`);
                                  if (audioEl) {
                                    if (audioPlayState[sec.audioUrl]) {
                                      audioEl.pause();
                                      setAudioPlayState(prev => ({ ...prev, [sec.audioUrl]: false }));
                                    } else {
                                      audioEl.play().catch((err: any) => console.log(err));
                                      setAudioPlayState(prev => ({ ...prev, [sec.audioUrl]: true }));
                                    }
                                  }
                                }}
                                className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                                  sec.audioUrl.startsWith('localcache:')
                                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                    : 'bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30'
                                }`}
                              >
                                {audioPlayState[sec.audioUrl] ? <Pause size={10} /> : <Play size={10} />}
                                <span>
                                  {sec.audioUrl.startsWith('localcache:')
                                    ? (language === 'vi' ? 'Đang tải...' : 'Loading...')
                                    : audioPlayState[sec.audioUrl]
                                      ? (language === 'vi' ? 'Dừng thử' : 'Pause')
                                      : (language === 'vi' ? 'Nghe thử' : 'Preview')
                                  }
                                </span>
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmDialog({
                                  titleVi: 'Xác nhận xóa file nghe',
                                  titleEn: 'Confirm Audio Deletion',
                                  messageVi: 'Bạn có chắc chắn muốn xóa file nghe này?',
                                  messageEn: 'Are you sure you want to delete this audio file?',
                                  onConfirm: () => {
                                    const newSections = [...examData.sections];
                                    newSections[sIdx].audioUrl = '';
                                    setExamData({ ...examData, sections: newSections });
                                    setConfirmDialog(null);
                                  }
                                });
                              }}
                              className="text-[10px] text-red-400 hover:text-red-300 font-bold flex items-center gap-0.5 cursor-pointer"
                            >
                              <Trash2 size={10} />
                              <span>{language === 'vi' ? 'Xóa' : 'Remove'}</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Image Attachment */}
                      <div className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-850">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black uppercase text-indigo-400 flex items-center gap-1.5">
                            <Image size={12} />
                            {language === 'vi' ? 'Hình Ảnh Sơ Đồ/Biểu Đồ' : 'Diagram/Image Attachment'}
                          </label>
                          {sec.imageUrl && (
                            <span className="text-[9px] bg-emerald-500/15 text-emerald-400 font-bold px-2 py-0.5 rounded-full font-mono uppercase">
                              Active
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={sec.imageUrl || ''}
                            onChange={(e) => {
                              const newSections = [...examData.sections];
                              newSections[sIdx].imageUrl = e.target.value;
                              setExamData({ ...examData, sections: newSections });
                            }}
                            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 focus:outline-hidden focus:border-indigo-500"
                            placeholder="https://example.com/diagram.png"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = 'image/*';
                              input.onchange = (e: any) => {
                                const file = e.target?.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (evt: any) => {
                                    const base64 = evt.target.result;
                                    const newSections = [...examData.sections];
                                    newSections[sIdx].imageUrl = base64;
                                    setExamData({ ...examData, sections: newSections });
                                    showToast(language === 'vi' ? '✓ Tải lên hình ảnh thành công!' : '✓ Image uploaded successfully!');
                                  };
                                  reader.readAsDataURL(file);
                                }
                              };
                              input.click();
                            }}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all shrink-0 cursor-pointer"
                          >
                            <Upload size={12} />
                            <span>{language === 'vi' ? 'Tải lên' : 'Upload'}</span>
                          </button>
                        </div>

                        {sec.imageUrl && (
                          <div className="space-y-2 pt-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-500 font-mono">{language === 'vi' ? 'Xem trước hình ảnh:' : 'Image preview:'}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const newSections = [...examData.sections];
                                  newSections[sIdx].imageUrl = '';
                                  setExamData({ ...examData, sections: newSections });
                                }}
                                className="text-[10px] text-red-400 hover:text-red-300 font-bold flex items-center gap-0.5 cursor-pointer"
                              >
                                <Trash2 size={10} />
                                <span>{language === 'vi' ? 'Xóa' : 'Remove'}</span>
                              </button>
                            </div>
                            <div className="relative w-full max-h-[140px] rounded-lg overflow-hidden border border-slate-800 bg-slate-900 flex justify-center items-center p-2">
                              <img
                                src={sec.imageUrl}
                                alt="Section diagram preview"
                                className="max-h-[120px] w-auto object-contain rounded-md"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 2A. PASSAGE SUB-EDITOR (ONLY for Reading/Academic type) */}
                  {(examInfo.skill === 'reading' || sec.passages?.length > 0) && (
                    <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black tracking-wider text-slate-300 uppercase flex items-center gap-2">
                          <FileText size={14} className="text-indigo-400" />
                          {language === 'vi' ? 'NỘI DUNG BÀI ĐỌC (PASSAGE)' : 'READING PASSAGE CONTENT'}
                        </span>
                        
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold font-mono bg-slate-950 px-2.5 py-1 rounded-lg">
                          <span>{countWords(sec.passages?.[0]?.content)} words</span>
                        </div>
                      </div>

                      {/* Title of Passage */}
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase text-slate-500">Passage Title</label>
                        <input
                          type="text"
                          value={sec.passages?.[0]?.title || ''}
                          onChange={(e) => {
                            const newSections = [...examData.sections];
                            if (!newSections[sIdx].passages[0]) {
                              newSections[sIdx].passages.push({ title: '', content: '' });
                            }
                            newSections[sIdx].passages[0].title = e.target.value;
                            setExamData({ ...examData, sections: newSections });
                          }}
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs font-black text-slate-200 focus:outline-hidden focus:border-indigo-500"
                          placeholder="E.g., The Rise of Artificial Intelligence"
                        />
                      </div>

                      {/* Content rich text area */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-850 max-w-fit">
                          <button 
                            type="button" 
                            title="Bold Help" 
                            className="px-2 py-1 hover:bg-slate-800 rounded-md text-[10px] font-extrabold font-mono"
                            onClick={() => {
                              const textarea: any = document.getElementById(`psg-content-${sIdx}`);
                              if (textarea) {
                                const start = textarea.selectionStart;
                                const end = textarea.selectionEnd;
                                const val = textarea.value;
                                const selected = val.substring(start, end);
                                const replacement = `**${selected || 'bold text'}**`;
                                const newVal = val.substring(0, start) + replacement + val.substring(end);
                                const newSections = [...examData.sections];
                                newSections[sIdx].passages[0].content = newVal;
                                setExamData({ ...examData, sections: newSections });
                              }
                            }}
                          >
                            B
                          </button>
                          <button 
                            type="button" 
                            title="Italic Help" 
                            className="px-2 py-1 hover:bg-slate-800 rounded-md text-[10px] font-extrabold font-mono italic"
                            onClick={() => {
                              const textarea: any = document.getElementById(`psg-content-${sIdx}`);
                              if (textarea) {
                                const start = textarea.selectionStart;
                                const end = textarea.selectionEnd;
                                const val = textarea.value;
                                const selected = val.substring(start, end);
                                const replacement = `*${selected || 'italic text'}*`;
                                const newVal = val.substring(0, start) + replacement + val.substring(end);
                                const newSections = [...examData.sections];
                                newSections[sIdx].passages[0].content = newVal;
                                setExamData({ ...examData, sections: newSections });
                              }
                            }}
                          >
                            I
                          </button>
                        </div>
                        <textarea
                          id={`psg-content-${sIdx}`}
                          rows={12}
                          value={sec.passages?.[0]?.content || ''}
                          onChange={(e) => {
                            const newSections = [...examData.sections];
                            if (!newSections[sIdx].passages[0]) {
                              newSections[sIdx].passages.push({ title: 'Untitled Passage', content: '', translation: '', vocabulary: '' });
                            }
                            newSections[sIdx].passages[0].content = e.target.value;
                            setExamData({ ...examData, sections: newSections });
                          }}
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl p-4 text-xs font-medium leading-relaxed text-slate-300 focus:outline-hidden focus:border-indigo-500 custom-scrollbar resize-y animate-fade-in"
                          placeholder="Dán nội dung đoạn văn bài đọc tại đây..."
                        />
                      </div>

                      {/* Passage Translation */}
                      <div className="space-y-1.5 pt-1">
                        <label className="text-[9px] font-black uppercase text-slate-500">
                          {language === 'vi' ? 'Bản dịch Tiếng Việt (Bài đọc)' : 'Vietnamese Translation (Passage)'}
                        </label>
                        <textarea
                          rows={4}
                          value={sec.passages?.[0]?.translation || ''}
                          onChange={(e) => {
                            const newSections = [...examData.sections];
                            if (!newSections[sIdx].passages[0]) {
                              newSections[sIdx].passages.push({ title: 'Untitled Passage', content: '', translation: '', vocabulary: '' });
                            }
                            newSections[sIdx].passages[0].translation = e.target.value;
                            setExamData({ ...examData, sections: newSections });
                          }}
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs font-medium leading-relaxed text-slate-300 focus:outline-hidden focus:border-indigo-500 custom-scrollbar resize-y"
                          placeholder={language === 'vi' ? "Nhập bản dịch tiếng Việt cho bài đọc này..." : "Enter Vietnamese translation for this passage..."}
                        />
                      </div>

                      {/* Passage Vocabulary */}
                      <div className="space-y-1.5 pt-1">
                        <label className="text-[9px] font-black uppercase text-slate-500">
                          {language === 'vi' ? 'Từ vựng cốt lõi' : 'Core Vocabulary'}
                        </label>
                        <textarea
                          rows={4}
                          value={sec.passages?.[0]?.vocabulary || ''}
                          onChange={(e) => {
                            const newSections = [...examData.sections];
                            if (!newSections[sIdx].passages[0]) {
                              newSections[sIdx].passages.push({ title: 'Untitled Passage', content: '', translation: '', vocabulary: '' });
                            }
                            newSections[sIdx].passages[0].vocabulary = e.target.value;
                            setExamData({ ...examData, sections: newSections });
                          }}
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs font-medium leading-relaxed text-slate-300 focus:outline-hidden focus:border-indigo-500 custom-scrollbar resize-y"
                          placeholder={language === 'vi' ? "Nhập từ vựng cốt lõi (ví dụ: - word: meaning)..." : "Enter core vocabulary (e.g., - word: meaning)..."}
                        />
                      </div>
                    </div>
                  )}

                  {/* 2B. TRANSCRIPT SUB-EDITOR (ONLY for Listening type) */}
                  {examInfo.skill === 'listening' && (
                    <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black tracking-wider text-slate-300 uppercase flex items-center gap-2">
                          <Volume2 size={14} className="text-indigo-400" />
                          {language === 'vi' ? 'BẢN GHI NGHE (TRANSCRIPT)' : 'LISTENING TRANSCRIPT'}
                        </span>
                        
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold font-mono bg-slate-950 px-2.5 py-1 rounded-lg">
                          <span>{countWords(sec.transcript || '')} words</span>
                        </div>
                      </div>

                      <textarea
                        rows={8}
                        value={sec.transcript || ''}
                        onChange={(e) => {
                          const newSections = [...examData.sections];
                          newSections[sIdx].transcript = e.target.value;
                          setExamData({ ...examData, sections: newSections });
                        }}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-4 text-xs font-mono leading-relaxed text-slate-300 focus:outline-hidden focus:border-indigo-500 custom-scrollbar resize-y"
                        placeholder="Nhập hoặc chỉnh sửa bản ghi âm transcript nghe tại đây..."
                      />

                      {/* Transcript Translation */}
                      <div className="space-y-1.5 pt-1">
                        <label className="text-[9px] font-black uppercase text-slate-500">
                          {language === 'vi' ? 'Bản dịch Tiếng Việt (Bản ghi nghe)' : 'Vietnamese Translation (Transcript)'}
                        </label>
                        <textarea
                          rows={4}
                          value={sec.translation || ''}
                          onChange={(e) => {
                            const newSections = [...examData.sections];
                            newSections[sIdx].translation = e.target.value;
                            setExamData({ ...examData, sections: newSections });
                          }}
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs font-medium leading-relaxed text-slate-300 focus:outline-hidden focus:border-indigo-500 custom-scrollbar resize-y"
                          placeholder={language === 'vi' ? "Nhập bản dịch tiếng Việt cho transcript nghe..." : "Enter translation for the transcript..."}
                        />
                      </div>

                      {/* Transcript Vocabulary */}
                      <div className="space-y-1.5 pt-1">
                        <label className="text-[9px] font-black uppercase text-slate-500">
                          {language === 'vi' ? 'Từ vựng quan trọng (Bản ghi nghe)' : 'Key Vocabulary (Transcript)'}
                        </label>
                        <textarea
                          rows={4}
                          value={sec.vocabulary || ''}
                          onChange={(e) => {
                            const newSections = [...examData.sections];
                            newSections[sIdx].vocabulary = e.target.value;
                            setExamData({ ...examData, sections: newSections });
                          }}
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs font-medium leading-relaxed text-slate-300 focus:outline-hidden focus:border-indigo-500 custom-scrollbar resize-y"
                          placeholder={language === 'vi' ? "Nhập từ vựng cốt lõi cho transcript..." : "Enter core vocabulary for the transcript..."}
                        />
                      </div>
                    </div>
                  )}

                  {/* 2C. QUESTION GROUPS COMPARTMENT */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black tracking-wider text-slate-300 uppercase">
                        {language === 'vi' ? 'NHÓM CÂU HỎI TRONG PHẦN' : 'QUESTION GROUPS IN SECTION'}
                      </span>
                      <button
                        onClick={() => handleAddQuestionGroup(sIdx)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer"
                      >
                        <Plus size={12} />
                        <span>{language === 'vi' ? 'Thêm Nhóm Câu Hỏi' : 'Add Question Group'}</span>
                      </button>
                    </div>

                    {sec.questionGroups?.length === 0 ? (
                      <div className="text-center py-10 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
                        <HelpCircle size={32} className="text-slate-600 mx-auto mb-2" />
                        <span className="block text-xs font-bold text-slate-400">{language === 'vi' ? 'Chưa có nhóm câu hỏi nào' : 'No question groups added.'}</span>
                        <p className="text-[10px] text-slate-500 mt-1">Nhấn nút bên phải để thêm nhóm câu hỏi đầu tiên!</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {sec.questionGroups.map((grp: any, gIdx: number) => (
                          <div 
                            key={gIdx}
                            draggable
                            onDragStart={(e) => handleDragStart(e, 'group', sIdx, gIdx)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, 'group', sIdx, gIdx)}
                            className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xs"
                          >
                            {/* Group Header Controls */}
                            <div className="px-5 py-3.5 bg-slate-950/40 border-b border-slate-850 flex items-center justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-3">
                                {/* Range */}
                                <div className="space-y-1">
                                  <label className="text-[8px] font-black uppercase text-slate-500">Range</label>
                                  <input
                                    type="text"
                                    value={grp.range}
                                    onChange={(e) => {
                                      const newSections = [...examData.sections];
                                      newSections[sIdx].questionGroups[gIdx].range = e.target.value;
                                      setExamData({ ...examData, sections: newSections });
                                    }}
                                    className="bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-300 w-16 text-center font-mono focus:outline-hidden focus:border-indigo-500"
                                  />
                                </div>

                                {/* Type */}
                                <div className="space-y-1">
                                  <label className="text-[8px] font-black uppercase text-slate-500">Question Type</label>
                                  <select
                                    value={grp.type}
                                    onChange={(e) => {
                                      const newSections = [...examData.sections];
                                      newSections[sIdx].questionGroups[gIdx].type = e.target.value;
                                      setExamData({ ...examData, sections: newSections });
                                    }}
                                    className="bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg text-[10px] font-extrabold text-slate-300 focus:outline-hidden focus:border-indigo-500"
                                  >
                                    <option value="Sentence Completion">Sentence Completion</option>
                                    <option value="Multiple Choice">Multiple Choice</option>
                                    <option value="True/False/Not Given">True/False/Not Given</option>
                                    <option value="Matching Headings">Matching Headings</option>
                                    <option value="Map/Diagram Labelling">Map/Diagram Labelling</option>
                                    <option value="Short Answer">Short Answer</option>
                                  </select>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  disabled={gIdx === 0}
                                  onClick={(e) => { e.stopPropagation(); moveGroup(sIdx, gIdx, 'up'); }}
                                  className="p-1 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 disabled:opacity-30"
                                >
                                  <ArrowUp size={12} />
                                </button>
                                <button
                                  disabled={gIdx === sec.questionGroups.length - 1}
                                  onClick={(e) => { e.stopPropagation(); moveGroup(sIdx, gIdx, 'down'); }}
                                  className="p-1 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 disabled:opacity-30"
                                >
                                  <ArrowDown size={12} />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteQuestionGroup(sIdx, gIdx); }}
                                  className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>

                            {/* Group Instruction */}
                            <div className="p-5 border-b border-slate-850 space-y-1.5">
                              <label className="text-[9px] font-black uppercase text-slate-500">Group Instruction Text</label>
                              <input
                                type="text"
                                value={grp.instruction}
                                onChange={(e) => {
                                  const newSections = [...examData.sections];
                                  newSections[sIdx].questionGroups[gIdx].instruction = e.target.value;
                                  setExamData({ ...examData, sections: newSections });
                                }}
                                className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-200 focus:outline-hidden focus:border-indigo-500"
                                placeholder="E.g., Complete the travel reservation details."
                              />
                            </div>

                            {/* Nested Questions Board */}
                            <div className="p-5 bg-slate-950/20 space-y-4">
                              <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Questions List</span>
                                <button
                                  onClick={() => handleAddQuestion(sIdx, gIdx)}
                                  className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-lg text-[9px] font-bold uppercase transition-all cursor-pointer"
                                >
                                  <Plus size={10} />
                                  <span>Add Question</span>
                                </button>
                              </div>

                              {grp.questions?.length === 0 ? (
                                <p className="text-[10px] text-slate-500 font-bold py-3 text-center">No questions added in this group. Click 'Add Question' above!</p>
                              ) : (
                                <div className="space-y-4">
                                  {grp.questions.map((q: any, qIdx: number) => (
                                    <div 
                                      key={qIdx}
                                      draggable
                                      onDragStart={(e) => handleDragStart(e, 'question', sIdx, gIdx, qIdx)}
                                      onDragOver={handleDragOver}
                                      onDrop={(e) => handleDrop(e, 'question', sIdx, gIdx, qIdx)}
                                      className="bg-slate-950 border border-slate-850 p-4.5 rounded-xl space-y-3 relative group/q"
                                    >
                                      {/* Question Number and Main Content */}
                                      <div className="flex items-start gap-3">
                                        <div className="space-y-1">
                                          <label className="text-[8px] font-black text-slate-500 block uppercase">No.</label>
                                          <input
                                            type="number"
                                            value={q.number}
                                            onChange={(e) => {
                                              const newSections = [...examData.sections];
                                              newSections[sIdx].questionGroups[gIdx].questions[qIdx].number = Number(e.target.value);
                                              setExamData({ ...examData, sections: newSections });
                                            }}
                                            className="bg-slate-900 border border-slate-805 px-1 py-1 rounded text-center text-xs font-mono font-black text-slate-100 w-10 focus:outline-hidden focus:border-indigo-500"
                                          />
                                        </div>

                                        <div className="flex-1 space-y-1">
                                          <label className="text-[8px] font-black text-slate-500 block uppercase">Question Prompt / Gap text</label>
                                          <textarea
                                            rows={2}
                                            value={q.text}
                                            onChange={(e) => {
                                              const newSections = [...examData.sections];
                                              newSections[sIdx].questionGroups[gIdx].questions[qIdx].text = e.target.value;
                                              setExamData({ ...examData, sections: newSections });
                                            }}
                                            className="w-full bg-slate-900 border border-slate-805 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-200 focus:outline-hidden focus:border-indigo-500 resize-none"
                                          />
                                        </div>

                                        {/* Row reorder triggers */}
                                        <div className="flex items-center gap-1 opacity-0 group-hover/q:opacity-100 transition-opacity self-start mt-4 shrink-0">
                                          <button
                                            disabled={qIdx === 0}
                                            onClick={(e) => { e.stopPropagation(); moveQuestion(sIdx, gIdx, qIdx, 'up'); }}
                                            className="p-1 hover:bg-slate-800 rounded text-slate-500"
                                          >
                                            <ArrowUp size={11} />
                                          </button>
                                          <button
                                            disabled={qIdx === grp.questions.length - 1}
                                            onClick={(e) => { e.stopPropagation(); moveQuestion(sIdx, gIdx, qIdx, 'down'); }}
                                            className="p-1 hover:bg-slate-800 rounded text-slate-500"
                                          >
                                            <ArrowDown size={11} />
                                          </button>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteQuestion(sIdx, gIdx, qIdx); }}
                                            className="p-1 text-red-400 hover:bg-red-500/10 rounded"
                                          >
                                            <Trash2 size={11} />
                                          </button>
                                        </div>
                                      </div>

                                      {/* MCQ Choices Builder (Only displays/edits if MCQ is chosen or options already present) */}
                                      {grp.type === 'Multiple Choice' && (
                                        <div className="space-y-1.5 bg-slate-900/60 p-3 rounded-lg border border-slate-850">
                                          <label className="text-[8px] font-black text-slate-400 block uppercase">MCQ Choice List</label>
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {[0, 1, 2, 3].map((choiceIdx) => {
                                              const letter = ['A', 'B', 'C', 'D'][choiceIdx];
                                              const currentVal = q.options?.[choiceIdx] || `${letter}. `;
                                              return (
                                                <input
                                                  key={choiceIdx}
                                                  type="text"
                                                  value={currentVal}
                                                  onChange={(e) => {
                                                    const newSections = [...examData.sections];
                                                    const opts = [...(q.options || ['', '', '', ''])];
                                                    opts[choiceIdx] = e.target.value;
                                                    newSections[sIdx].questionGroups[gIdx].questions[qIdx].options = opts;
                                                    setExamData({ ...examData, sections: newSections });
                                                  }}
                                                  placeholder={`${letter}. Choice content`}
                                                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-1.5 text-[11px] text-slate-300 focus:outline-hidden focus:border-indigo-500"
                                                />
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}

                                      {/* Answer & Explanation Fields */}
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1.5">
                                        <div className="space-y-1">
                                          <div className="flex items-center justify-between">
                                            <label className="text-[8px] font-black text-slate-400 block uppercase">Correct Answer / Keys</label>
                                            {grp.type === 'Multiple Choice' && (
                                              <div className="flex items-center gap-1">
                                                {['A', 'B', 'C', 'D'].map(letter => (
                                                  <button
                                                    key={letter}
                                                    type="button"
                                                    onClick={() => {
                                                      const newSections = [...examData.sections];
                                                      newSections[sIdx].questionGroups[gIdx].questions[qIdx].answer = letter;
                                                      setExamData({ ...examData, sections: newSections });
                                                    }}
                                                    className={`px-1 rounded text-[8px] font-black border font-mono ${
                                                      q.answer === letter
                                                        ? 'bg-emerald-500 text-white border-emerald-400'
                                                        : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                                                    }`}
                                                  >
                                                    {letter}
                                                  </button>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                          <input
                                            type="text"
                                            value={q.answer || ''}
                                            onChange={(e) => {
                                              const newSections = [...examData.sections];
                                              newSections[sIdx].questionGroups[gIdx].questions[qIdx].answer = e.target.value;
                                              setExamData({ ...examData, sections: newSections });
                                            }}
                                            placeholder="Correct answer string..."
                                            className="w-full bg-slate-900 border border-slate-805 rounded-lg px-3 py-1.5 text-xs font-mono font-extrabold text-emerald-400 focus:outline-hidden focus:border-indigo-500"
                                          />
                                        </div>

                                        <div className="space-y-1">
                                          <label className="text-[8px] font-black text-slate-400 block uppercase">Explanation / Note</label>
                                          <input
                                            type="text"
                                            value={q.explanation || ''}
                                            onChange={(e) => {
                                              const newSections = [...examData.sections];
                                              newSections[sIdx].questionGroups[gIdx].questions[qIdx].explanation = e.target.value;
                                              setExamData({ ...examData, sections: newSections });
                                            }}
                                            placeholder="Brief text why this answer is selected..."
                                            className="w-full bg-slate-900 border border-slate-805 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-300 focus:outline-hidden focus:border-indigo-500"
                                          />
                                        </div>
                                      </div>

                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              );
            })()}

            {/* COMPARTMENT 3: VOCABULARY LIST BOARD */}
            {selectedNode.type === 'vocabulary' && (
              <div className="max-w-4xl space-y-6 animate-fade-in">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-xl font-black text-white">{language === 'vi' ? 'Sổ Tra Cứu Từ Vựng' : 'Vocabulary Book compiler'}</h2>
                    <p className="text-xs text-slate-400 mt-1">{language === 'vi' ? 'Sổ từ được công cụ phân tích tự động trích xuất giúp học viên tự học từ mới.' : 'Vocabulary automatically scraped by the Word .docx parsing engine.'}</p>
                  </div>
                  <button
                    onClick={handleAddVocabulary}
                    className="flex items-center gap-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>{language === 'vi' ? 'Thêm Từ Mới' : 'Add Term'}</span>
                  </button>
                </div>

                {(!examData?.vocabulary || examData.vocabulary.length === 0) ? (
                  <div className="text-center py-12 bg-slate-900/40 border border-slate-800 rounded-3xl">
                    <BookMarked size={40} className="text-slate-600 mx-auto mb-2" />
                    <span className="block text-xs font-bold text-slate-400">{language === 'vi' ? 'Chưa có từ vựng nào' : 'No vocab terms registered.'}</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {examData.vocabulary.map((voc: any, idx: number) => (
                      <div key={idx} className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl relative group space-y-3">
                        <button
                          onClick={() => handleDeleteVocabulary(idx)}
                          className="absolute right-3 top-3 p-1 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>

                        <div className="grid grid-cols-2 gap-3">
                          {/* Word */}
                          <div className="space-y-1">
                            <label className="text-[8px] font-black text-slate-500 uppercase block">Vocabulary Term</label>
                            <input
                              type="text"
                              value={voc.word}
                              onChange={(e) => {
                                const newVocab = [...examData.vocabulary];
                                newVocab[idx].word = e.target.value;
                                setExamData({ ...examData, vocabulary: newVocab });
                              }}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-black text-slate-200 focus:outline-hidden focus:border-indigo-500"
                            />
                          </div>

                          {/* IPA */}
                          <div className="space-y-1">
                            <label className="text-[8px] font-black text-slate-500 uppercase block">Phonetic IPA</label>
                            <input
                              type="text"
                              value={voc.ipa || ''}
                              onChange={(e) => {
                                const newVocab = [...examData.vocabulary];
                                newVocab[idx].ipa = e.target.value;
                                setExamData({ ...examData, vocabulary: newVocab });
                              }}
                              placeholder="/.../"
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-300 focus:outline-hidden focus:border-indigo-500"
                            />
                          </div>
                        </div>

                        {/* Meaning */}
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-500 uppercase block">Meaning / Definition</label>
                          <input
                            type="text"
                            value={voc.definition || ''}
                            onChange={(e) => {
                              const newVocab = [...examData.vocabulary];
                              newVocab[idx].definition = e.target.value;
                              setExamData({ ...examData, vocabulary: newVocab });
                            }}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-300 focus:outline-hidden focus:border-indigo-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          {/* Collocation */}
                          <div className="space-y-1">
                            <label className="text-[8px] font-black text-slate-500 uppercase block">Collocation</label>
                            <input
                              type="text"
                              value={voc.collocation || ''}
                              onChange={(e) => {
                                const newVocab = [...examData.vocabulary];
                                newVocab[idx].collocation = e.target.value;
                                setExamData({ ...examData, vocabulary: newVocab });
                              }}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 focus:outline-hidden focus:border-indigo-500"
                            />
                          </div>

                          {/* Example */}
                          <div className="space-y-1">
                            <label className="text-[8px] font-black text-slate-500 uppercase block">Example sentence</label>
                            <input
                              type="text"
                              value={voc.example || ''}
                              onChange={(e) => {
                                const newVocab = [...examData.vocabulary];
                                newVocab[idx].example = e.target.value;
                                setExamData({ ...examData, vocabulary: newVocab });
                              }}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 focus:outline-hidden focus:border-indigo-500"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* COMPARTMENT 4: ATTACHED MEDIA RECOVERY */}
            {selectedNode.type === 'media' && (
              <div className="max-w-4xl space-y-6 animate-fade-in">
                <div className="border-b border-slate-800 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black text-white">{language === 'vi' ? 'Quản Lý File Đề & Âm Thanh' : 'Attached Exam Files & Media'}</h2>
                    <p className="text-xs text-slate-400 mt-1">{language === 'vi' ? 'Xem các file Word, PDF, file nghe (.mp3) và sơ đồ ảnh phụ trợ được nạp từ Storage.' : 'Manage raw attachments including sound tracks, layouts, and transcript sheets.'}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleUploadNewAudio}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-indigo-600/15"
                    >
                      <Plus size={14} />
                      <span>{language === 'vi' ? 'Thêm File Nghe (.mp3)' : 'Add Audio File'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleUploadNewImage}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold border border-slate-700 transition-all cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>{language === 'vi' ? 'Thêm Sơ Đồ' : 'Add Diagram'}</span>
                    </button>
                  </div>
                </div>

                {mediaList.length === 0 ? (
                  <div className="text-center py-16 bg-slate-900/40 border border-slate-800 rounded-3xl">
                    <Globe size={48} className="text-slate-700 mx-auto mb-3" />
                    <span className="block text-sm font-bold text-slate-400">{language === 'vi' ? 'Chưa có tệp tin đính kèm nào' : 'No attachments found.'}</span>
                    <p className="text-xs text-slate-500 mt-1">{language === 'vi' ? 'Hãy thêm tệp tin nghe hoặc sơ đồ bằng cách bấm nút tải lên phía trên!' : 'Click the buttons above to upload audio or image files!'}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {mediaList.map((fileObj, fIdx) => {
                      const isAudio = fileObj.name.includes('Audio') || fileObj.name.toLowerCase().endsWith('.mp3') || fileObj.name.toLowerCase().endsWith('.wav') || fileObj.name.toLowerCase().endsWith('.m4a') || fileObj.url?.startsWith('data:audio');
                      const isImg = fileObj.name.includes('Image') || fileObj.name.toLowerCase().endsWith('.png') || fileObj.name.toLowerCase().endsWith('.jpg') || fileObj.name.toLowerCase().endsWith('.jpeg') || fileObj.url?.startsWith('data:image');
                      const isWord = fileObj.name.includes('Word') || fileObj.name.toLowerCase().endsWith('.docx');
                      const isPdf = fileObj.name.includes('PDF') || fileObj.name.toLowerCase().endsWith('.pdf');
                      
                      return (
                        <div key={fIdx} className="bg-slate-900 border border-slate-800/85 p-5 rounded-2xl flex flex-col justify-between gap-4 relative">
                          <div className="flex items-start gap-3.5">
                            {/* Visual file identifier */}
                            <div className={`p-3 rounded-xl shrink-0 ${
                              isAudio ? 'bg-indigo-500/10 text-indigo-400' :
                              isImg ? 'bg-emerald-500/10 text-emerald-400' :
                              isWord ? 'bg-blue-500/10 text-blue-400' : 
                              isPdf ? 'bg-red-500/10 text-red-400' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {isAudio ? <Music size={18} /> :
                               isImg ? <Image size={18} /> :
                               isWord ? <FileText size={18} /> : 
                               isPdf ? <FileText size={18} /> : <File size={18} />}
                            </div>

                            <div className="flex-1 min-w-0">
                              <span className="block text-xs font-black text-slate-200 truncate">{fileObj.name}</span>
                              <span className="block text-[9px] font-mono text-slate-400 mt-0.5 uppercase">
                                {fileObj.size ? `${(fileObj.size / 1024).toFixed(1)} KB` : 'Dynamic Storage URL'}
                              </span>
                            </div>
                          </div>

                          {/* Special Player block for Audio files */}
                          {isAudio && (
                            <div className="space-y-2 shrink-0">
                              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <button
                                    disabled={fileObj.url?.startsWith('localcache:')}
                                    onClick={() => togglePlayAudio(fileObj.url)}
                                    className={`w-7 h-7 rounded-full flex items-center justify-center text-white cursor-pointer ${
                                      fileObj.url?.startsWith('localcache:')
                                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                        : 'bg-indigo-600 hover:bg-indigo-500'
                                    }`}
                                  >
                                    {audioPlayState[fileObj.url] ? <Pause size={11} /> : <Play size={11} className="ml-0.5" />}
                                  </button>
                                  <span className="text-[10px] text-slate-400 font-mono font-bold">
                                    {fileObj.url?.startsWith('localcache:')
                                      ? (language === 'vi' ? 'Đang tải âm thanh...' : 'Loading audio...')
                                      : (language === 'vi' ? 'Nghe thử âm thanh' : 'Audio Test player')
                                    }
                                  </span>
                                </div>
                                
                                {fileObj.url && fileObj.url.trim() !== '' && !fileObj.url.startsWith('localcache:') && (
                                  <audio 
                                    ref={el => audioRefs.current[fileObj.url] = el}
                                    src={fileObj.url}
                                    onEnded={() => setAudioPlayState(prev => ({ ...prev, [fileObj.url]: false }))}
                                    className="hidden"
                                  />
                                )}
                              </div>

                              {/* Attach to section selector for Audio */}
                              {examData?.sections?.length > 0 && (
                                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850 space-y-1.5">
                                  <label className="text-[9px] font-black uppercase text-indigo-400 block">
                                    {language === 'vi' ? 'Gắn vào Section / Phần thi:' : 'Link to Exam Section:'}
                                  </label>
                                  <select
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === '') return;
                                      const sIndex = Number(val);
                                      
                                      // Update the section's audioUrl
                                      const newSections = [...examData.sections];
                                      newSections[sIndex].audioUrl = fileObj.url;
                                      setExamData({ ...examData, sections: newSections });
                                      showToast(
                                        language === 'vi' 
                                          ? `✓ Đã gắn file nghe vào ${newSections[sIndex].id}` 
                                          : `✓ Linked audio file to ${newSections[sIndex].id}`
                                      );
                                    }}
                                    value={
                                      examData.sections.findIndex((s: any) => s.audioUrl === fileObj.url) !== -1
                                        ? examData.sections.findIndex((s: any) => s.audioUrl === fileObj.url)
                                        : ''
                                    }
                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-300 focus:outline-hidden focus:border-indigo-500"
                                  >
                                    <option value="">{language === 'vi' ? '-- Chọn Section để gắn file nghe --' : '-- Choose Section to link --'}</option>
                                    {examData.sections.map((sec: any, sIdx: number) => (
                                      <option key={sIdx} value={sIdx}>
                                        {sec.id} ({sec.questionGroups?.reduce((acc: number, g: any) => acc + (g.questions?.length || 0), 0) || 0} Qs)
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Special Preview for Images */}
                          {isImg && fileObj.url && (
                            <div className="space-y-2 shrink-0">
                              <div className="w-full h-24 bg-slate-950 border border-slate-850 rounded-xl overflow-hidden flex items-center justify-center relative shadow-inner">
                                <img src={fileObj.url} alt="Attached Preview" className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" />
                              </div>

                              {/* Attach to section selector for Image */}
                              {examData?.sections?.length > 0 && (
                                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850 space-y-1.5">
                                  <label className="text-[9px] font-black uppercase text-emerald-400 block">
                                    {language === 'vi' ? 'Gắn sơ đồ vào Section / Phần thi:' : 'Link diagram to Exam Section:'}
                                  </label>
                                  <select
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === '') return;
                                      const sIndex = Number(val);
                                      
                                      // Update the section's imageUrl
                                      const newSections = [...examData.sections];
                                      newSections[sIndex].imageUrl = fileObj.url;
                                      setExamData({ ...examData, sections: newSections });
                                      showToast(
                                        language === 'vi' 
                                          ? `✓ Đã gắn sơ đồ vào ${newSections[sIndex].id}` 
                                          : `✓ Linked diagram to ${newSections[sIndex].id}`
                                      );
                                    }}
                                    value={
                                      examData.sections.findIndex((s: any) => s.imageUrl === fileObj.url) !== -1
                                        ? examData.sections.findIndex((s: any) => s.imageUrl === fileObj.url)
                                        : ''
                                    }
                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-300 focus:outline-hidden focus:border-emerald-500"
                                  >
                                    <option value="">{language === 'vi' ? '-- Chọn Section để gắn sơ đồ --' : '-- Choose Section to link --'}</option>
                                    {examData.sections.map((sec: any, sIdx: number) => (
                                      <option key={sIdx} value={sIdx}>
                                        {sec.id} ({sec.questionGroups?.reduce((acc: number, g: any) => acc + (g.questions?.length || 0), 0) || 0} Qs)
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Edit & Replace controls */}
                          <div className="flex items-center justify-between gap-2 border-t border-slate-850 pt-3">
                            <button
                              onClick={() => handleReplaceMediaFile(fileObj)}
                              className="flex items-center gap-1 text-[10px] font-extrabold text-slate-400 hover:text-white transition-colors cursor-pointer"
                            >
                              <RefreshCw size={11} />
                              <span>{language === 'vi' ? 'Thay thế file' : 'Replace file'}</span>
                            </button>

                            <div className="flex items-center gap-3">
                              {fileObj.url && !fileObj.url.startsWith('data:') && (
                                <a
                                  href={fileObj.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-1 text-[10px] font-extrabold text-indigo-400 hover:text-indigo-300 transition-colors"
                                >
                                  <ExternalLink size={11} />
                                  <span>{language === 'vi' ? 'Tải về' : 'Download'}</span>
                                </a>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmDialog({
                                    titleVi: 'Xác nhận xóa tệp tin',
                                    titleEn: 'Confirm File Deletion',
                                    messageVi: `Bạn có chắc chắn muốn xóa tập tin "${fileObj.name}"?`,
                                    messageEn: `Are you sure you want to delete the file "${fileObj.name}"?`,
                                    onConfirm: () => {
                                      setMediaList(prev => prev.filter((_, i) => i !== fIdx));
                                      setConfirmDialog(null);
                                      showToast(language === 'vi' ? '✓ Đã xóa tệp đính kèm' : '✓ Attachment deleted successfully');
                                    }
                                  });
                                }}
                                className="flex items-center gap-1 text-[10px] font-extrabold text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                              >
                                <Trash2 size={11} />
                                <span>{language === 'vi' ? 'Xóa' : 'Delete'}</span>
                              </button>
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* Custom Non-blocking Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden animate-fade-in">
          <div 
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity duration-300" 
            onClick={() => setConfirmDialog(null)}
          ></div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative z-10 overflow-hidden space-y-4 text-left">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2 bg-red-500/10 rounded-xl">
                <Trash2 size={20} />
              </div>
              <h3 className="text-sm font-black tracking-tight uppercase">
                {language === 'vi' ? confirmDialog.titleVi : confirmDialog.titleEn}
              </h3>
            </div>
            
            <p className="text-xs text-slate-300 leading-relaxed">
              {language === 'vi' ? confirmDialog.messageVi : confirmDialog.messageEn}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                {language === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-red-500/10 hover:shadow-red-500/20 active:scale-95"
              >
                <Trash2 size={12} />
                <span>{language === 'vi' ? 'Xác nhận' : 'Confirm'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Save Notification Modal (Centered Alert) */}
      {saveNotification && saveNotification.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity duration-300" onClick={() => setSaveNotification(null)}></div>
          <div className="bg-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative z-50 overflow-hidden border border-slate-800 flex flex-col items-center text-center space-y-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
              saveNotification.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {saveNotification.type === 'success' ? <CheckCircle2 size={32} /> : <AlertCircle size={32} />}
            </div>
            
            <div className="space-y-1">
              <h3 className="text-sm font-black tracking-tight text-white uppercase">
                {language === 'vi' ? 'Thông báo hệ thống' : 'System Notification'}
              </h3>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                {saveNotification.message}
              </p>
            </div>

            <button
              onClick={() => setSaveNotification(null)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black tracking-wide transition-all uppercase shadow-md active:scale-[0.98] cursor-pointer"
            >
              {language === 'vi' ? 'Xác nhận' : 'Confirm'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
