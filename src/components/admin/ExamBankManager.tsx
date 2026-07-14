import React, { useState, useEffect, useRef } from 'react';
import mammoth from 'mammoth';
import { parseIELTSDocumentText, getDefaultIELTSTemplateText } from '../../utils/docxParser';
import { 
  localFileCache, 
  isLargeBase64, 
  createCacheToken, 
  parseCacheToken,
  resolveExamBankItem,
  resolveFileUrl,
  offloadLargeBase64Fields
} from '../../utils/localFileCache';
import { 
  FileText, Music, Image, File, Trash2, Plus, Edit, Eye, Check, X, 
  Upload, Play, Pause, Search, Sparkles, BookOpen, AlertCircle, 
  Calendar, Clock, ArrowLeft, CheckCircle2, Sliders, EyeOff, ExternalLink
} from 'lucide-react';
import { db, storage } from '../../data/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';
import { ExamBankItem, ExamBankFile, ExamType } from '../../types';
import ExamEditor from './ExamEditor';

const sanitizeFileUrlAndCache = async (
  examId: string,
  fieldPath: string,
  url: string | undefined,
  fileName: string,
  fileSize: number,
  fileType: string
): Promise<string> => {
  if (!url) return '';
  if (isLargeBase64(url)) {
    const cacheKey = `exam_bank_${examId}_${fieldPath}`;
    await localFileCache.set(cacheKey, url);
    return createCacheToken(cacheKey, fileName, fileSize, fileType);
  }
  return url;
};

const sanitizeFileListAndCache = async (
  examId: string,
  fieldPath: string,
  files: ExamBankFile[] | undefined,
  fileType: string
): Promise<ExamBankFile[]> => {
  if (!files || !Array.isArray(files)) return [];
  const processedFiles: ExamBankFile[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const uniquePath = `${fieldPath}_${i}`;
    const sanitizedUrl = await sanitizeFileUrlAndCache(examId, uniquePath, f.url, f.name, f.size, fileType);
    processedFiles.push({
      ...f,
      url: sanitizedUrl
    });
  }
  return processedFiles;
};

interface ExamBankManagerProps {
  language: 'vi' | 'en';
}

export default function ExamBankManager({ language }: ExamBankManagerProps) {
  // Tabs & Filter states
  const [currentTab, setCurrentTab] = useState<ExamType>('listening');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'Easy' | 'Medium' | 'Hard'>('all');

  // Real-time exam items from Firestore
  const [examItems, setExamItems] = useState<ExamBankItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal / Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [currentEditingItem, setCurrentEditingItem] = useState<ExamBankItem | null>(null);
  const [currentPreviewItem, setCurrentPreviewItem] = useState<ExamBankItem | null>(null);
  const [editingExamWithEditor, setEditingExamWithEditor] = useState<ExamBankItem | null>(null);
  const [editorStartInPreview, setEditorStartInPreview] = useState(false);

  // Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDifficulty, setFormDifficulty] = useState('Medium');
  const [formTimeLimit, setFormTimeLimit] = useState(40);
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState<'draft' | 'published'>('draft');
  const [formSelectedSection, setFormSelectedSection] = useState<string>('all');
  const [formCoverImage, setFormCoverImage] = useState('');
  const [formShowCoverImage, setFormShowCoverImage] = useState(true);

  // File states for the Form
  const [uploadedWordUrl, setUploadedWordUrl] = useState<string>('');
  const [uploadedPdfUrl, setUploadedPdfUrl] = useState<string>('');
  const [uploadedAudios, setUploadedAudios] = useState<ExamBankFile[]>([]);
  const [uploadedImages, setUploadedImages] = useState<ExamBankFile[]>([]);

  // Full Test section states
  const [fullListeningWord, setFullListeningWord] = useState<string>('');
  const [fullListeningAudios, setFullListeningAudios] = useState<ExamBankFile[]>([]);
  const [fullListeningImages, setFullListeningImages] = useState<ExamBankFile[]>([]);

  const [fullReadingWord, setFullReadingWord] = useState<string>('');
  const [fullReadingImages, setFullReadingImages] = useState<ExamBankFile[]>([]);

  const [fullWritingWord, setFullWritingWord] = useState<string>('');
  const [fullWritingImages, setFullWritingImages] = useState<ExamBankFile[]>([]);

  const [fullSpeakingWord, setFullSpeakingWord] = useState<string>('');

  // Active upload slot configuration
  const [activeUploadSlot, setActiveUploadSlot] = useState<{
    type: 'word' | 'pdf' | 'audio' | 'image';
    section?: 'listening' | 'reading' | 'writing' | 'speaking';
  } | null>(null);

  // Real Word Doc Parser Dialog States
  const [isParseModalOpen, setIsParseModalOpen] = useState(false);
  const [parsingItem, setParsingItem] = useState<ExamBankItem | null>(null);
  const [parseProgress, setParseProgress] = useState(0);
  const [parseLogs, setParseLogs] = useState<string[]>([]);
  const [parseSteps, setParseSteps] = useState<Array<{ labelVi: string; labelEn: string; status: 'pending' | 'active' | 'completed' }>>([]);
  const [wordDocText, setWordDocText] = useState<string>('');
  const [parsedExamData, setParsedExamData] = useState<any | null>(null);
  const [parserError, setParserError] = useState<string | null>(null);
  const [parserErrorLine, setParserErrorLine] = useState<number | null>(null);
  const [isAnalyzingText, setIsAnalyzingText] = useState<boolean>(false);
  const [activeParseSection, setActiveParseSection] = useState<'listening' | 'reading' | 'writing' | 'speaking'>('listening');

  // Custom non-blocking modals and toast states
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Simulation upload list
  interface SimUpload {
    id: string;
    name: string;
    size: number;
    type: 'word' | 'pdf' | 'audio' | 'image';
    progress: number;
    status: 'uploading' | 'completed' | 'failed';
    url: string;
    section?: 'listening' | 'reading' | 'writing' | 'speaking';
    uploadedAt?: string;
  }
  const [simUploads, setSimUploads] = useState<SimUpload[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Real-time audio player state in preview
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [resolvedPreviewUrl, setResolvedPreviewUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Save Notification Modal State (Centered screen alert)
  const [saveNotification, setSaveNotification] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' } | null>(null);

  const showCenterNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setSaveNotification({ isOpen: true, message, type });
  };

  // Dynamically resolve preview audio URLs (handles cached file tokens)
  useEffect(() => {
    let active = true;
    const resolvePreview = async () => {
      if (!previewAudioUrl) {
        if (active) setResolvedPreviewUrl(null);
        return;
      }
      if (previewAudioUrl.startsWith('localcache:')) {
        try {
          const resolved = await resolveFileUrl(previewAudioUrl);
          if (active) setResolvedPreviewUrl(resolved);
        } catch (err) {
          console.error('Failed to resolve preview audio:', err);
          if (active) setResolvedPreviewUrl(null);
        }
      } else {
        if (active) setResolvedPreviewUrl(previewAudioUrl);
      }
    };
    resolvePreview();
    return () => {
      active = false;
    };
  }, [previewAudioUrl]);

  // Submenus / Skill Categories Config
  const skillsConfig = [
    { id: 'listening' as ExamType, label: language === 'vi' ? 'Listening' : 'Listening', icon: Music, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
    { id: 'reading' as ExamType, label: language === 'vi' ? 'Reading' : 'Reading', icon: FileText, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    { id: 'writing' as ExamType, label: language === 'vi' ? 'Writing' : 'Writing', icon: Edit, color: 'text-amber-600 bg-amber-50 border-amber-200' },
    { id: 'speaking' as ExamType, label: language === 'vi' ? 'Speaking' : 'Speaking', icon: Sparkles, color: 'text-rose-600 bg-rose-50 border-rose-200' },
    { id: 'full' as ExamType, label: language === 'vi' ? 'Full Test' : 'Full Test', icon: BookOpen, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  ];

  // Read data in real-time from Firestore 'exam_bank' collection
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'exam_bank'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: ExamBankItem[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const storage = data.storageFiles || {};
        items.push({
          id: doc.id,
          title: data.title || '',
          code: data.code || '',
          skill: data.skill || 'listening',
          difficulty: data.difficulty || 'Medium',
          timeLimit: data.timeLimit || 40,
          description: data.description || '',
          status: data.status || 'draft',
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
          wordFileUrl: storage.wordFileUrl || data.wordFileUrl || '',
          pdfFileUrl: storage.pdfFileUrl || data.pdfFileUrl || '',
          audioFiles: storage.audioFiles || data.audioFiles || [],
          imageFiles: storage.imageFiles || data.imageFiles || [],
          // New fields
          isParsed: data.isParsed ?? false,
          parseStatus: data.parseStatus || 'Not Parsed',
          parsedData: data.parsedData || null,
          storageFiles: data.storageFiles || null
        });
      });
      // Sort items by createdAt descending
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Load lightweight data immediately for responsive UI
      setExamItems(items);
      setLoading(false);

      // Asynchronously load and resolve huge base64 strings from IndexedDB
      Promise.all(items.map(item => resolveExamBankItem(item))).then((resolved) => {
        setExamItems(resolved);
      }).catch(err => {
        console.error("Error resolving cached files from IndexedDB:", err);
      });
    }, (error) => {
      console.error("Error loading exam_bank collection:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Handle preview audio controls
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying && resolvedPreviewUrl) {
        audioRef.current.play().catch(() => setIsPlaying(false));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, resolvedPreviewUrl]);

  // Clean audio player on unmount / preview item change
  useEffect(() => {
    setIsPlaying(false);
    setPreviewAudioUrl(null);
  }, [currentPreviewItem]);

  // Format bytes into readable format (e.g. 1.2 MB)
  const formatBytes = (bytes: number, decimals = 1) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Setup form for creating a new item
  const handleOpenCreateForm = () => {
    setCurrentEditingItem(null);
    setFormTitle('');
    setFormCode('');
    setFormDifficulty('Medium');
    setFormTimeLimit(currentTab === 'full' ? 180 : 40);
    setFormDescription('');
    setFormStatus('draft');
    setFormSelectedSection('all');
    setFormCoverImage('');
    setFormShowCoverImage(true);
    setUploadedWordUrl('');
    setUploadedPdfUrl('');
    setUploadedAudios([]);
    setUploadedImages([]);
    setSimUploads([]);

    // Clear Full Test section files
    setFullListeningWord('');
    setFullListeningAudios([]);
    setFullListeningImages([]);
    setFullReadingWord('');
    setFullReadingImages([]);
    setFullWritingWord('');
    setFullWritingImages([]);
    setFullSpeakingWord('');

    setIsFormOpen(true);
  };

  // Setup form for editing an existing item
  const handleOpenEditForm = (item: ExamBankItem) => {
    if (item.isParsed) {
      setEditingExamWithEditor(item);
      return;
    }
    setCurrentEditingItem(item);
    setFormTitle(item.title);
    setFormCode(item.code);
    setFormDifficulty(item.difficulty);
    setFormTimeLimit(item.timeLimit);
    setFormDescription(item.description || '');
    setFormStatus(item.status);
    setFormSelectedSection((item as any).selectedSection ? String((item as any).selectedSection) : 'all');
    setFormCoverImage((item as any).coverImage || '');
    setFormShowCoverImage((item as any).showCoverImage !== false);

    const storage = item.storageFiles || {};
    setUploadedWordUrl(storage.wordFileUrl || item.wordFileUrl || '');
    setUploadedPdfUrl(storage.pdfFileUrl || item.pdfFileUrl || '');
    setUploadedAudios(storage.audioFiles || item.audioFiles || []);
    setUploadedImages(storage.imageFiles || item.imageFiles || []);

    // Set Full Test section states
    const listening = storage.listening || {};
    setFullListeningWord(listening.wordFileUrl || '');
    setFullListeningAudios(listening.audioFiles || []);
    setFullListeningImages(listening.imageFiles || []);

    const reading = storage.reading || {};
    setFullReadingWord(reading.wordFileUrl || '');
    setFullReadingImages(reading.imageFiles || []);

    const writing = storage.writing || {};
    setFullWritingWord(writing.wordFileUrl || '');
    setFullWritingImages(writing.imageFiles || []);

    const speaking = storage.speaking || {};
    setFullSpeakingWord(speaking.wordFileUrl || '');

    setSimUploads([]);
    setIsFormOpen(true);
  };

  // Delete item from Firestore
  const handleDeleteItem = (id: string, title: string) => {
    setDeleteConfirmation({ id, title });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    const { id, title } = deleteConfirmation;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'exam_bank', id));
      showToast(
        language === 'vi' 
          ? `Đã xóa đề thi "${title}" thành công!` 
          : `Exam "${title}" deleted successfully!`,
        'success'
      );
    } catch (error) {
      console.error("Error deleting document:", error);
      showToast(
        language === 'vi' 
          ? `Có lỗi xảy ra khi xóa đề thi "${title}"!` 
          : `An error occurred while deleting the exam "${title}"!`,
        'error'
      );
    } finally {
      setIsDeleting(false);
      setDeleteConfirmation(null);
    }
  };

  // Upgraded real/hybrid file upload using Firebase Storage (with browser IndexedDB fallback)
  const processFileUpload = (file: File, fileType?: 'word' | 'pdf' | 'audio' | 'image', targetSection?: 'listening' | 'reading' | 'writing' | 'speaking') => {
    const fileId = Math.random().toString(36).substr(2, 9);
    const name = file.name;
    const size = file.size;
    const extension = name.split('.').pop()?.toLowerCase();
    const nowStr = new Date().toISOString();

    let resolvedType: 'word' | 'pdf' | 'audio' | 'image' = fileType || 'word';
    if (!fileType) {
      if (extension === 'docx' || extension === 'doc') resolvedType = 'word';
      else if (extension === 'pdf') resolvedType = 'pdf';
      else if (['mp3', 'wav', 'm4a', 'mp4'].includes(extension || '')) resolvedType = 'audio';
      else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension || '')) resolvedType = 'image';
      else {
        showCenterNotification(language === 'vi' ? 'Không hỗ trợ định dạng file này!' : 'File format not supported!', 'error');
        return;
      }
    }

    // Insert to active uploads list
    const newUpload: SimUpload = {
      id: fileId,
      name,
      size,
      type: resolvedType,
      progress: 0,
      status: 'uploading',
      url: '',
      section: targetSection,
      uploadedAt: nowStr
    };
    setSimUploads(prev => [...prev, newUpload]);

    // Update corresponding states with resolved file URL
    const updateStatesWithUrl = (targetUrl: string, fileObj: ExamBankFile & { type: string; uploadedAt: string; status: string }) => {
      if (currentTab === 'full' && targetSection) {
        if (targetSection === 'listening') {
          if (resolvedType === 'word') setFullListeningWord(targetUrl);
          else if (resolvedType === 'audio') setFullListeningAudios(prev => [...prev, fileObj]);
          else if (resolvedType === 'image') setFullListeningImages(prev => [...prev, fileObj]);
        } else if (targetSection === 'reading') {
          if (resolvedType === 'word') setFullReadingWord(targetUrl);
          else if (resolvedType === 'image') setFullReadingImages(prev => [...prev, fileObj]);
        } else if (targetSection === 'writing') {
          if (resolvedType === 'word') setFullWritingWord(targetUrl);
          else if (resolvedType === 'image') setFullWritingImages(prev => [...prev, fileObj]);
        } else if (targetSection === 'speaking') {
          if (resolvedType === 'word') setFullSpeakingWord(targetUrl);
        }
      } else {
        if (resolvedType === 'word') {
          setUploadedWordUrl(targetUrl);
        } else if (resolvedType === 'pdf') {
          setUploadedPdfUrl(targetUrl);
        } else if (resolvedType === 'audio') {
          setUploadedAudios(prev => [...prev, fileObj]);
        } else if (resolvedType === 'image') {
          setUploadedImages(prev => [...prev, fileObj]);
        }
      }
    };

    let fallbackTriggered = false;
    let timeoutId: any = null;

    // Fallback: Read file as Base64 Data URL and save to local IndexedDB
    const runLocalFallback = () => {
      if (fallbackTriggered) return;
      fallbackTriggered = true;
      if (timeoutId) clearTimeout(timeoutId);

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;

        // Animate simulated upload progress for friendly feedback
        let currentProg = 0;
        const interval = setInterval(() => {
          currentProg += Math.floor(Math.random() * 20) + 15;
          if (currentProg >= 100) {
            currentProg = 100;
            clearInterval(interval);
            
            // Mark uploader as completed
            setSimUploads(prev => prev.map(u => {
              if (u.id === fileId) {
                return { ...u, progress: 100, status: 'completed', url: dataUrl };
              }
              return u;
            }));

            const fileObj: ExamBankFile & { type: string; uploadedAt: string; status: string } = { 
              name, 
              size, 
              url: dataUrl,
              type: resolvedType,
              uploadedAt: nowStr,
              status: 'completed'
            };

            updateStatesWithUrl(dataUrl, fileObj);
          } else {
            setSimUploads(prev => prev.map(u => {
              if (u.id === fileId) {
                return { ...u, progress: currentProg };
              }
              return u;
            }));
          }
        }, 80);
      };

      reader.onerror = () => {
        setSimUploads(prev => prev.map(u => {
          if (u.id === fileId) {
            return { ...u, status: 'failed' };
          }
          return u;
        }));
      };

      reader.readAsDataURL(file);
    };

    // Primary: Attempt production Firebase Storage upload
    try {
      const filePath = `exam_bank/${Date.now()}_${name}`;
      const storageRef = ref(storage, filePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      // Timeout fallback: if no bytes are transferred or upload hangs for 1500ms, run fallback
      timeoutId = setTimeout(() => {
        if (!fallbackTriggered) {
          console.warn("Firebase Storage upload timed out at 0% progress, invoking local fallback.");
          try {
            uploadTask.cancel();
          } catch (cancelErr) {
            console.error("Error canceling upload task:", cancelErr);
          }
          runLocalFallback();
        }
      }, 1500);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          
          if (progress > 0 && !fallbackTriggered && timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }

          setSimUploads(prev => prev.map(u => {
            if (u.id === fileId) {
              return { ...u, progress: Math.min(progress, 99) }; // Keep at 99% until URL is fetched
            }
            return u;
          }));
        }, 
        (error) => {
          if (timeoutId) clearTimeout(timeoutId);
          console.warn("Firebase Storage upload not active/permitted, falling back to secure local base64/IndexedDB:", error);
          runLocalFallback();
        }, 
        async () => {
          if (timeoutId) clearTimeout(timeoutId);
          if (fallbackTriggered) return;
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            
            setSimUploads(prev => prev.map(u => {
              if (u.id === fileId) {
                return { ...u, progress: 100, status: 'completed', url: downloadUrl };
              }
              return u;
            }));

            const fileObj: ExamBankFile & { type: string; uploadedAt: string; status: string } = { 
              name, 
              size, 
              url: downloadUrl,
              type: resolvedType,
              uploadedAt: nowStr,
              status: 'completed'
            };

            updateStatesWithUrl(downloadUrl, fileObj);
          } catch (e) {
            console.error("Failed to get Firebase download URL, falling back:", e);
            runLocalFallback();
          }
        }
      );
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      console.warn("Could not initiate Firebase Storage, starting local fallback:", err);
      runLocalFallback();
    }
  };

  // Drag-and-drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      Array.from(e.dataTransfer.files).forEach(file => {
        if (activeUploadSlot) {
          processFileUpload(file as File, activeUploadSlot.type, activeUploadSlot.section);
        } else {
          processFileUpload(file as File);
        }
      });
    }
  };

  const handleFileSelectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach(file => {
        if (activeUploadSlot) {
          processFileUpload(file as File, activeUploadSlot.type, activeUploadSlot.section);
        } else {
          processFileUpload(file as File);
        }
      });
    }
    e.target.value = ''; // Reset uploader input
  };

  // Save/Edit document inside Firestore 'exam_bank' collection (Lưu bản nháp đề thi)
  const handleSaveExamItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formCode.trim()) {
      showCenterNotification(language === 'vi' ? 'Vui lòng điền đủ Tên đề và Mã đề!' : 'Please fill in Title and Code!', 'error');
      return;
    }

    try {
      const now = new Date().toISOString();
      const examId = currentEditingItem ? currentEditingItem.id : doc(collection(db, 'exam_bank')).id;

      // Sanitize top-level fields
      const sanitizedWordUrl = await sanitizeFileUrlAndCache(
        examId,
        'word',
        currentTab === 'full' ? '' : uploadedWordUrl,
        'Word_Doc.docx',
        uploadedWordUrl ? uploadedWordUrl.length : 0,
        'word'
      );
      
      const sanitizedPdfUrl = await sanitizeFileUrlAndCache(
        examId,
        'pdf',
        currentTab === 'full' ? '' : uploadedPdfUrl,
        'PDF_Doc.pdf',
        uploadedPdfUrl ? uploadedPdfUrl.length : 0,
        'pdf'
      );

      const sanitizedAudios = await sanitizeFileListAndCache(
        examId,
        'audio',
        currentTab === 'full' ? [] : uploadedAudios,
        'audio'
      );

      const sanitizedImages = await sanitizeFileListAndCache(
        examId,
        'image',
        currentTab === 'full' ? [] : uploadedImages,
        'image'
      );

      // Process listening section
      let processedListening = null;
      if (currentTab === 'full') {
        processedListening = {
          wordFileUrl: await sanitizeFileUrlAndCache(
            examId,
            'storage_listening_word',
            fullListeningWord,
            'Listening_Word.docx',
            fullListeningWord ? fullListeningWord.length : 0,
            'word'
          ),
          audioFiles: await sanitizeFileListAndCache(examId, 'storage_listening_audios', fullListeningAudios, 'audio'),
          imageFiles: await sanitizeFileListAndCache(examId, 'storage_listening_images', fullListeningImages, 'image'),
        };
      }

      // Process reading section
      let processedReading = null;
      if (currentTab === 'full') {
        processedReading = {
          wordFileUrl: await sanitizeFileUrlAndCache(
            examId,
            'storage_reading_word',
            fullReadingWord,
            'Reading_Word.docx',
            fullReadingWord ? fullReadingWord.length : 0,
            'word'
          ),
          imageFiles: await sanitizeFileListAndCache(examId, 'storage_reading_images', fullReadingImages, 'image'),
        };
      }

      // Process writing section
      let processedWriting = null;
      if (currentTab === 'full') {
        processedWriting = {
          wordFileUrl: await sanitizeFileUrlAndCache(
            examId,
            'storage_writing_word',
            fullWritingWord,
            'Writing_Word.docx',
            fullWritingWord ? fullWritingWord.length : 0,
            'word'
          ),
          imageFiles: await sanitizeFileListAndCache(examId, 'storage_writing_images', fullWritingImages, 'image'),
        };
      }

      // Process speaking section
      let processedSpeaking = null;
      if (currentTab === 'full') {
        processedSpeaking = {
          wordFileUrl: await sanitizeFileUrlAndCache(
            examId,
            'storage_speaking_word',
            fullSpeakingWord,
            'Speaking_Word.docx',
            fullSpeakingWord ? fullSpeakingWord.length : 0,
            'word'
          ),
        };
      }

      const storageFiles = {
        wordFileUrl: sanitizedWordUrl,
        pdfFileUrl: sanitizedPdfUrl,
        audioFiles: sanitizedAudios,
        imageFiles: sanitizedImages,
        listening: processedListening,
        reading: processedReading,
        writing: processedWriting,
        speaking: processedSpeaking
      };

      const payload = {
        title: formTitle,
        code: formCode,
        skill: currentTab,
        difficulty: formDifficulty,
        timeLimit: Number(formTimeLimit),
        description: formDescription,
        status: formStatus,
        updatedAt: now,
        selectedSection: formSelectedSection === 'all' ? 'all' : Number(formSelectedSection),
        coverImage: formCoverImage,
        showCoverImage: formShowCoverImage,
        
        // Root fields for backward compatibility
        wordFileUrl: sanitizedWordUrl,
        pdfFileUrl: sanitizedPdfUrl,
        audioFiles: sanitizedAudios,
        imageFiles: sanitizedImages,

        // Parsing state - Save Draft leaves it as Not Parsed
        isParsed: currentEditingItem ? (currentEditingItem.isParsed ?? false) : false,
        parseStatus: currentEditingItem ? (currentEditingItem.parseStatus ?? 'Not Parsed') : 'Not Parsed',
        storageFiles: storageFiles
      };

      if (currentEditingItem) {
        const docRef = doc(db, 'exam_bank', currentEditingItem.id);
        await updateDoc(docRef, payload);
        showCenterNotification(language === 'vi' ? 'Đã lưu bản nháp đề thi thành công!' : 'Exam draft updated successfully!', 'success');
      } else {
        const newPayload = {
          ...payload,
          createdAt: now,
        };
        await setDoc(doc(db, 'exam_bank', examId), newPayload);
        showCenterNotification(language === 'vi' ? 'Đã lưu bản nháp đề thi mới thành công!' : 'New exam draft saved successfully!', 'success');
      }

      setIsFormOpen(false);

      // Check if we should automatically parse the uploaded Word file or unparsed draft
      const isWordUploaded = currentTab === 'full'
        ? (fullListeningWord || fullReadingWord || fullWritingWord || fullSpeakingWord)
        : uploadedWordUrl;

      const hasUnparsedWord = currentEditingItem && !currentEditingItem.isParsed && 
        (currentEditingItem.wordFileUrl || (currentEditingItem.storageFiles && currentEditingItem.storageFiles.wordFileUrl));

      if (isWordUploaded || hasUnparsedWord) {
        const itemToParse: ExamBankItem = {
          id: examId,
          ...payload,
          createdAt: currentEditingItem ? (currentEditingItem.createdAt || now) : now
        };
        setTimeout(() => {
          handleStartParseFlow(itemToParse);
        }, 500);
      }
    } catch (error) {
      console.error("Error writing document to Firestore:", error);
      showCenterNotification(language === 'vi' ? 'Có lỗi xảy ra khi lưu đề thi!' : 'Error saving exam!', 'error');
    }
  };

  // Check required files based on Exam Type
  const getExamCompleteness = (item: ExamBankItem | null): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    if (!item) return { isValid: false, errors: ['No exam selected'] };

    const storage = item.storageFiles || {};
    const skill = item.skill;

    if (skill === 'listening') {
      const wordUrl = storage.wordFileUrl || item.wordFileUrl;
      const audios = storage.audioFiles || item.audioFiles || [];
      if (!wordUrl) {
        errors.push(language === 'vi' ? 'Thiếu file đề Word (.docx)' : 'Missing Word (.docx) exam file');
      }
      if (audios.length === 0) {
        errors.push(language === 'vi' ? 'Thiếu file âm thanh Audio (.mp3)' : 'Missing Audio (.mp3) file');
      }
    } else if (skill === 'reading') {
      const wordUrl = storage.wordFileUrl || item.wordFileUrl;
      if (!wordUrl) {
        errors.push(language === 'vi' ? 'Thiếu file đề Word (.docx)' : 'Missing Word (.docx) exam file');
      }
    } else if (skill === 'writing') {
      const wordUrl = storage.wordFileUrl || item.wordFileUrl;
      if (!wordUrl) {
        errors.push(language === 'vi' ? 'Thiếu file đề Word (.docx)' : 'Missing Word (.docx) exam file');
      }
    } else if (skill === 'speaking') {
      const wordUrl = storage.wordFileUrl || item.wordFileUrl;
      if (!wordUrl) {
        errors.push(language === 'vi' ? 'Thiếu file đề Word (.docx)' : 'Missing Word (.docx) exam file');
      }
    } else if (skill === 'full') {
      const listening = storage.listening || {};
      const reading = storage.reading || {};
      const writing = storage.writing || {};
      const speaking = storage.speaking || {};

      // Listening check
      if (!listening.wordFileUrl) {
        errors.push(language === 'vi' ? 'Phần Listening: Thiếu file Word (.docx)' : 'Listening section: Missing Word (.docx) file');
      }
      if (!listening.audioFiles || listening.audioFiles.length === 0) {
        errors.push(language === 'vi' ? 'Phần Listening: Thiếu file âm thanh Audio (.mp3)' : 'Listening section: Missing Audio (.mp3) file');
      }

      // Reading check
      if (!reading.wordFileUrl) {
        errors.push(language === 'vi' ? 'Phần Reading: Thiếu file Word (.docx)' : 'Reading section: Missing Word (.docx) file');
      }

      // Writing check
      if (!writing.wordFileUrl) {
        errors.push(language === 'vi' ? 'Phần Writing: Thiếu file Word (.docx)' : 'Writing section: Missing Word (.docx) file');
      }

      // Speaking check
      if (!speaking.wordFileUrl) {
        errors.push(language === 'vi' ? 'Phần Speaking: Thiếu file Word (.docx)' : 'Speaking section: Missing Word (.docx) file');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  };

  // Base64 to ArrayBuffer decoder and Mammoth text extractor
  const extractTextFromDataUrl = async (dataUrl: string): Promise<string> => {
    if (!dataUrl) return '';
    try {
      // First, resolve in case it is a localcache token
      const resolvedUrl = await resolveFileUrl(dataUrl);
      if (!resolvedUrl) return '';

      if (resolvedUrl.startsWith('data:')) {
        const base64Index = resolvedUrl.indexOf(';base64,');
        if (base64Index !== -1) {
          const base64 = resolvedUrl.slice(base64Index + 8);
          const binaryString = atob(base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const arrayBuffer = bytes.buffer;
          const result = await mammoth.extractRawText({ arrayBuffer });
          return result.value || '';
        }
      } else if (resolvedUrl.startsWith('http://') || resolvedUrl.startsWith('https://')) {
        const response = await fetch(resolvedUrl);
        const arrayBuffer = await response.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value || '';
      }
    } catch (err) {
      console.error('Error extracting text from docx:', err);
    }
    return '';
  };

  // Run core parser engine
  const runParseEngineOnText = (text: string, skillType: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setParseLogs(prev => [...prev, `[${timestamp}] Đang chạy parser và quét các nhãn cấu trúc...`]);
    
    const result = parseIELTSDocumentText(text);
    
    if (result.success && result.data) {
      setParsedExamData(result.data);
      setParserError(null);
      setParserErrorLine(null);
      setParseProgress(100);
      
      const totalQ = result.data.sections.reduce(
        (acc: number, s: any) => acc + (s.questionGroups?.reduce((accG: number, g: any) => accG + (g.questions?.length || 0), 0) || 0), 
        0
      );
      
      setParseLogs(prev => {
        const logs = [
          ...prev, 
          `[${new Date().toLocaleTimeString()}] ✓ PHÂN TÍCH THÀNH CÔNG!`,
          `[${new Date().toLocaleTimeString()}] - Tiêu đề nhận dạng: "${result.data?.info?.title || 'N/A'}"`,
          `[${new Date().toLocaleTimeString()}] - Mã đề: "${result.data?.info?.code || 'N/A'}"`,
          `[${new Date().toLocaleTimeString()}] - Số phần (Sections): ${result.data?.sections?.length || 0}`,
          `[${new Date().toLocaleTimeString()}] - Tổng số câu hỏi: ${totalQ}`,
          `[${new Date().toLocaleTimeString()}] - Từ vựng (Vocabulary): ${result.data?.vocabulary?.length || 0}`
        ];
        
        if (result.warnings && result.warnings.length > 0) {
          logs.push(`[${new Date().toLocaleTimeString()}] ⚠️ CẢNH BÁO PHÂN TÍCH CÚ PHÁP:`);
          result.warnings.forEach(w => {
            logs.push(`[${new Date().toLocaleTimeString()}]   • ${w}`);
          });
        }
        
        return logs;
      });
    } else {
      setParsedExamData(null);
      setParserError(result.error?.message || 'Lỗi phân tích không xác định');
      setParserErrorLine(result.error?.line || 1);
      setParseProgress(70);
      setParseLogs(prev => [
        ...prev, 
        `[${new Date().toLocaleTimeString()}] ❌ LỖI PHÂN TÍCH CÚ PHÁP TẠI DÒNG ${result.error?.line}:`,
        `[${new Date().toLocaleTimeString()}] Nội dung lỗi: "${result.error?.context}"`,
        `[${new Date().toLocaleTimeString()}] Chi tiết: ${result.error?.message}`
      ]);
    }
  };

  // Start the Real Word Parser flow
  const handleStartParseFlow = async (item: ExamBankItem, sectionType?: 'listening' | 'reading' | 'writing' | 'speaking') => {
    const activeSec = sectionType || (item.skill === 'full' ? 'listening' : undefined);
    if (activeSec) {
      setActiveParseSection(activeSec);
    }
    
    setParsingItem(item);
    setIsParseModalOpen(true);
    setIsAnalyzingText(true);
    setParseProgress(15);
    setParseLogs([`[${new Date().toLocaleTimeString()}] Khởi động máy chủ phân tích cú pháp cho đề: ${item.title}`]);

    let wordUrl = '';
    if (item.skill === 'full' && activeSec) {
      const storage = item.storageFiles || {};
      const secData = storage[activeSec] || {};
      wordUrl = secData.wordFileUrl || '';
    } else {
      wordUrl = item.wordFileUrl || (item.storageFiles && item.storageFiles.wordFileUrl) || '';
    }

    let text = '';
    if (wordUrl) {
      setParseLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Đang giải nén văn bản từ file Word (.docx) đính kèm...`]);
      setParseProgress(40);
      text = await extractTextFromDataUrl(wordUrl);
    }

    if (!text) {
      const skillName = activeSec || item.skill;
      setParseLogs(prev => [
        ...prev, 
        `[${new Date().toLocaleTimeString()}] Cảnh báo: Không thể nạp file Word tự động.`,
        `[${new Date().toLocaleTimeString()}] Đang khởi tạo mẫu đề thi chuẩn hóa IELTS cho kỹ năng: ${skillName.toUpperCase()}`
      ]);
      setParseProgress(60);
      text = getDefaultIELTSTemplateText(skillName, item.title, item.code);
    } else {
      setParseProgress(70);
      setParseLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✓ Đã tải và trích xuất thành công nội dung file Word!`]);
    }

    setWordDocText(text);
    setIsAnalyzingText(false);
    
    // Trigger initial run
    runParseEngineOnText(text, activeSec || item.skill);
  };

  // Handler for committing parsed data to database
  const handleSaveParsedJSON = async () => {
    if (!parsingItem || !parsedExamData) return;
    try {
      const docRef = doc(db, 'exam_bank', parsingItem.id);
      const parsedDataToSave = await offloadLargeBase64Fields(parsedExamData, `exam_bank_${parsingItem.id}_parsedData`, parsingItem.id);
      await updateDoc(docRef, {
        isParsed: true,
        parseStatus: 'Parsed',
        parsedData: parsedDataToSave,
        updatedAt: new Date().toISOString()
      });
      setIsParseModalOpen(false);
      
      // Transition directly to the Exam Editor instead of showing raw JSON
      const updatedItem: ExamBankItem = {
        ...parsingItem,
        isParsed: true,
        parseStatus: 'Parsed' as const,
        parsedData: parsedDataToSave as any
      };
      setEditingExamWithEditor(updatedItem);
    } catch (err) {
      console.error('Error saving parsed exam:', err);
      showCenterNotification(language === 'vi' ? 'Có lỗi xảy ra khi lưu đề thi!' : 'Error committing exam data!', 'error');
    }
  };

  // Helper to render a file slot for standard and Full Test types
  const renderFileSlot = (
    labelVi: string,
    labelEn: string,
    isRequired: boolean,
    accept: string,
    fileType: 'word' | 'pdf' | 'audio' | 'image',
    currentValue: string | ExamBankFile[],
    onDelete: () => void,
    section?: 'listening' | 'reading' | 'writing' | 'speaking'
  ) => {
    const isArray = Array.isArray(currentValue);
    const hasValue = isArray ? currentValue.length > 0 : !!currentValue;

    // Check if there is an active simulation upload for this slot
    const activeUpload = simUploads.find(u => u.type === fileType && u.section === section && u.status === 'uploading');

    return (
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5 shadow-2xs hover:shadow-xs transition-shadow">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-black text-slate-800 tracking-tight">{language === 'vi' ? labelVi : labelEn}</span>
            {isRequired ? (
              <span className="text-[8px] font-extrabold text-red-600 bg-red-50 border border-red-100 px-1 py-0.5 rounded uppercase">
                {language === 'vi' ? 'Bắt buộc' : 'Required'}
              </span>
            ) : (
              <span className="text-[8px] font-extrabold text-slate-400 bg-slate-100 border border-slate-250 px-1 py-0.5 rounded uppercase">
                {language === 'vi' ? 'Tùy chọn' : 'Optional'}
              </span>
            )}
          </div>
          <span className="text-[9px] font-mono font-black text-slate-400 uppercase tracking-widest">{fileType}</span>
        </div>

        {/* Existing file view */}
        {hasValue ? (
          <div className="space-y-1.5">
            {isArray ? (
              (currentValue as ExamBankFile[]).map((file, idx) => (
                <div key={idx} className="bg-white p-2.5 border border-slate-200 rounded-xl shadow-2xs flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 truncate">
                    {fileType === 'audio' ? <Music className="text-indigo-500 shrink-0" size={14} /> : <Image className="text-emerald-500 shrink-0" size={14} />}
                    <div className="truncate">
                      <p className="truncate font-bold text-slate-800 leading-none">{file.name}</p>
                      <p className="text-[9px] text-slate-400 font-mono font-bold mt-1">{formatBytes(file.size)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {fileType === 'audio' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (previewAudioUrl === file.url) {
                            setIsPlaying(!isPlaying);
                          } else {
                            setPreviewAudioUrl(file.url);
                            setIsPlaying(true);
                          }
                        }}
                        className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                          previewAudioUrl === file.url && isPlaying
                            ? 'bg-amber-50 border-amber-200 text-amber-600'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                        title={language === 'vi' ? 'Phát thử' : 'Preview audio'}
                      >
                        {previewAudioUrl === file.url && isPlaying ? <Pause size={12} /> : <Play size={12} />}
                      </button>
                    )}
                    {file.url && (
                      <a
                        href={file.url}
                        download={file.name}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 hover:text-slate-950 transition-all cursor-pointer"
                        title={language === 'vi' ? 'Tải xuống' : 'Download file'}
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const updated = (currentValue as ExamBankFile[]).filter((_, i) => i !== idx);
                        if (fileType === 'audio') {
                          if (section === 'listening') setFullListeningAudios(updated);
                          else setUploadedAudios(updated);
                        } else if (fileType === 'image') {
                          if (section === 'listening') setFullListeningImages(updated);
                          else if (section === 'reading') setFullReadingImages(updated);
                          else if (section === 'writing') setFullWritingImages(updated);
                          else setUploadedImages(updated);
                        }
                      }}
                      className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-100 rounded-lg text-red-600 hover:text-red-900 transition-all cursor-pointer"
                      title={language === 'vi' ? 'Xóa file' : 'Delete file'}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            ) : (() => {
              const meta = typeof currentValue === 'string' && currentValue.startsWith('localcache:') ? parseCacheToken(currentValue) : null;
              return (
                <div className="bg-white p-2.5 border border-slate-200 rounded-xl shadow-2xs flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 truncate">
                    {fileType === 'word' ? (
                      <FileText className="text-blue-500 shrink-0" size={14} />
                    ) : fileType === 'pdf' ? (
                      <File className="text-rose-500 shrink-0" size={14} />
                    ) : fileType === 'image' ? (
                      <Image className="text-emerald-500 shrink-0" size={14} />
                    ) : (
                      <Music className="text-indigo-500 shrink-0" size={14} />
                    )}
                    <div className="truncate">
                      <p className="truncate font-bold text-slate-800 leading-none">
                        {meta ? meta.fileName : (fileType === 'word' ? 'Word Document (.docx)' : fileType === 'pdf' ? 'PDF Document (.pdf)' : 'Media Asset')}
                      </p>
                      <p className="text-[9px] text-slate-400 font-bold mt-1">
                        {meta 
                          ? `${formatBytes(meta.fileSize)} • ${language === 'vi' ? 'Chỉ lưu cục bộ' : 'Stored locally'}` 
                          : (language === 'vi' ? 'Sẵn sàng lưu trữ' : 'Ready in draft storage')
                        }
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {typeof currentValue === 'string' && currentValue.startsWith('data:') && (
                      <a
                        href={currentValue}
                        download={meta ? meta.fileName : `exam_file.${fileType === 'word' ? 'docx' : fileType === 'pdf' ? 'pdf' : 'bin'}`}
                        className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
                        title={language === 'vi' ? 'Tải xuống' : 'Download file'}
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={onDelete}
                      className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-100 rounded-lg text-red-600 hover:text-red-900 transition-all cursor-pointer"
                      title={language === 'vi' ? 'Xóa file' : 'Delete file'}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : null}

        {/* Upload Slot Trigger */}
        {(!hasValue || fileType === 'audio' || fileType === 'image') && !activeUpload && (
          <div 
            onClick={() => {
              setActiveUploadSlot({ type: fileType, section });
              setTimeout(() => {
                if (fileInputRef.current) {
                  fileInputRef.current.click();
                }
              }, 50);
            }}
            className="border border-dashed border-slate-250 hover:border-blue-400 bg-white hover:bg-blue-50/10 p-2 text-center rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2 text-[11px] font-bold text-slate-500 hover:text-blue-600 active:scale-[0.99]"
          >
            <Upload size={12} />
            <span>
              {language === 'vi' 
                ? `Chọn file ${fileType.toUpperCase()}` 
                : `Select ${fileType.toUpperCase()}`
              }
            </span>
          </div>
        )}

        {/* Slot Progress feedback */}
        {activeUpload && (
          <div className="p-2.5 bg-white border border-blue-100 rounded-xl space-y-1.5 text-xs font-semibold">
            <div className="flex items-center justify-between">
              <span className="text-blue-600 font-extrabold flex items-center gap-1 text-[9px] uppercase">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping shrink-0" />
                {language === 'vi' ? 'Đang tải lên...' : 'Uploading...'}
              </span>
              <span className="font-mono font-bold text-slate-400 text-[9px]">{activeUpload.progress}%</span>
            </div>
            <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full transition-all duration-150" style={{ width: `${activeUpload.progress}%` }} />
            </div>
          </div>
        )}
      </div>
    );
  };

  // Filtering Logic
  const filteredItems = examItems.filter(item => {
    // 1. Filter by Skill (Tab)
    if (item.skill !== currentTab) return false;

    // 2. Filter by Search Query (Title or Code)
    const matchesSearch = 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    // 3. Filter by Status
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;

    // 4. Filter by Difficulty
    if (difficultyFilter !== 'all' && item.difficulty !== difficultyFilter) return false;

    return true;
  });

  if (editingExamWithEditor) {
    return (
      <ExamEditor
        item={editingExamWithEditor}
        language={language}
        initialPreviewMode={editorStartInPreview}
        onClose={() => {
          setEditingExamWithEditor(null);
          setEditorStartInPreview(false);
        }}
        onReParse={() => {
          const itemToParse = editingExamWithEditor;
          setEditingExamWithEditor(null);
          setEditorStartInPreview(false);
          handleStartParseFlow(itemToParse);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      
      {/* 1. Header with Description and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">📚</span>
            {language === 'vi' ? 'Quản Lý Kho Đề IELTS' : 'IELTS Exam Bank Management'}
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            {language === 'vi' 
              ? 'Hệ thống upload và phân phối đề thi chính thức của trung tâm. Quản lý bản dịch file đề Word (.docx), PDF, file nghe Audio (.mp3) và sơ đồ/hình ảnh bổ trợ trong đề.' 
              : 'Enterprise-grade exam uploader. Manage full test documents, listening tapes, layout diagrams, and official draft systems.'}
          </p>
        </div>
        <button
          onClick={handleOpenCreateForm}
          className="inline-flex items-center gap-1.5 px-4.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/10 transition-all cursor-pointer hover:scale-[1.02] duration-200"
        >
          <Plus size={15} />
          {language === 'vi' ? 'Upload đề mới' : 'Upload new exam'}
        </button>
      </div>

      {/* 2. Interactive Category/Skill Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {skillsConfig.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          const count = examItems.filter(item => item.skill === tab.id).length;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setCurrentTab(tab.id);
                setSearchQuery('');
              }}
              className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left cursor-pointer ${
                isActive 
                  ? 'bg-slate-900 border-slate-900 text-white shadow-md scale-[1.02]' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className={`p-2 rounded-xl transition-all ${isActive ? 'bg-slate-800 text-white' : tab.color}`}>
                  <Icon size={16} />
                </span>
                <span className="text-xs font-black tracking-tight">{tab.label}</span>
              </div>
              <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                isActive ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-500'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. Search and Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-3.5 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input 
            type="text" 
            placeholder={language === 'vi' ? 'Tìm kiếm theo tên đề, mã đề...' : 'Search by title, code...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-200 rounded text-slate-400"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-600">
            <Sliders size={13} className="text-slate-400" />
            <span>Trạng thái:</span>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-transparent border-none p-0 focus:ring-0 text-slate-800 font-extrabold text-xs cursor-pointer focus:outline-none"
            >
              <option value="all">Tất cả</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>

          {/* Difficulty Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-600">
            <Sliders size={13} className="text-slate-400" />
            <span>Độ khó:</span>
            <select 
              value={difficultyFilter} 
              onChange={(e) => setDifficultyFilter(e.target.value as any)}
              className="bg-transparent border-none p-0 focus:ring-0 text-slate-800 font-extrabold text-xs cursor-pointer focus:outline-none"
            >
              <option value="all">Tất cả</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Table view / Grid for lists */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs text-slate-500 font-semibold">{language === 'vi' ? 'Đang tải dữ liệu...' : 'Loading...'}</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <File size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">{language === 'vi' ? 'Không tìm thấy đề thi nào' : 'No exams found'}</p>
              <p className="text-[11px] text-slate-400 mt-1">
                {language === 'vi' ? 'Nhấn nút "Upload đề mới" ở góc trên bên phải để bắt đầu lưu trữ!' : 'Click "Upload new exam" to start saving!'}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">
                  <th className="px-6 py-3.5">{language === 'vi' ? 'Tên đề' : 'Title'}</th>
                  <th className="px-6 py-3.5">{language === 'vi' ? 'Mã đề' : 'Code'}</th>
                  <th className="px-6 py-3.5 text-center">{language === 'vi' ? 'Độ khó' : 'Difficulty'}</th>
                  <th className="px-6 py-3.5 text-center">{language === 'vi' ? 'Thời gian' : 'Time limit'}</th>
                  <th className="px-6 py-3.5">{language === 'vi' ? 'Ngày tạo' : 'Created Date'}</th>
                  <th className="px-6 py-3.5 text-center">{language === 'vi' ? 'Trạng thái' : 'Status'}</th>
                  <th className="px-6 py-3.5 text-right">{language === 'vi' ? 'Thao tác' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/40 transition-colors duration-150">
                    {/* Title & Badge File Indicators */}
                    <td className="px-6 py-4.5">
                      <div className="space-y-1.5 max-w-sm">
                        <span className="font-extrabold text-slate-800 block text-xs hover:text-blue-600 transition-colors cursor-pointer" onClick={() => { setCurrentPreviewItem(item); setIsPreviewOpen(true); }}>
                          {item.title}
                        </span>
                        
                        {/* File summary pills */}
                        <div className="flex flex-wrap gap-1.5">
                          {item.wordFileUrl && (
                            <span className="inline-flex items-center gap-1 text-[9px] bg-blue-50 text-blue-700 font-extrabold px-1.5 py-0.5 rounded border border-blue-100">
                              <FileText size={10} />
                              DOCX
                            </span>
                          )}
                          {item.pdfFileUrl && (
                            <span className="inline-flex items-center gap-1 text-[9px] bg-rose-50 text-rose-700 font-extrabold px-1.5 py-0.5 rounded border border-rose-100">
                              <File size={10} />
                              PDF
                            </span>
                          )}
                          {item.audioFiles && item.audioFiles.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[9px] bg-indigo-50 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded border border-indigo-100">
                              <Music size={10} />
                              Audio ({item.audioFiles.length})
                            </span>
                          )}
                          {item.imageFiles && item.imageFiles.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[9px] bg-emerald-50 text-emerald-700 font-extrabold px-1.5 py-0.5 rounded border border-emerald-100">
                              <Image size={10} />
                              Img ({item.imageFiles.length})
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Code */}
                    <td className="px-6 py-4.5">
                      <span className="font-mono font-bold bg-slate-100 border border-slate-200/50 px-2 py-1 rounded text-[11px] text-slate-700">
                        {item.code}
                      </span>
                    </td>

                    {/* Difficulty */}
                    <td className="px-6 py-4.5 text-center">
                      <span className={`inline-block font-extrabold text-[10px] uppercase px-2 py-0.5 rounded-full ${
                        item.difficulty === 'Easy' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                        item.difficulty === 'Medium' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                        'bg-red-50 text-red-700 border border-red-100'
                      }`}>
                        {item.difficulty}
                      </span>
                    </td>

                    {/* Duration */}
                    <td className="px-6 py-4.5 text-center font-mono font-bold text-slate-700">
                      {item.timeLimit} {language === 'vi' ? 'phút' : 'mins'}
                    </td>

                    {/* Created Date */}
                    <td className="px-6 py-4.5 text-slate-500 font-semibold text-[11px]">
                      {new Date(item.createdAt).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {
                        year: 'numeric', month: 'short', day: 'numeric'
                      })}
                    </td>

                    {/* Status badge */}
                    <td className="px-6 py-4.5 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        {item.status === 'published' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black bg-emerald-500 text-white px-2.5 py-0.5 rounded-full shadow-xs">
                            <CheckCircle2 size={9} />
                            PUBLISHED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black bg-slate-100 border border-slate-200 text-slate-500 px-2 py-0.5 rounded-full">
                            <EyeOff size={9} />
                            DRAFT
                          </span>
                        )}

                        {/* Parser engine status */}
                        {item.isParsed ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded">
                            <Sparkles size={9} />
                            PARSED
                          </span>
                        ) : item.parseStatus === 'Parsing' ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded animate-pulse">
                            <Clock size={9} />
                            PARSING...
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9px] font-extrabold bg-slate-50 text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded">
                            <File size={9} />
                            UNPARSED
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Action buttons */}
                    <td className="px-6 py-4.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setCurrentPreviewItem(item);
                            setIsPreviewOpen(true);
                          }}
                          title={language === 'vi' ? 'Xem trước tài liệu đề' : 'Preview documents'}
                          className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => {
                            setEditorStartInPreview(true);
                            setEditingExamWithEditor(item);
                          }}
                          title={language === 'vi' ? 'Xem giao diện học sinh' : 'Preview student view'}
                          className="p-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-lg text-indigo-600 hover:text-indigo-900 transition-colors cursor-pointer flex items-center justify-center"
                        >
                          <BookOpen size={13} />
                        </button>
                        <button
                          onClick={() => handleOpenEditForm(item)}
                          title={language === 'vi' ? 'Sửa đề thi' : 'Edit exam'}
                          className="p-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-lg text-blue-600 hover:text-blue-900 transition-colors cursor-pointer"
                        >
                          <Edit size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id, item.title)}
                          title={language === 'vi' ? 'Xóa đề' : 'Delete exam'}
                          className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-100 rounded-lg text-red-600 hover:text-red-900 transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                        
                        {/* Beautiful Sparkles Parse Exam action */}
                        <button
                          onClick={() => handleStartParseFlow(item)}
                          title={language === 'vi' ? 'Phân tích cấu trúc đề (Parse)' : 'Parse exam structure'}
                          className={`p-1.5 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                            item.isParsed
                              ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-600 hover:text-emerald-700'
                              : 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-600 hover:text-indigo-700'
                          }`}
                        >
                          <Sparkles size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* 5. SLIDE-OVER FORM MODAL: CREATE / EDIT */}
      {/* ==================================================== */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300"></div>

          <div className="absolute inset-y-0 right-0 max-w-full pl-10 flex">
            <div className="w-screen max-w-lg md:max-w-xl bg-white h-full flex flex-col shadow-2xl relative animate-slide-in">
              {/* Modal header */}
              <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                    {currentEditingItem 
                      ? (language === 'vi' ? '✏️ Cập nhật thông tin đề' : '✏️ Edit IELTS Exam') 
                      : (language === 'vi' ? '📤 Đăng tải đề thi mới' : '📤 Upload New Exam')}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-wider">
                    Phần thi: {currentTab.toUpperCase()}
                  </p>
                </div>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form content scrollbox */}
              <form onSubmit={handleSaveExamItem} className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Title */}
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">Tên đề thi *</label>
                  <input 
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Ví dụ: Cambridge 18 Test 1 Reading Passage 1"
                    className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>

                {/* Grid for Code, Difficulty & Time */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Code */}
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">Mã đề *</label>
                    <input 
                      type="text"
                      required
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value)}
                      placeholder="CAM18-T1-R1"
                      className="w-full px-3.5 py-2.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all uppercase"
                    />
                  </div>

                  {/* Difficulty */}
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">Độ khó</label>
                    <select
                      value={formDifficulty}
                      onChange={(e) => setFormDifficulty(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs font-bold bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all cursor-pointer"
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>

                  {/* Time Limit */}
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">Thời gian (Phút)</label>
                    <input 
                      type="number"
                      required
                      min={1}
                      value={formTimeLimit}
                      onChange={(e) => setFormTimeLimit(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 text-xs font-bold bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono"
                    />
                  </div>
                </div>

                {/* Selected Section/Passage/Task/Part based on current skill tab */}
                {currentTab !== 'full' && (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest">
                      {currentTab === 'listening' 
                        ? 'Phạm vi bài thi (Chọn Section)' 
                        : currentTab === 'reading'
                        ? 'Phạm vi bài thi (Chọn Passage)'
                        : currentTab === 'writing'
                        ? 'Phạm vi bài thi (Chọn Task)'
                        : 'Phạm vi bài thi (Chọn Part)'}
                    </label>
                    <select
                      value={formSelectedSection}
                      onChange={(e) => setFormSelectedSection(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs font-bold bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all cursor-pointer shadow-xs"
                    >
                      <option value="all">
                        {currentTab === 'listening' ? 'Cả đề thi (Gồm 4 Sections)' :
                         currentTab === 'reading' ? 'Cả đề thi (Gồm 3 Passages)' :
                         currentTab === 'writing' ? 'Cả đề thi (Gồm 2 Tasks)' :
                         'Cả đề thi (Gồm 3 Parts)'}
                      </option>
                      
                      {currentTab === 'listening' && [1, 2, 3, 4].map(num => (
                        <option key={num} value={String(num)}>Chỉ tạo Section {num}</option>
                      ))}
                      {currentTab === 'reading' && [1, 2, 3].map(num => (
                        <option key={num} value={String(num)}>Chỉ tạo Passage {num}</option>
                      ))}
                      {currentTab === 'writing' && [1, 2].map(num => (
                        <option key={num} value={String(num)}>Chỉ tạo Task {num}</option>
                      ))}
                      {currentTab === 'speaking' && [1, 2, 3].map(num => (
                        <option key={num} value={String(num)}>Chỉ tạo Part {num}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                      {language === 'vi' 
                        ? '* Lựa chọn này giúp hệ thống tự động chuẩn bị cấu trúc đề chỉ chứa riêng phần thi được chọn để tiết kiệm thời gian.'
                        : '* This allows you to generate a targeted exam containing only the selected section, saving preparation time.'}
                    </p>
                  </div>
                )}

                {/* Cover Image Selection */}
                <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-slate-800">Ảnh bìa đề thi (Cover Image)</h4>
                      <p className="text-[10px] text-slate-400">Hiển thị hình ảnh đẹp mắt cho đề thi trên trang của học sinh.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formShowCoverImage}
                        onChange={(e) => setFormShowCoverImage(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                      <span className="ml-2 text-[10px] font-bold text-slate-500">{formShowCoverImage ? 'Bật' : 'Tắt'}</span>
                    </label>
                  </div>

                  {formShowCoverImage && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Đường dẫn hình ảnh (URL)</label>
                        <input 
                          type="text"
                          value={formCoverImage}
                          onChange={(e) => setFormCoverImage(e.target.value)}
                          placeholder="https://images.unsplash.com/... hoặc chọn mẫu bên dưới"
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-500 outline-none font-mono"
                        />
                      </div>

                      {/* Presets Grid */}
                      <div className="space-y-1.5">
                        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Chọn ảnh mẫu có sẵn</label>
                        <div className="grid grid-cols-4 gap-2">
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
                              onClick={() => setFormCoverImage(p.url)}
                              className={`relative h-12 rounded-lg overflow-hidden border-2 transition-all group ${formCoverImage === p.url ? 'border-blue-600 scale-95 shadow-xs' : 'border-transparent hover:border-slate-300'}`}
                            >
                              <img src={p.url} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200" referrerPolicy="no-referrer" />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                <span className="text-[8px] text-white font-bold tracking-wider">{p.name}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">Mô tả hoặc Hướng dẫn</label>
                  <textarea 
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Ví dụ: Đề thi thật Listening tháng 06/2026. Độ khó tương đương đề thi chính thức..."
                    rows={2}
                    className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                  />
                </div>

                {/* Status Toggle (Draft vs Published) */}
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">Trạng thái công bố</label>
                  <div className="grid grid-cols-2 gap-3.5">
                    <button
                      type="button"
                      onClick={() => setFormStatus('draft')}
                      className={`flex items-center justify-center gap-2 py-2 px-3 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        formStatus === 'draft'
                          ? 'bg-slate-100 border-slate-300 text-slate-700 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      <EyeOff size={14} />
                      <span>Draft (Bản nháp)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormStatus('published')}
                      className={`flex items-center justify-center gap-2 py-2 px-3 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        formStatus === 'published'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      <CheckCircle2 size={14} />
                      <span>Published (Công bố)</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5 italic">
                    * Ở trạng thái Draft, học viên sẽ không nhìn thấy và không thể thi đề này.
                  </p>
                </div>

                {/* ========================================== */}
                {/* ADVANCED SLOT-BASED FILE UPLOADER SYSTEM */}
                {/* ========================================== */}
                <div className="border-t border-slate-100 pt-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      {language === 'vi' ? 'Quản lý tài liệu các tệp của đề' : 'Manage Exam Files & Assets'}
                    </label>
                    <span className="text-[9px] text-indigo-600 bg-indigo-50 font-black px-2 py-0.5 rounded border border-indigo-100">
                      Firebase Cloud Storage
                    </span>
                  </div>

                  {/* Hidden standard input for triggered uploads */}
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileSelectChange}
                    multiple
                    className="hidden" 
                    accept=".docx,.doc,.pdf,.mp3,.wav,.png,.jpg,.jpeg,.gif,.webp"
                  />

                  {currentTab === 'full' ? (
                    /* ========================================== */
                    /* FULL TEST - SECTION BY SECTION UPLOADER    */
                    /* ========================================== */
                    <div className="space-y-6">
                      {/* Section 1: Listening */}
                      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                          <span className="text-xs font-black text-slate-700 tracking-tight flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            Phần 1: Listening Files
                          </span>
                        </div>
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          {renderFileSlot(
                            'File Word Listening (.docx)', 'Listening Word File (.docx)', 
                            true, '.docx,.doc', 'word', fullListeningWord, 
                            () => setFullListeningWord(''), 'listening'
                          )}
                          {renderFileSlot(
                            'Tệp âm thanh Audio (.mp3)', 'Listening Audio tracks', 
                            true, '.mp3,.wav', 'audio', fullListeningAudios, 
                            () => setFullListeningAudios([]), 'listening'
                          )}
                          <div className="md:col-span-2">
                            {renderFileSlot(
                              'Hình ảnh minh họa sơ đồ Listening (nếu có)', 'Listening diagram images (optional)', 
                              false, '.png,.jpg,.jpeg,.webp', 'image', fullListeningImages, 
                              () => setFullListeningImages([]), 'listening'
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Reading */}
                      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                          <span className="text-xs font-black text-slate-700 tracking-tight flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Phần 2: Reading Files
                          </span>
                        </div>
                        <div className="p-4 grid grid-cols-1 gap-3.5">
                          {renderFileSlot(
                            'File Word Reading (.docx)', 'Reading Word File (.docx)', 
                            true, '.docx,.doc', 'word', fullReadingWord, 
                            () => setFullReadingWord(''), 'reading'
                          )}
                          {renderFileSlot(
                            'Hình ảnh minh họa các Passage Reading (nếu có)', 'Reading diagram/passage images (optional)', 
                            false, '.png,.jpg,.jpeg,.webp', 'image', fullReadingImages, 
                            () => setFullReadingImages([]), 'reading'
                          )}
                        </div>
                      </div>

                      {/* Section 3: Writing */}
                      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                          <span className="text-xs font-black text-slate-700 tracking-tight flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            Phần 3: Writing Files
                          </span>
                        </div>
                        <div className="p-4 grid grid-cols-1 gap-3.5">
                          {renderFileSlot(
                            'File Word Writing (.docx)', 'Writing Word File (.docx)', 
                            true, '.docx,.doc', 'word', fullWritingWord, 
                            () => setFullWritingWord(''), 'writing'
                          )}
                          {renderFileSlot(
                            'Hình ảnh Đề bài Task 1 (Chart, Map, Diagram)', 'Writing Task 1 Chart/Map image (optional)', 
                            false, '.png,.jpg,.jpeg,.webp', 'image', fullWritingImages, 
                            () => setFullWritingImages([]), 'writing'
                          )}
                        </div>
                      </div>

                      {/* Section 4: Speaking */}
                      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                          <span className="text-xs font-black text-slate-700 tracking-tight flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-purple-500" />
                            Phần 4: Speaking Files
                          </span>
                        </div>
                        <div className="p-4">
                          {renderFileSlot(
                            'File Word Speaking Part 1-3 (.docx)', 'Speaking Word File (.docx)', 
                            true, '.docx,.doc', 'word', fullSpeakingWord, 
                            () => setFullSpeakingWord(''), 'speaking'
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* ========================================== */
                    /* STANDARD EXAM TYPES - SINGLE SKILL FLOWS   */
                    /* ========================================== */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Word Slot */}
                      <div className="md:col-span-2">
                        {renderFileSlot(
                          'Tài liệu Word đề thi (.docx)', 'Exam Word Document (.docx)', 
                          true, '.docx,.doc', 'word', uploadedWordUrl, 
                          () => setUploadedWordUrl('')
                        )}
                      </div>

                      {/* Audio Slot (Only for Listening) */}
                      {currentTab === 'listening' && (
                        <div className="md:col-span-2">
                          {renderFileSlot(
                            'Tệp âm thanh Nghe Audio (.mp3)', 'Listening Audio tracks (.mp3)', 
                            true, '.mp3,.wav', 'audio', uploadedAudios, 
                            () => setUploadedAudios([])
                          )}
                        </div>
                      )}

                      {/* Image Slots (Listening, Reading, Writing) */}
                      {['listening', 'reading', 'writing'].includes(currentTab) && (
                        <div className="md:col-span-2">
                          {renderFileSlot(
                            currentTab === 'writing' ? 'Hình ảnh Đề bài Task 1 (Chart, Map, Diagram)' : 'Hình ảnh minh họa đề bài', 
                            currentTab === 'writing' ? 'Writing Task 1 Chart/Map Image' : 'Exam context images', 
                            false, '.png,.jpg,.jpeg,.webp', 'image', uploadedImages, 
                            () => setUploadedImages([])
                          )}
                        </div>
                      )}

                      {/* PDF Slot (Optional helper across all single exams) */}
                      <div className="md:col-span-2">
                        {renderFileSlot(
                          'File PDF đính kèm (Bản in/Tham khảo)', 'Attached PDF Booklet (optional)', 
                          false, '.pdf', 'pdf', uploadedPdfUrl, 
                          () => setUploadedPdfUrl('')
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </form>

              {/* Modal footer action row */}
              <div className="px-6 py-4.5 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-600 transition-all cursor-pointer"
                >
                  {language === 'vi' ? 'Hủy' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveExamItem}
                  className="px-4.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 transition-all cursor-pointer"
                >
                  {language === 'vi' ? 'Lưu đề thi' : 'Save Exam'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 6. MODAL PREVIEW FOR ADMIN */}
      {/* ==================================================== */}
      {isPreviewOpen && currentPreviewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300" onClick={() => setIsPreviewOpen(false)}></div>

          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl relative z-10 overflow-hidden animate-fade-in border border-slate-200">
            {/* Header */}
            <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <span className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-1.5">
                  <FileText size={16} className="text-blue-600" />
                  {language === 'vi' ? 'XEM TRƯỚC TỆP' : 'FILE PREVIEW'}
                </span>
                <span className="p-1 bg-slate-200 text-slate-700 rounded text-[10px] font-mono font-bold uppercase">
                  {currentPreviewItem.code}
                </span>
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                  currentPreviewItem.status === 'published' ? 'bg-emerald-500 text-white shadow-xs' : 'bg-slate-100 text-slate-500 border border-slate-200'
                }`}>
                  {currentPreviewItem.status}
                </span>
              </div>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Exam Title & Meta */}
              <div className="space-y-2">
                <h3 className="text-lg font-extrabold text-slate-900 tracking-tight leading-snug">
                  {currentPreviewItem.title}
                </h3>
                
                <div className="flex flex-wrap items-center gap-3.5 text-xs text-slate-500 font-semibold">
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} className="text-slate-400" />
                    <span>Thời lượng: <strong className="text-slate-700 font-bold">{currentPreviewItem.timeLimit} phút</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Sliders size={14} className="text-slate-400" />
                    <span>Độ khó: <strong className="text-slate-700 font-bold">{currentPreviewItem.difficulty}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar size={14} className="text-slate-400" />
                    <span>Đã tạo: <strong className="text-slate-700 font-bold">{new Date(currentPreviewItem.createdAt).toLocaleDateString()}</strong></span>
                  </div>
                </div>
              </div>

              {/* Description */}
              {currentPreviewItem.description && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider mb-1.5">Mô tả chi tiết</p>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">
                    {currentPreviewItem.description}
                  </p>
                </div>
              )}

              {/* Word Document (.docx) preview */}
              {currentPreviewItem.wordFileUrl && (
                <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 space-y-3">
                  <p className="text-[10px] text-blue-700 uppercase font-black tracking-wider flex items-center gap-1">
                    <FileText size={12} /> FILE WORD (.DOCX) ĐỀ BÀI
                  </p>
                  <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-blue-100 shadow-2xs">
                    <div className="flex items-center gap-2 truncate">
                      <div className="p-1.5 bg-blue-500 text-white rounded-lg">
                        <FileText size={16} />
                      </div>
                      <span className="text-xs font-bold text-slate-800 truncate">Document_Test_IELTS.docx</span>
                    </div>
                    <a 
                      href={currentPreviewItem.wordFileUrl} 
                      download="IELTS_Document.docx"
                      target="_blank"
                      referrerPolicy="no-referrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer shadow-xs transition-colors"
                    >
                      Tải về máy
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              )}

              {/* PDF file preview */}
              {currentPreviewItem.pdfFileUrl && (
                <div className="p-4 bg-rose-50/30 rounded-2xl border border-rose-100 space-y-3">
                  <p className="text-[10px] text-rose-700 uppercase font-black tracking-wider flex items-center gap-1">
                    <File size={12} /> FILE PDF ĐỀ THI ĐÍNH KÈM
                  </p>
                  
                  {/* Clean PDF embedding view */}
                  <div className="border border-rose-100/60 rounded-xl overflow-hidden shadow-2xs bg-slate-900">
                    <div className="p-2.5 bg-slate-850 border-b border-slate-750 flex items-center justify-between text-white text-[11px] font-bold">
                      <span className="flex items-center gap-1.5">
                        <File size={13} className="text-rose-400" />
                        Preview_PDF_IELTS_Test.pdf
                      </span>
                      <a 
                        href={currentPreviewItem.pdfFileUrl}
                        target="_blank"
                        referrerPolicy="no-referrer"
                        className="text-rose-400 hover:text-rose-300 flex items-center gap-1 hover:underline"
                      >
                        Mở tab mới
                        <ExternalLink size={12} />
                      </a>
                    </div>
                    
                    {/* Render elegant iframe PDF if data URL, or elegant fallback mock reader */}
                    <div className="h-64 flex flex-col items-center justify-center p-6 text-center text-slate-400">
                      <File size={40} className="text-rose-400 mb-2 animate-pulse" />
                      <p className="text-xs font-bold text-white">Tài liệu PDF Đề thi</p>
                      <p className="text-[10px] text-slate-400 max-w-sm mt-1 leading-relaxed">
                        Hệ thống đã mã hóa và bảo mật file đề PDF an toàn. Học viên chỉ có thể mở kiểm tra trong chế độ phòng thi.
                      </p>
                      <a 
                        href={currentPreviewItem.pdfFileUrl} 
                        target="_blank"
                        referrerPolicy="no-referrer"
                        className="mt-3.5 px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[10px] rounded-lg tracking-wide uppercase shadow-sm shadow-rose-500/20"
                      >
                        Đọc toàn bộ file PDF
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Custom Interactive Audio Player */}
              {currentPreviewItem.audioFiles && currentPreviewItem.audioFiles.length > 0 && (
                <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-3">
                  <p className="text-[10px] text-indigo-700 uppercase font-black tracking-wider flex items-center gap-1">
                    <Music size={12} /> BẢN GHI ÂM AUDIO (LISTENING TAPE)
                  </p>
                  
                  {currentPreviewItem.audioFiles.map((file, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-xl border border-indigo-100 shadow-2xs space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-slate-800 truncate max-w-[250px]">{file.name}</span>
                        <span className="font-mono font-bold text-slate-400 text-[10px]">{formatBytes(file.size)}</span>
                      </div>

                      {/* Custom Audio component controls */}
                      <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-150">
                        <button
                          type="button"
                          onClick={() => {
                            if (previewAudioUrl === file.url) {
                              setIsPlaying(!isPlaying);
                            } else {
                              setPreviewAudioUrl(file.url);
                              setIsPlaying(true);
                            }
                          }}
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm cursor-pointer transition-transform duration-150 active:scale-95 ${
                            previewAudioUrl === file.url && isPlaying ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700'
                          }`}
                        >
                          {previewAudioUrl === file.url && isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                        </button>
                        
                        <div className="flex-1">
                          <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Trình phát bài nghe</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] font-extrabold text-indigo-600">
                              {previewAudioUrl === file.url && isPlaying ? 'Audio is Playing...' : 'Ready to Stream'}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">MP3 / Stereo</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Hidden browser audio engine */}
                  {resolvedPreviewUrl && resolvedPreviewUrl.trim() !== '' && (
                    <audio 
                      ref={audioRef} 
                      src={resolvedPreviewUrl} 
                      onEnded={() => setIsPlaying(false)}
                      className="hidden" 
                    />
                  )}
                </div>
              )}

              {/* Graphic/Image Thumbnails Gallery */}
              {currentPreviewItem.imageFiles && currentPreviewItem.imageFiles.length > 0 && (
                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-3">
                  <p className="text-[10px] text-emerald-700 uppercase font-black tracking-wider flex items-center gap-1">
                    <Image size={12} /> BẢN ĐỒ / SƠ ĐỒ ĐỀ THI (DIAGRAM & LAYOUTS)
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    {currentPreviewItem.imageFiles.map((file, idx) => (
                      <div key={idx} className="bg-white p-2 border border-emerald-100 rounded-xl shadow-2xs group relative overflow-hidden">
                        <img 
                          src={file.url} 
                          alt={file.name} 
                          referrerPolicy="no-referrer"
                          className="w-full h-32 object-contain rounded-lg bg-slate-50 group-hover:scale-105 transition-all duration-300"
                        />
                        <div className="mt-1.5 text-[10px] text-slate-600 font-extrabold truncate">
                          {file.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="px-6 py-4.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <X size={14} />
                {language === 'vi' ? 'Đóng' : 'Close'}
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setIsPreviewOpen(false);
                    setEditorStartInPreview(true);
                    setEditingExamWithEditor(currentPreviewItem);
                  }}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-indigo-500/10"
                >
                  <BookOpen size={14} className="text-indigo-200" />
                  {language === 'vi' ? 'Xem giao diện học sinh' : 'Preview student view'}
                </button>

                <button
                  onClick={() => {
                    setIsPreviewOpen(false);
                    handleOpenEditForm(currentPreviewItem);
                  }}
                  className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Edit size={14} className="text-blue-500" />
                  {language === 'vi' ? 'Quay lại chỉnh sửa' : 'Back to Edit'}
                </button>

                <button
                  onClick={() => {
                    setIsPreviewOpen(false);
                    handleStartParseFlow(currentPreviewItem);
                  }}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-blue-500/10"
                >
                  <Sparkles size={14} className="text-blue-200" />
                  {language === 'vi' ? 'Parse đề thi' : 'Parse Exam'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 7. MODAL SIMULATED PARSE WORKFLOW */}
      {/* ==================================================== */}
      {/* ==================================================== */}
      {/* 7. MODAL SIMULATED PARSE WORKFLOW */}
      {/* ==================================================== */}
      {isParseModalOpen && parsingItem && (() => {
        // Dynamic checklist checker
        const isTagPresent = (tag: string) => {
          if (!parsedExamData) return false;
          switch (tag) {
            case 'THÔNG TIN ĐỀ':
              return !!parsedExamData.info?.title;
            case 'SECTION':
              return parsedExamData.sections?.length > 0;
            case 'PASSAGE':
              return parsedExamData.sections?.some((s: any) => s.passages?.length > 0);
            case 'QUESTION GROUP':
              return parsedExamData.sections?.some((s: any) => s.questionGroups?.length > 0);
            case 'QUESTION TYPE':
              return parsedExamData.sections?.some((s: any) => s.questionGroups?.some((g: any) => g.type));
            case 'QUESTION':
              return parsedExamData.sections?.some((s: any) => s.questionGroups?.some((g: any) => g.questions?.length > 0));
            case 'ANSWER':
              return parsedExamData.sections?.some((s: any) => s.questionGroups?.some((g: any) => g.questions?.some((q: any) => q.answer)));
            case 'TRANSCRIPT':
              return parsedExamData.sections?.some((s: any) => s.transcript && s.transcript.trim().length > 0);
            case 'VOCABULARY':
              return parsedExamData.vocabulary?.length > 0;
            default:
              return false;
          }
        };

        const totalQuestions = parsedExamData?.sections?.reduce(
          (acc: number, s: any) => acc + (s.questionGroups?.reduce((accG: number, g: any) => accG + (g.questions?.length || 0), 0) || 0), 
          0
        ) || 0;

        const handleLoadTemplate = () => {
          if (confirm(language === 'vi' ? 'Bạn có chắc chắn muốn tải lại file đề mẫu? Thao tác này sẽ ghi đè lên nội dung chỉnh sửa hiện tại.' : 'Are you sure you want to load the sample template? This will overwrite your current edits.')) {
            const text = getDefaultIELTSTemplateText(activeParseSection || parsingItem.skill, parsingItem.title, parsingItem.code);
            setWordDocText(text);
            runParseEngineOnText(text, activeParseSection || parsingItem.skill);
          }
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden animate-fade-in">
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md transition-opacity duration-300"></div>

            <div className="bg-slate-900 rounded-3xl max-w-7xl w-full h-[90vh] flex flex-col shadow-2xl relative z-10 overflow-hidden border border-slate-800 text-white">
              {/* Header */}
              <div className="px-6 py-4.5 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-950/40 shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${parserError ? 'bg-red-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
                  <div>
                    <h3 className="text-sm font-black tracking-wider text-slate-200 uppercase flex items-center gap-2">
                      <span>{language === 'vi' ? 'HỆ THỐNG PHÂN TÍCH VÀ BIÊN SOẠN ĐỀ IELTS' : 'IELTS REAL-TIME COMPILER & PARSER'}</span>
                      <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-mono border border-indigo-500/30">v1.2</span>
                    </h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      {parsingItem.title} ({parsingItem.code}) • <span className="uppercase font-bold text-slate-300">{activeParseSection || parsingItem.skill}</span>
                    </p>
                  </div>
                </div>

                {/* Section toggles for Full Test */}
                {parsingItem.skill === 'full' && (
                  <div className="flex items-center gap-1.5 p-1 bg-slate-950/60 rounded-xl border border-slate-800/80">
                    {(['listening', 'reading', 'writing', 'speaking'] as const).map(sec => (
                      <button
                        key={sec}
                        onClick={() => handleStartParseFlow(parsingItem, sec)}
                        className={`px-4 py-1.5 rounded-lg text-[11px] font-black tracking-wide transition-all capitalize cursor-pointer ${
                          activeParseSection === sec
                            ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                        }`}
                      >
                        {sec}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setIsParseModalOpen(false)}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer self-start md:self-auto"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Main Body Grid */}
              <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
                
                {/* Left Column: Editable Plain Text Area (60% width) */}
                <div className="lg:col-span-7 border-r border-slate-800 flex flex-col min-h-0 bg-slate-950/20">
                  <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-indigo-400" />
                      <span className="text-xs font-black tracking-wider uppercase text-slate-300">
                        {language === 'vi' ? 'Văn bản nguồn Word (.docx)' : 'Word Raw Plain Text (.docx)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleLoadTemplate}
                        className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-all cursor-pointer"
                        title={language === 'vi' ? 'Tải lại đề mẫu ban đầu' : 'Reload standard mock template'}
                      >
                        <Sparkles size={11} className="text-indigo-400 animate-pulse" />
                        <span>{language === 'vi' ? 'Tải File Mẫu' : 'Load Template'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 p-5 flex flex-col min-h-0">
                    <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
                      {language === 'vi' 
                        ? '💡 Nhập liệu hoặc chỉnh sửa trực tiếp nội dung dưới đây. Bộ phân tích sẽ quét các nhãn định dạng để tự động dịch sang cấu trúc JSON ở bảng bên phải.'
                        : '💡 Edit document raw content below. The compiler scans format headers to parse live JSON structured models.'}
                    </p>
                    
                    {isAnalyzingText ? (
                      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950/40 border border-slate-800 rounded-2xl">
                        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-3" />
                        <span className="text-xs text-slate-400 font-mono">Đang giải nén văn bản (.docx)...</span>
                      </div>
                    ) : (
                      <textarea
                        value={wordDocText}
                        onChange={(e) => {
                          setWordDocText(e.target.value);
                          runParseEngineOnText(e.target.value, activeParseSection || parsingItem.skill);
                        }}
                        placeholder="Nội dung file Word..."
                        spellCheck={false}
                        className="flex-1 w-full bg-slate-950 text-slate-200 font-mono text-[11px] leading-relaxed p-5 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-hidden rounded-2xl resize-none custom-scrollbar shadow-inner"
                      />
                    )}
                  </div>
                </div>

                {/* Right Column: AST Diagnostics & JSON tree (40% width) */}
                <div className="lg:col-span-5 flex flex-col min-h-0 bg-slate-950/10">
                  
                  {/* Visual Status Indicator */}
                  <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <Sliders size={14} className="text-emerald-400" />
                      <span className="text-xs font-black tracking-wider uppercase text-slate-300">
                        {language === 'vi' ? 'Chẩn đoán cú pháp & JSON' : 'Diagnostics & Compiler AST'}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-5 space-y-4.5 custom-scrollbar min-h-0">
                    
                    {/* Status Box */}
                    {parserError ? (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4.5 flex items-start gap-3.5 shadow-xs shadow-red-500/5">
                        <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
                        <div className="space-y-1">
                          <h4 className="text-xs font-black tracking-wide uppercase text-red-400">
                            {language === 'vi' ? 'LỖI PHÂN TÍCH CÚ PHÁP' : 'PARSING SYNTAX ERROR'}
                          </h4>
                          <p className="text-[11px] text-red-300 font-medium font-mono leading-relaxed">
                            {language === 'vi' ? `Dòng ${parserErrorLine}: ${parserError}` : `Line ${parserErrorLine}: ${parserError}`}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4.5 flex items-start gap-3.5 shadow-xs shadow-emerald-500/5">
                        <CheckCircle2 className="text-emerald-400 shrink-0 mt-0.5" size={18} />
                        <div className="space-y-1 flex-1">
                          <h4 className="text-xs font-black tracking-wide uppercase text-emerald-400">
                            {language === 'vi' ? 'CÚ PHÁP HỢP LỆ' : 'SYNTAX VERIFICATION PASSED'}
                          </h4>
                          <div className="grid grid-cols-3 gap-2 mt-2">
                            <div className="bg-slate-950/50 rounded-xl p-2 border border-slate-800/80 text-center">
                              <span className="block text-[9px] text-slate-400 font-mono tracking-wider uppercase">SECTIONS</span>
                              <span className="text-xs font-extrabold text-emerald-400 font-mono">{parsedExamData?.sections?.length || 0}</span>
                            </div>
                            <div className="bg-slate-950/50 rounded-xl p-2 border border-slate-800/80 text-center">
                              <span className="block text-[9px] text-slate-400 font-mono tracking-wider uppercase">QUESTIONS</span>
                              <span className="text-xs font-extrabold text-blue-400 font-mono">{totalQuestions}</span>
                            </div>
                            <div className="bg-slate-950/50 rounded-xl p-2 border border-slate-800/80 text-center">
                              <span className="block text-[9px] text-slate-400 font-mono tracking-wider uppercase">VOCABULARY</span>
                              <span className="text-xs font-extrabold text-purple-400 font-mono">{parsedExamData?.vocabulary?.length || 0}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Header Tags Checklist */}
                    <div className="bg-slate-950/40 border border-slate-800/60 rounded-2xl p-4.5 space-y-3">
                      <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">
                        {language === 'vi' ? 'DANH SÁCH NHÃN QUY ĐỊNH' : 'REQUIRED CLASSIFIERS'}
                      </span>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                        {[
                          { name: 'THÔNG TIN ĐỀ', req: true },
                          { name: 'SECTION', req: true },
                          { name: 'PASSAGE', req: parsingItem.skill === 'reading' || activeParseSection === 'reading' },
                          { name: 'QUESTION GROUP', req: true },
                          { name: 'QUESTION TYPE', req: true },
                          { name: 'QUESTION', req: true },
                          { name: 'ANSWER', req: true },
                          { name: 'TRANSCRIPT', req: parsingItem.skill === 'listening' || activeParseSection === 'listening' },
                          { name: 'VOCABULARY', req: false }
                        ].map((tagItem, index) => {
                          const present = isTagPresent(tagItem.name);
                          let statusLabel = '';
                          let statusStyle = '';
                          if (present) {
                            statusLabel = language === 'vi' ? 'ĐÃ NHẬN DIỆN' : 'DETECTED';
                            statusStyle = 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25';
                          } else if (tagItem.req) {
                            statusLabel = language === 'vi' ? 'BẮT BUỘC (THIẾU)' : 'REQUIRED (MISSING)';
                            statusStyle = 'bg-red-500/15 text-red-400 border border-red-500/25';
                          } else {
                            statusLabel = language === 'vi' ? 'TÙY CHỌN' : 'OPTIONAL';
                            statusStyle = 'bg-slate-800/30 text-slate-500 border border-slate-800';
                          }
                          return (
                            <div key={index} className="flex items-center justify-between text-[11px] font-mono">
                              <span className={`font-semibold ${tagItem.req ? 'text-slate-300' : 'text-slate-500'}`}>
                                {tagItem.name} {tagItem.req && <span className="text-red-400/80 text-[9px] font-serif">*</span>}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider ${statusStyle}`}>
                                {statusLabel}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Collapsible JSON Preview Tree */}
                    <div className="bg-slate-950/40 border border-slate-800/60 rounded-2xl p-4.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">
                          {language === 'vi' ? 'XEM TRƯỚC CẤU TRÚC JSON' : 'COMPILER SCHEMA (JSON)'}
                        </span>
                        <span className="text-[9px] text-indigo-400 font-mono font-extrabold uppercase">Read-only</span>
                      </div>
                      <div className="bg-black/90 rounded-xl p-3 border border-slate-800 max-h-[160px] overflow-y-auto font-mono text-[10px] text-indigo-300 leading-normal custom-scrollbar select-all whitespace-pre">
                        {parsedExamData ? JSON.stringify(parsedExamData, null, 2) : '// Chưa tạo được schema JSON do có lỗi cú pháp hoặc trống.'}
                      </div>
                    </div>

                    {/* Console Logger Term */}
                    <div className="bg-slate-950/40 border border-slate-800/60 rounded-2xl p-4.5 space-y-2">
                      <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">
                        {language === 'vi' ? 'Nhật ký máy chủ (Server Console)' : 'Server Console Output'}
                      </span>
                      <div className="bg-black/80 rounded-xl p-3 border border-slate-800/80 max-h-[120px] overflow-y-auto font-mono text-[10px] text-emerald-400/90 leading-relaxed custom-scrollbar whitespace-pre-wrap">
                        {parseLogs.map((log, idx) => (
                          <div key={idx} className="pb-0.5">{log}</div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="px-6 py-4.5 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-950/40 shrink-0">
                <span className="text-[10px] font-mono text-slate-500 font-bold leading-relaxed text-center sm:text-left">
                  {language === 'vi' 
                    ? '💡 Định dạng mẫu: Dòng bắt đầu bằng "SECTION 1", "QUESTION 1: ...", "ANSWER 1: ..."'
                    : '💡 Match headers precisely to generate compliant JSON files.'}
                </span>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsParseModalOpen(false)}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold border border-slate-700 transition-all cursor-pointer"
                  >
                    {language === 'vi' ? 'Hủy bỏ' : 'Cancel'}
                  </button>
                  <button
                    disabled={!!parserError || !parsedExamData}
                    onClick={handleSaveParsedJSON}
                    className={`px-6 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer ${
                      !parserError && parsedExamData
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/20 active:scale-95'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    }`}
                  >
                    <CheckCircle2 size={14} />
                    <span>{language === 'vi' ? 'Lưu & Đóng' : 'Save JSON'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 overflow-hidden animate-fade-in">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300" onClick={() => setDeleteConfirmation(null)}></div>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative z-50 overflow-hidden border border-slate-200 space-y-4 text-left">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2 bg-red-50 rounded-xl">
                <Trash2 size={20} />
              </div>
              <h3 className="text-sm font-black tracking-tight uppercase">
                {language === 'vi' ? 'XÁC NHẬN XÓA ĐỀ THI' : 'CONFIRM EXAM DELETION'}
              </h3>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed">
              {language === 'vi' 
                ? `Bạn có chắc chắn muốn xóa đề thi "${deleteConfirmation.title}" này khỏi hệ thống? Thao tác này không thể hoàn tác.`
                : `Are you sure you want to delete the exam "${deleteConfirmation.title}" from the system? This action cannot be undone.`}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                disabled={isDeleting}
                onClick={() => setDeleteConfirmation(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                {language === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button
                disabled={isDeleting}
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-red-500/10 hover:shadow-red-500/20 active:scale-95 disabled:opacity-50"
              >
                {isDeleting ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <Trash2 size={12} />
                )}
                <span>{language === 'vi' ? 'Xóa đề' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification Banner */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-55 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border animate-slide-in bg-white border-slate-200">
          <div className={`p-1.5 rounded-lg ${toast.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          </div>
          <span className="text-xs font-medium text-slate-700">{toast.message}</span>
        </div>
      )}

      {/* Custom Save Notification Modal (Centered Alert) */}
      {saveNotification && saveNotification.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300" onClick={() => setSaveNotification(null)}></div>
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl relative z-50 overflow-hidden border border-slate-200 flex flex-col items-center text-center space-y-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
              saveNotification.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-150' : 'bg-red-50 text-red-600 border border-red-150'
            }`}>
              {saveNotification.type === 'success' ? <CheckCircle2 size={32} /> : <AlertCircle size={32} />}
            </div>
            
            <div className="space-y-1">
              <h3 className="text-sm font-black tracking-tight text-slate-800 uppercase">
                {language === 'vi' ? 'Thông báo hệ thống' : 'System Notification'}
              </h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                {saveNotification.message}
              </p>
            </div>

            <button
              onClick={() => setSaveNotification(null)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black tracking-wide transition-all uppercase shadow-md hover:shadow-lg active:scale-[0.98] cursor-pointer"
            >
              {language === 'vi' ? 'Xác nhận' : 'Confirm'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
