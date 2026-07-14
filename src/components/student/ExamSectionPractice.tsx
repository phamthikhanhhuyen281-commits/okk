import React, { useState, useEffect, useRef } from 'react';
import { 
  Volume2, Play, Pause, Clock, AlertCircle, FileText, CheckCircle2, 
  ChevronLeft, Mic, ChevronRight, Star, Plus, Highlighter, HelpCircle, 
  BookOpen, Edit2, Bookmark, Globe, ArrowRight, ArrowLeft, CornerDownRight, ThumbsUp,
  Sparkles, Loader2, LayoutGrid, ChevronUp, ChevronDown
} from 'lucide-react';
import { Exam, VocabularyItem, HighlightItem, User } from '../../types';
import { cleanVocabularyWord } from '../../utils/docxParser';
import { resolveFileUrl } from '../../utils/localFileCache';

function CachedImage({ src, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [resolvedSrc, setResolvedSrc] = useState<string>('');

  useEffect(() => {
    let active = true;
    if (!src) {
      setResolvedSrc('');
      return;
    }
    if (src.startsWith('localcache:')) {
      resolveFileUrl(src).then(res => {
        if (active) setResolvedSrc(res);
      }).catch(err => {
        console.error(err);
        if (active) setResolvedSrc(src);
      });
    } else {
      setResolvedSrc(src);
    }
    return () => {
      active = false;
    };
  }, [src]);

  if (!resolvedSrc) return null;
  return <img src={resolvedSrc} {...props} />;
}

const isTFNGType = (type?: string, correctAnswer?: string, allQuestions?: any[]): boolean => {
  if (correctAnswer) {
    const ans = correctAnswer.trim().toUpperCase();
    if (ans === 'TRUE' || ans === 'FALSE') return true;
    if (ans === 'NOT GIVEN' || ans === 'NOTGIVEN') {
      if (allQuestions && allQuestions.length > 0) {
        const hasTrueOrFalse = allQuestions.some(otherQ => {
          const otherAns = (otherQ.correctAnswer || '').trim().toUpperCase();
          return otherAns === 'TRUE' || otherAns === 'FALSE';
        });
        if (hasTrueOrFalse) return true;
      }
    }
  }

  if (!type) return false;
  const t = type.toUpperCase().replace(/[\s\/\-_,\.]+/g, '');
  return (
    t.includes('TRUEFALSE') ||
    t.includes('TFNG') ||
    t.includes('TF') ||
    t.includes('ĐÚNGSAI') ||
    t.includes('DUNGSAI') ||
    t === 'TRUE' ||
    t === 'FALSE'
  );
};

const isYNNGType = (type?: string, correctAnswer?: string, allQuestions?: any[]): boolean => {
  if (correctAnswer) {
    const ans = correctAnswer.trim().toUpperCase();
    if (ans === 'YES' || ans === 'NO') return true;
    if (ans === 'NOT GIVEN' || ans === 'NOTGIVEN') {
      if (allQuestions && allQuestions.length > 0) {
        const hasYesOrNo = allQuestions.some(otherQ => {
          const otherAns = (otherQ.correctAnswer || '').trim().toUpperCase();
          return otherAns === 'YES' || otherAns === 'NO';
        });
        if (hasYesOrNo) return true;
      }
    }
  }

  if (!type) return false;
  const t = type.toUpperCase().replace(/[\s\/\-_,\.]+/g, '');
  return (
    t.includes('YESNO') ||
    t.includes('YNNG') ||
    t.includes('YN') ||
    t === 'YES' ||
    t === 'NO'
  );
};

const areAnswersMatching = (student: string, correct: string): boolean => {
  const s = student.trim().toUpperCase();
  const c = correct.trim().toUpperCase();
  if (s === c) return true;
  if (!s || !c) return false;
  
  // Flexible matching for TRUE/T, FALSE/F
  if ((s === 'TRUE' || s === 'T') && (c === 'TRUE' || c === 'T')) return true;
  if ((s === 'FALSE' || s === 'F') && (c === 'FALSE' || c === 'F')) return true;
  if ((s === 'NOT GIVEN' || s === 'NG') && (c === 'NOT GIVEN' || c === 'NG')) return true;
  if ((s === 'YES' || s === 'Y') && (c === 'YES' || c === 'Y')) return true;
  if ((s === 'NO' || s === 'N') && (c === 'NO' || c === 'N')) return true;
  
  return false;
};

interface QuestionGroup {
  id: string;
  type: string;
  rangeText: string;
  questions: Array<{
    number: number;
    questionType: string;
    questionText: string;
    options?: string[];
    correctAnswer: string;
    explanation?: string;
    questionInstruction?: string;
  }>;
}

const groupQuestions = (questions: any[]): QuestionGroup[] => {
  if (!questions || questions.length === 0) return [];
  const groups: QuestionGroup[] = [];
  let currentGroup: QuestionGroup | null = null;

  // Sort questions by question number to ensure sequence
  const sorted = [...questions].sort((a, b) => a.number - b.number);

  for (const q of sorted) {
    const qType = q.questionType || 'Sentence Completion';
    
    if (currentGroup && currentGroup.type === qType) {
      currentGroup.questions.push(q);
    } else {
      if (currentGroup) {
        const numbers = currentGroup.questions.map(x => x.number);
        const minNum = Math.min(...numbers);
        const maxNum = Math.max(...numbers);
        currentGroup.rangeText = minNum === maxNum ? `Q${minNum}` : `Q${minNum} - Q${maxNum}`;
        groups.push(currentGroup);
      }
      currentGroup = {
        id: `group-${qType}-${q.number}`,
        type: qType,
        rangeText: '',
        questions: [q]
      };
    }
  }

  if (currentGroup) {
    const numbers = currentGroup.questions.map(x => x.number);
    const minNum = Math.min(...numbers);
    const maxNum = Math.max(...numbers);
    currentGroup.rangeText = minNum === maxNum ? `Q${minNum}` : `Q${minNum} - Q${maxNum}`;
    groups.push(currentGroup);
  }

  return groups;
};

interface ExamSectionPracticeProps {
  exam: Exam & {
    sections?: Array<{
      sectionNumber: number;
      title?: string;
      audioUrl?: string;
      imageUrl?: string;
      transcript?: string;
      translation?: string;
      vocabulary?: string;
      questions?: Array<{
        number: number;
        questionType: string;
        questionText: string;
        options?: string[];
        correctAnswer: string;
      }>;
    }>;
    passages?: Array<{
      passageNumber: number;
      title: string;
      content: string;
      audioUrl?: string;
      imageUrl?: string;
      translation?: string;
      vocabulary?: string;
      questions?: Array<{
        number: number;
        questionType: string;
        questionText: string;
        options?: string[];
        correctAnswer: string;
      }>;
    }>;
    writingTask1?: { prompt: string; imageUrl?: string; audioUrl?: string; sampleAnswer?: string; translation?: string };
    writingTask2?: { prompt: string; imageUrl?: string; audioUrl?: string; sampleAnswer?: string; translation?: string };
    speakingPart1?: { topics: string[]; imageUrl?: string; audioUrl?: string; sampleAnswers?: string };
    speakingPart2?: { topic: string; imageUrl?: string; audioUrl?: string; sampleAnswers?: string };
    speakingPart3?: { topics: string[]; imageUrl?: string; audioUrl?: string; sampleAnswers?: string };
  };
  currentUser: User;
  onBack: () => void;
  onAddVocab: (vocab: Omit<VocabularyItem, 'id' | 'userId' | 'dateAdded'>) => Promise<void>;
  onAddHighlight: (highlight: Omit<HighlightItem, 'id' | 'userId' | 'createdAt'>) => Promise<void>;
  onDeleteHighlight: (id: string) => Promise<void>;
  highlightList: HighlightItem[];
  vocabList: VocabularyItem[];
  language: 'vi' | 'en';
  selectedSection?: number; // E.g., if practice Listening Section 1 only
  isFullTestMode?: boolean;
  onFullTestSectionComplete?: (answers: Record<string, string>, score: number, correctCount: number) => void;
}

interface TranscriptSentence {
  text: string;
  charStart: number;
  charEnd: number;
  startTime: number;
  endTime: number;
  pIdx: number;
  sIdx: number;
}

interface TranscriptParagraph {
  sentences: TranscriptSentence[];
}

const parseTranscript = (text: string, duration: number): TranscriptParagraph[] => {
  if (!text) return [];

  const lines = text.split('\n');
  const paragraphs: { sentences: any[] }[] = [];

  // Support [00:12], [0:12], (01:23), 01:23, [01:23.45], 01:23:45, etc.
  const timestampRegex = /(?:\[|\()?(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:\.\d{1,3})?(?:\]|\))?/g;

  let totalChars = 0;

  lines.forEach((pText, pIdx) => {
    const trimmed = pText.trim();
    if (!trimmed) {
      paragraphs.push({ sentences: [] });
      return;
    }

    const sentencesRaw = trimmed.match(/[^.!?\n]+(?:[.!?\n]+)?/g) || [trimmed];
    const paraSentences: any[] = [];

    sentencesRaw.forEach((sText) => {
      let cleanText = sText;
      let startTime: number | null = null;

      // Reset regex index before matching
      timestampRegex.lastIndex = 0;
      const tsMatches = [...sText.matchAll(timestampRegex)];
      if (tsMatches.length > 0) {
        const match = tsMatches[0];
        const fullMatchStr = match[0];
        
        const hrs = match[1] ? parseInt(match[1], 10) : 0;
        const mins = parseInt(match[2], 10);
        const secs = parseInt(match[3], 10);
        startTime = hrs * 3600 + mins * 60 + secs;

        cleanText = sText.replace(fullMatchStr, '').trim();
      }

      cleanText = cleanText.replace(/^\s*[-:–—]\s*/, '').trim();

      if (cleanText.length > 0) {
        paraSentences.push({
          text: cleanText,
          charStart: totalChars,
          charEnd: totalChars + cleanText.length,
          startTime,
          endTime: null,
          pIdx,
          sIdx: paraSentences.length,
          len: cleanText.length
        });
        totalChars += cleanText.length;
      }
    });

    paragraphs.push({ sentences: paraSentences });
  });

  const flatSentences: any[] = [];
  paragraphs.forEach(p => flatSentences.push(...p.sentences));

  if (flatSentences.length === 0) return [];

  // Establish boundaries for interpolation
  const startOffset = 3.5; // Average initial audio pause in IELTS before speech starts
  const d = duration || 180;

  // Average clear English speaking rate is ~14.5 characters per second (approx 150 words per minute)
  const estimatedActiveDuration = totalChars / 14.5;
  const maxEndTime = Math.min(d, startOffset + estimatedActiveDuration * 1.25);

  if (flatSentences[0].startTime === null) {
    flatSentences[0].startTime = startOffset;
  }
  
  if (flatSentences[flatSentences.length - 1].startTime === null) {
    const lastTimestamped = [...flatSentences].reverse().find(s => s.startTime !== null);
    const lastTimeVal = lastTimestamped ? lastTimestamped.startTime : startOffset;
    flatSentences[flatSentences.length - 1].startTime = Math.max(lastTimeVal + 2, maxEndTime);
  }

  // Enforce monotonicity (non-decreasing starting times)
  let currentKnownTime = flatSentences[0].startTime;
  for (let idx = 0; idx < flatSentences.length; idx++) {
    if (flatSentences[idx].startTime !== null) {
      if (flatSentences[idx].startTime < currentKnownTime) {
        flatSentences[idx].startTime = currentKnownTime;
      } else {
        currentKnownTime = flatSentences[idx].startTime;
      }
    }
  }

  // Linear interpolation of floating/un-timestamped sentences
  let i = 0;
  while (i < flatSentences.length) {
    if (flatSentences[i].startTime !== null) {
      let j = i + 1;
      while (j < flatSentences.length && flatSentences[j].startTime === null) {
        j++;
      }

      if (j < flatSentences.length) {
        const tStart = flatSentences[i].startTime!;
        const tEnd = flatSentences[j].startTime!;
        
        let gapChars = 0;
        for (let k = i; k < j; k++) {
          gapChars += flatSentences[k].len;
        }

        if (gapChars === 0) gapChars = 1;

        let cumGapChars = 0;
        for (let k = i; k < j; k++) {
          flatSentences[k].startTime = tStart + (cumGapChars / gapChars) * (tEnd - tStart);
          cumGapChars += flatSentences[k].len;
          flatSentences[k].endTime = tStart + (cumGapChars / gapChars) * (tEnd - tStart);
        }
      } else {
        flatSentences[i].endTime = d;
      }
      i = j;
    } else {
      i++;
    }
  }

  // Clean end times to ensure absolute contiguous non-overlapping timing
  for (let idx = 0; idx < flatSentences.length; idx++) {
    if (idx < flatSentences.length - 1) {
      flatSentences[idx].endTime = flatSentences[idx + 1].startTime;
    } else {
      flatSentences[idx].endTime = Math.max(flatSentences[idx].startTime + 1, d);
    }
  }

  const finalParagraphs: TranscriptParagraph[] = paragraphs.map(p => {
    return {
      sentences: p.sentences.map(ps => {
        const found = flatSentences.find(f => f.pIdx === ps.pIdx && f.sIdx === ps.sIdx);
        return {
          text: ps.text,
          charStart: ps.charStart,
          charEnd: ps.charEnd,
          startTime: found ? found.startTime : 0,
          endTime: found ? found.endTime : 0,
          pIdx: ps.pIdx,
          sIdx: ps.sIdx
        };
      })
    };
  });

  return finalParagraphs;
};

export default function ExamSectionPractice({
  exam,
  currentUser,
  onBack,
  onAddVocab,
  onAddHighlight,
  onDeleteHighlight,
  highlightList,
  vocabList,
  language,
  selectedSection,
  isFullTestMode = false,
  onFullTestSectionComplete
}: ExamSectionPracticeProps) {
  // Test State
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [essayText1, setEssayText1] = useState('');
  const [essayText2, setEssayText2] = useState('');
  const [speakingNotes, setSpeakingNotes] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioPlaybackSpeed, setAudioPlaybackSpeed] = useState(1);
  const [currentSection, setCurrentSection] = useState(selectedSection || 1);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [isNavExpanded, setIsNavExpanded] = useState(true);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [activeSentenceId, setActiveSentenceId] = useState<string | null>(null);

  useEffect(() => {
    setActiveGroupIndex(0);
  }, [currentSection]);

  const [selectionCoords, setSelectionCoords] = useState<{ top: number; left: number; text: string } | null>(null);
  const [showVocabSaveModal, setShowVocabSaveModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [selectedHighlightColor, setSelectedHighlightColor] = useState<'yellow' | 'green' | 'pink' | 'blue'>('yellow');
  const [tempWord, setTempWord] = useState('');
  const [viewingDetailedExplanation, setViewingDetailedExplanation] = useState(false);
  const [explanationTab, setExplanationTab] = useState<'content' | 'translation' | 'vocabulary'>('content');

  // Audio Error State (when localcache is missing or playback fails due to missing source)
  const [audioErrorModal, setAudioErrorModal] = useState<{ show: boolean; messageVi: string; messageEn: string } | null>(null);

  // Vocabulary Pre-fill States
  const [vocabIpa, setVocabIpa] = useState('');
  const [vocabMeaning, setVocabMeaning] = useState('');
  const [vocabVietMeaning, setVocabVietMeaning] = useState('');
  const [vocabExample, setVocabExample] = useState('');
  const [vocabCollo, setVocabCollo] = useState('');
  const [vocabSyn, setVocabSyn] = useState('');

  // Audio Reference
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Vocabulary Cache and Enrichment States
  const [enrichedVocab, setEnrichedVocab] = useState<Record<string, {
    word: string;
    ipa: string;
    meaning: string;
    collocation: string;
    example: string;
    exampleTranslation: string;
  }>>({});
  const [enrichingWords, setEnrichingWords] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (exam?.id) {
      try {
        const cached = localStorage.getItem(`vocab_cache_${exam.id}`);
        if (cached) {
          setEnrichedVocab(JSON.parse(cached));
        } else {
          setEnrichedVocab({});
        }
      } catch (e) {
        console.error('Failed to load vocabulary cache:', e);
      }
    }
  }, [exam?.id]);

  const enrichWord = async (word: string, originalMeaning?: string) => {
    const cleanedWord = word.trim();
    if (!cleanedWord || enrichingWords[cleanedWord]) return;
    setEnrichingWords(prev => ({ ...prev, [cleanedWord]: true }));
    try {
      const response = await fetch('/api/enrich-vocabulary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: cleanedWord, definition: originalMeaning }),
      });
      if (response.ok) {
        const data = await response.json();
        setEnrichedVocab(prev => {
          const updated = { ...prev, [cleanedWord]: data };
          try {
            localStorage.setItem(`vocab_cache_${exam.id}`, JSON.stringify(updated));
          } catch (e) {
            console.error('LocalStorage error:', e);
          }
          return updated;
        });
      } else {
        console.error('Failed to enrich vocabulary');
      }
    } catch (err) {
      console.error('Error enriching vocabulary:', err);
    } finally {
      setEnrichingWords(prev => ({ ...prev, [cleanedWord]: false }));
    }
  };

  const playPronunciation = (word: string) => {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}

    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US';
      const voices = window.speechSynthesis.getVoices();
      const usVoice = voices.find(v => v.lang.startsWith('en-US') && v.name.includes('Google'));
      if (usVoice) {
        utterance.voice = usVoice;
      } else {
        const anyUs = voices.find(v => v.lang.startsWith('en-US'));
        if (anyUs) utterance.voice = anyUs;
      }
      utterance.rate = 0.95;
      utterance.onerror = () => {
        playTTSFallback(word);
      };
      window.speechSynthesis.speak(utterance);
    } else {
      playTTSFallback(word);
    }
  };

  const playTTSFallback = (word: string) => {
    try {
      const audio = new Audio(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=2`);
      audio.play().catch(err => console.error('Audio playback failed:', err));
    } catch (e) {
      console.error('Fallback TTS failed:', e);
    }
  };

  const [isEnrichingAll, setIsEnrichingAll] = useState(false);
  const enrichAllVocab = async (items: { word: string; meaning: string }[]) => {
    if (isEnrichingAll) return;
    setIsEnrichingAll(true);
    try {
      const pendingItems = items.filter(item => {
        const cleaned = item.word.trim();
        return cleaned && !enrichedVocab[cleaned];
      });

      // Process in chunks of 3 concurrently
      const chunkSize = 3;
      for (let i = 0; i < pendingItems.length; i += chunkSize) {
        const chunk = pendingItems.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(item => enrichWord(item.word.trim(), item.meaning))
        );
      }
    } catch (e) {
      console.error('Error batch enriching vocabulary:', e);
    } finally {
      setIsEnrichingAll(false);
    }
  };

  // Set Timer based on Firebase Exam Duration
  useEffect(() => {
    if (!isSubmitted) {
      setTimer((exam.duration || 40) * 60);
    }
  }, [exam, isSubmitted]);

  // Countdown timer
  useEffect(() => {
    if (isSubmitted || timer <= 0) return;
    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timer, isSubmitted]);

  // Handle Audio Player
  const toggleAudio = async (url: string, forcePlay?: boolean) => {
    if (!url) return;
    
    let playUrl = url;
    if (url.startsWith('localcache:')) {
      try {
        playUrl = await resolveFileUrl(url);
      } catch (err) {
        console.error('Error resolving local cache audio URL:', err);
      }
    }
    
    if (!playUrl || playUrl.startsWith('localcache:')) {
      setAudioErrorModal({
        show: true,
        messageVi: "Không tìm thấy dữ liệu âm thanh. Do bạn đã chuyển sang tài khoản Google AI Studio mới, các file âm thanh lớn được lưu trữ ở tài khoản cũ không tự động đồng bộ sang database của tài khoản mới này (và IndexedDB cũ bị giới hạn do khác Origin/URL). Cách khắc phục: Vui lòng dùng tài khoản Admin/Owner đăng nhập, vào 'Quản lý Đề thi' (Exam Bank), chọn chỉnh sửa Đề thi này và tải lại (Re-upload) file âm thanh để hệ thống đồng bộ vào cơ sở dữ liệu mới của bạn.",
        messageEn: "Audio source not found. Since you switched to a new Google AI Studio account, the audio files from your old account cannot be automatically synced to the new account's database (and the previous IndexedDB is inaccessible due to Origin/URL security restrictions). Solution: Please log in as Admin/Owner, go to 'Exam Bank', edit this exam, and re-upload the audio file for this section to restore playback."
      });
      return;
    }

    let isNewAudio = false;

    const setupAudioListeners = (audio: HTMLAudioElement) => {
      audio.onended = () => setIsPlaying(false);
      audio.onloadedmetadata = () => {
        setAudioDuration(audio.duration || 0);
      };
      audio.ontimeupdate = () => {
        setAudioCurrentTime(audio.currentTime || 0);
      };
      // Immediately try to read metadata if already loaded
      if (audio.duration) {
        setAudioDuration(audio.duration);
      }
      audio.playbackRate = audioPlaybackSpeed;
    };

    if (!audioRef.current) {
      audioRef.current = new Audio(playUrl);
      setupAudioListeners(audioRef.current);
      isNewAudio = true;
    } else if (audioRef.current.src !== playUrl) {
      audioRef.current.pause();
      audioRef.current = new Audio(playUrl);
      setupAudioListeners(audioRef.current);
      isNewAudio = true;
    }

    if (forcePlay) {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.warn('Autoplay prevented by browser:', err);
        setIsPlaying(false);
        setAudioErrorModal({
          show: true,
          messageVi: "Tải file âm thanh thất bại. Do bạn đã chuyển sang tài khoản Google AI Studio mới, các file âm thanh đã tải lên ở tài khoản cũ không tự động đồng bộ sang database của tài khoản mới này (và IndexedDB cũ bị giới hạn do khác Origin/URL). Cách khắc phục: Vui lòng dùng tài khoản Admin/Owner đăng nhập, vào 'Quản lý Đề thi' (Exam Bank), chọn chỉnh sửa Đề thi này và tải lại (Re-upload) file âm thanh để hệ thống đồng bộ vào cơ sở dữ liệu mới của bạn.",
          messageEn: "Audio playback failed. Since you switched to a new Google AI Studio account, the audio files from your old account cannot be automatically synced to the new account's database. Please log in as Admin/Owner, go to 'Exam Bank', edit this exam, and re-upload the audio file."
        });
      });
      return;
    }

    // During the test (not submitted), prevent pausing if already playing
    if (!isSubmitted && isPlaying && !isNewAudio) {
      return;
    }

    if (isPlaying && !isNewAudio) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.error('Playback failed:', err);
        setIsPlaying(false);
        setAudioErrorModal({
          show: true,
          messageVi: "Tải file âm thanh thất bại. Do bạn đã chuyển sang tài khoản Google AI Studio mới, các file âm thanh đã tải lên ở tài khoản cũ không tự động đồng bộ sang database của tài khoản mới này (và IndexedDB cũ bị giới hạn do khác Origin/URL). Cách khắc phục: Vui lòng dùng tài khoản Admin/Owner đăng nhập, vào 'Quản lý Đề thi' (Exam Bank), chọn chỉnh sửa Đề thi này và tải lại (Re-upload) file âm thanh để hệ thống đồng bộ vào cơ sở dữ liệu mới của bạn.",
          messageEn: "Audio playback failed. Since you switched to a new Google AI Studio account, the audio files from your old account cannot be automatically synced to the new account's database. Please log in as Admin/Owner, go to 'Exam Bank', edit this exam, and re-upload the audio file."
        });
      });
    }
  };

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setAudioCurrentTime(time);
    }
  };

  const handleSpeedChange = (speed: number) => {
    setAudioPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };
  
  // Track and update the active sentence ID based on audio playback time
  useEffect(() => {
    if (exam.type !== 'listening') return;
    
    const activeSec = exam.sections?.find(s => s.sectionNumber === currentSection);
    if (!activeSec?.transcript) {
      setActiveSentenceId(null);
      return;
    }
    
    const paragraphs = parseTranscript(activeSec.transcript, audioDuration);
    let foundId: string | null = null;
    
    for (const p of paragraphs) {
      const activeSent = p.sentences.find(s => audioCurrentTime >= s.startTime && audioCurrentTime <= s.endTime);
      if (activeSent) {
        foundId = `${activeSent.pIdx}-${activeSent.sIdx}`;
        break;
      }
    }
    
    if (foundId !== activeSentenceId) {
      setActiveSentenceId(foundId);
    }
  }, [audioCurrentTime, currentSection, exam, audioDuration, activeSentenceId]);

  // Auto-scroll transcript sentences into view only when active sentence changes
  useEffect(() => {
    if (!isAutoScrollEnabled || !isPlaying || !activeSentenceId) return;
    
    const el = document.getElementById(`transcript-sentence-${activeSentenceId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeSentenceId, isPlaying, isAutoScrollEnabled]);

  // Autoplay listening audio when exam starts or section changes
  useEffect(() => {
    if (exam.type === 'listening' && !isSubmitted) {
      const activeSec = exam.sections?.find(s => s.sectionNumber === currentSection);
      if (activeSec?.audioUrl) {
        const timerId = setTimeout(() => {
          toggleAudio(activeSec.audioUrl || '', true);
        }, 1000);
        return () => clearTimeout(timerId);
      }
    }
  }, [currentSection, exam.id, isSubmitted]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current.onloadedmetadata = null;
        audioRef.current.ontimeupdate = null;
      }
    };
  }, []);

  const getSectionProgress = (passageNum: number) => {
    const pObj = exam.passages?.find(p => p.passageNumber === passageNum);
    const questions = pObj?.questions || [];
    const total = questions.length;
    const answered = questions.filter(q => (answers[q.number] || '').trim() !== '').length;
    return { answered, total };
  };

  const getListeningSectionProgress = (secNum: number) => {
    const sObj = exam.sections?.find(s => s.sectionNumber === secNum);
    const questions = sObj?.questions || [];
    const total = questions.length;
    const answered = questions.filter(q => (answers[q.number] || '').trim() !== '').length;
    return { answered, total };
  };

  let totalSections = 1;
  if (exam.type === 'listening') {
    totalSections = exam.sections?.length || 1;
  } else if (exam.type === 'reading') {
    totalSections = exam.passages?.length || 1;
  } else if (exam.type === 'writing') {
    totalSections = 2;
  } else if (exam.type === 'speaking') {
    totalSections = 3;
  }

  // Grader (Auto-grade Listening/Reading based on correct answers)
  const calculateResult = () => {
    let correctCount = 0;
    let totalQuestions = 0;

    if (exam.type === 'listening') {
      const activeSections = selectedSection 
        ? exam.sections?.filter(s => s.sectionNumber === selectedSection) 
        : exam.sections || [];

      activeSections.forEach(s => {
        s.questions?.forEach(q => {
          totalQuestions++;
          const hasMatched = areAnswersMatching(answers[q.number] || '', q.correctAnswer);
          if (hasMatched && q.correctAnswer.trim() !== '') {
            correctCount++;
          }
        });
      });
    } else if (exam.type === 'reading') {
      const passages = exam.passages || [];
      passages.forEach(p => {
        p.questions?.forEach(q => {
          totalQuestions++;
          const hasMatched = areAnswersMatching(answers[q.number] || '', q.correctAnswer);
          if (hasMatched && q.correctAnswer.trim() !== '') {
            correctCount++;
          }
        });
      });
    }

    // Convert correct answers to IELTS band score
    let band = 1.0;
    if (totalQuestions > 0) {
      const ratio = correctCount / totalQuestions;
      if (ratio >= 0.9) band = 8.5;
      else if (ratio >= 0.8) band = 7.5;
      else if (ratio >= 0.7) band = 7.0;
      else if (ratio >= 0.6) band = 6.5;
      else if (ratio >= 0.5) band = 6.0;
      else if (ratio >= 0.4) band = 5.5;
      else if (ratio >= 0.3) band = 5.0;
      else if (ratio >= 0.2) band = 4.0;
      else band = 3.0;
    }

    return { correctCount, totalQuestions, band };
  };

  const handleSubmit = () => {
    setIsSubmitted(true);
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }

    if (onFullTestSectionComplete) {
      const { correctCount, band } = calculateResult();
      onFullTestSectionComplete(answers, band, correctCount);
    }
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Text Selection / Floating menu
  const handleTextSelection = (e: React.MouseEvent) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setSelectionCoords(null);
      return;
    }
    const text = selection.toString().trim();
    if (text.length > 0 && text.length < 100) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        setSelectionCoords({
          top: rect.top - containerRect.top - 45,
          left: rect.left - containerRect.left + rect.width / 2,
          text: text
        });
      } else {
        setSelectionCoords({
          top: window.scrollY + rect.top - 50,
          left: window.scrollX + rect.left + rect.width / 2,
          text: text
        });
      }
    } else {
      setSelectionCoords(null);
    }
  };

  const applyHighlight = async (color: 'yellow' | 'green' | 'pink' | 'blue') => {
    if (!selectionCoords) return;
    await onAddHighlight({
      examId: exam.id,
      text: selectionCoords.text,
      color: color
    });
    setSelectionCoords(null);
  };

  const handleSaveVocabClick = () => {
    if (!selectionCoords) return;
    setTempWord(selectionCoords.text);
    setVocabIpa('');
    setVocabMeaning('');
    setVocabVietMeaning('');
    setVocabExample('');
    setVocabCollo('');
    setVocabSyn('');
    setShowVocabSaveModal(true);
    setSelectionCoords(null);
  };

  const submitVocabulary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempWord.trim()) return;
    await onAddVocab({
      word: tempWord.trim(),
      source: exam.title,
      favorite: false
    });
    setShowVocabSaveModal(false);
  };

  const handleAddNoteClick = () => {
    if (!selectionCoords) return;
    setNoteText('');
    setShowNoteModal(true);
  };

  const saveNoteHighlight = async () => {
    if (!selectionCoords) return;
    await onAddHighlight({
      examId: exam.id,
      text: selectionCoords.text,
      color: selectedHighlightColor,
      note: noteText
    });
    setShowNoteModal(false);
    setSelectionCoords(null);
  };

  // Helper to wrap a single text block with highlights
  const highlightText = (text: string) => {
    if (!text) return '';
    const examHighlights = highlightList.filter(h => h.examId === exam.id);
    if (examHighlights.length === 0) return <>{text}</>;

    // Sort highlights by length descending to match larger chunks first
    const sortedHighlights = [...examHighlights].sort((a, b) => b.text.length - a.text.length);

    let parts: Array<{ text: string; isHighlighted: boolean; color?: string; note?: string; id?: string }> = [
      { text, isHighlighted: false }
    ];

    sortedHighlights.forEach(hl => {
      const tempParts: typeof parts = [];
      parts.forEach(part => {
        if (part.isHighlighted) {
          tempParts.push(part);
        } else {
          const index = part.text.toLowerCase().indexOf(hl.text.toLowerCase());
          if (index !== -1) {
            const startText = part.text.substring(0, index);
            const matchedText = part.text.substring(index, index + hl.text.length);
            const endText = part.text.substring(index + hl.text.length);

            if (startText) tempParts.push({ text: startText, isHighlighted: false });
            tempParts.push({ 
              text: matchedText, 
              isHighlighted: true, 
              color: hl.color, 
              note: hl.note,
              id: hl.id 
            });
            if (endText) tempParts.push({ text: endText, isHighlighted: false });
          } else {
            tempParts.push(part);
          }
        }
      });
      parts = tempParts;
    });

    return (
      <>
        {parts.map((part, partIdx) => {
          if (part.isHighlighted) {
            let colorClass = 'bg-rose-200/80 dark:bg-rose-900/40 text-slate-900 dark:text-rose-100';
            if (part.color === 'yellow') colorClass = 'bg-yellow-200/80 dark:bg-yellow-900/40 text-slate-900 dark:text-yellow-100';
            if (part.color === 'green') colorClass = 'bg-emerald-200/80 dark:bg-emerald-900/40 text-slate-900 dark:text-emerald-100';
            if (part.color === 'blue') colorClass = 'bg-blue-200/80 dark:bg-blue-900/40 text-slate-900 dark:text-blue-100';

            return (
              <span 
                key={partIdx} 
                className={`${colorClass} relative group cursor-help px-0.5 rounded transition-all inline`}
                title={part.note ? `${language === 'vi' ? 'Ghi chú' : 'Note'}: ${part.note}` : undefined}
              >
                {part.text}
                {part.note && (
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-slate-900 text-white text-[10px] py-1 px-2 rounded shadow-lg whitespace-nowrap z-30">
                    📌 {part.note}
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (part.id) onDeleteHighlight(part.id);
                  }}
                  className="ml-1 text-[8px] text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity hover:underline font-bold"
                  title={language === 'vi' ? 'Xóa highlight' : 'Delete highlight'}
                >
                  ✕
                </button>
              </span>
            );
          }
          return <span key={partIdx}>{part.text}</span>;
        })}
      </>
    );
  };

  // Render text content with interactive highlights
  const renderTextWithHighlights = (content: string) => {
    if (!content) return <span className="italic text-slate-400">{language === 'vi' ? 'Đang cập nhật.' : 'Updating...'}</span>;

    return (
      <div className="space-y-5 lg:space-y-6 text-[17px] md:text-[19px] text-slate-700 dark:text-slate-300 leading-relaxed md:leading-loose whitespace-pre-wrap select-text">
        {content.split('\n').map((paragraph, pIdx) => {
          if (!paragraph.trim()) return null;
          return (
            <p key={pIdx} onMouseUp={handleTextSelection} className="select-text">
              {highlightText(paragraph)}
            </p>
          );
        })}
      </div>
    );
  };

  const getActiveAudioUrl = () => {
    if (exam.type === 'listening') {
      return exam.sections?.find(s => s.sectionNumber === currentSection)?.audioUrl || null;
    } else if (exam.type === 'reading') {
      return exam.passages?.find(p => p.passageNumber === currentSection)?.audioUrl || null;
    } else if (exam.type === 'writing') {
      return currentSection === 1 ? exam.writingTask1?.audioUrl || null : exam.writingTask2?.audioUrl || null;
    } else if (exam.type === 'speaking') {
      return currentSection === 1 
        ? exam.speakingPart1?.audioUrl || null 
        : currentSection === 2 
          ? exam.speakingPart2?.audioUrl || null 
          : exam.speakingPart3?.audioUrl || null;
    }
    return null;
  };

  const renderAnswerSheet = () => {
    return (
      <div className="space-y-4">
        {(() => {
          let questionsToRender: Array<{ number: number; questionType: string; questionText: string; options?: string[]; correctAnswer?: string; questionInstruction?: string; explanation?: string }> = [];
          let currentSecObj: any = null;

          if (exam.type === 'listening') {
            currentSecObj = exam.sections?.find(s => s.sectionNumber === currentSection);
            questionsToRender = currentSecObj?.questions || [];
          } else {
            const currentPassageObj = exam.passages?.find(p => p.passageNumber === currentSection);
            questionsToRender = currentPassageObj?.questions || [];
          }

          if (questionsToRender.length === 0) {
            return (
              <div className="text-center p-8 text-slate-400 text-xs">
                {language === 'vi' ? 'Admin chưa nhập câu hỏi cho phần này.' : 'Admin has not added questions for this section.'}
              </div>
            );
          }

          const questionGroups = groupQuestions(questionsToRender);
          const activeIndex = Math.min(activeGroupIndex, questionGroups.length - 1);
          const currentActiveIdx = activeIndex >= 0 ? activeIndex : 0;
          const activeGroup = questionGroups[currentActiveIdx];
          const questionsInActiveGroup = activeGroup ? activeGroup.questions : [];

          const activeType = activeGroup?.type || '';
          const isTFGroup = isTFNGType(activeType, activeGroup?.questions[0]?.correctAnswer, questionsToRender);
          const isYNGroup = isYNNGType(activeType, activeGroup?.questions[0]?.correctAnswer, questionsToRender);
          const parsedGroupInstruction = questionsInActiveGroup[0]?.questionInstruction || '';

          let instructionDesc = '';
          let instructionSteps: string[] = [];

          if (parsedGroupInstruction) {
            instructionDesc = parsedGroupInstruction;
            
            if (isTFGroup) {
              instructionSteps = [
                language === 'vi' ? 'TRUE: Nếu thông tin trùng khớp hoàn toàn với bài đọc.' : 'TRUE: If the statement agrees with the information.',
                language === 'vi' ? 'FALSE: Nếu thông tin trái ngược hoặc mâu thuẫn hoàn toàn với bài đọc.' : 'FALSE: If the statement contradicts the information.',
                language === 'vi' ? 'NOT GIVEN: Nếu không có hoặc không đủ thông tin trong bài đọc.' : 'NOT GIVEN: If there is no information on this.'
              ];
            } else if (isYNGroup) {
              instructionSteps = [
                language === 'vi' ? 'YES: Nếu câu nhận định khớp với quan điểm của tác giả.' : 'YES: If the statement agrees with the writer claims.',
                language === 'vi' ? 'NO: Nếu câu nhận định trái ngược với quan điểm của tác giả.' : 'NO: If the statement contradicts the writer claims.',
                language === 'vi' ? 'NOT GIVEN: Nếu không có thông tin về quan điểm của tác giả.' : 'NOT GIVEN: If it is impossible to say what the writer thinks.'
              ];
            } else {
              instructionSteps = [
                language === 'vi' ? 'Chú ý giới hạn từ (ví dụ: NO MORE THAN TWO WORDS) để tránh mất điểm.' : 'Pay attention to the word limit constraints to avoid losing marks.',
                language === 'vi' ? 'Điền chính xác từ vựng hoặc chữ cái lựa chọn tương ứng từ bài thi.' : 'Write exact keywords or letters matching the original question context.'
              ];
            }
          } else if (isTFGroup) {
            instructionDesc = language === 'vi'
              ? 'Xác định xem thông tin trong câu hỏi có trùng khớp với thông tin trong bài đọc không:'
              : 'Determine if the statements agree with the information in the reading passage:';
            instructionSteps = [
              language === 'vi' ? 'TRUE: Nếu thông tin trùng khớp hoàn toàn với bài đọc.' : 'TRUE: If the statement agrees with the information.',
              language === 'vi' ? 'FALSE: Nếu thông tin trái ngược hoặc mâu thuẫn hoàn toàn với bài đọc.' : 'FALSE: If the statement contradicts the information.',
              language === 'vi' ? 'NOT GIVEN: Nếu không có hoặc không đủ thông tin trong bài đọc.' : 'NOT GIVEN: If there is no information on this.'
            ];
          } else if (isYNGroup) {
            instructionDesc = language === 'vi'
              ? 'Xác định xem câu nhận định có khớp với quan điểm hoặc khẳng định của tác giả không:'
              : 'Determine if the statements agree with the claims or views of the writer:';
            instructionSteps = [
              language === 'vi' ? 'YES: Nếu câu nhận định khớp với quan điểm của tác giả.' : 'YES: If the statement agrees with the writer claims.',
              language === 'vi' ? 'NO: Nếu câu nhận định trái ngược với quan điểm của tác giả.' : 'NO: If the statement contradicts the writer claims.',
              language === 'vi' ? 'NOT GIVEN: Nếu không có thông tin về quan điểm của tác giả.' : 'NOT GIVEN: If it is impossible to say what the writer thinks.'
            ];
          } else {
            if (activeType.toLowerCase().includes('completion')) {
              instructionDesc = language === 'vi'
                ? 'Điền từ thích hợp vào chỗ trống:'
                : 'Fill in the blanks with appropriate words:';
              instructionSteps = [
                language === 'vi' ? 'Đọc kỹ giới hạn số từ (Ví dụ: NO MORE THAN TWO WORDS).' : 'Pay close attention to word limit restrictions.',
                language === 'vi' ? 'Từ điền phải được lấy trực tiếp từ bài đọc/bài nghe.' : 'Words must be extracted directly from the text/audio.',
                language === 'vi' ? 'Chú ý đúng ngữ pháp và chính tả của từ cần điền.' : 'Check spelling and grammar agreements.'
              ];
            } else if (activeType.toLowerCase().includes('choice')) {
              instructionDesc = language === 'vi'
                ? 'Chọn đáp án đúng nhất từ các lựa chọn cho sẵn:'
                : 'Choose the best answer from the given options:';
              instructionSteps = [
                language === 'vi' ? 'Đọc kỹ câu hỏi và xác định từ khóa chính.' : 'Read questions carefully and identify key terms.',
                language === 'vi' ? 'Loại trừ các phương án gây nhiễu rõ ràng trước.' : 'Eliminate obviously incorrect distractor options first.',
                language === 'vi' ? 'Tìm đoạn thông tin liên quan trong bài để đối chiếu.' : 'Locate corresponding details in the text to match.'
              ];
            } else {
              instructionDesc = language === 'vi'
                ? 'Đọc kỹ yêu cầu đề bài và hoàn thành câu hỏi:'
                : 'Read the task requirements carefully and complete:';
              instructionSteps = [
                language === 'vi' ? 'Đảm bảo điền đúng định dạng câu trả lời.' : 'Ensure the correct answer format.',
                language === 'vi' ? 'Đối chiếu kỹ thông tin gốc để tránh lỗi sai không đáng có.' : 'Cross-check the original content to prevent errors.'
              ];
            }
          }

          return (
            <div className="space-y-4">
              {/* Horizontal Scrollable Question Group Tabs */}
              {questionGroups.length > 1 && (
                <div className="flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800/60 pb-2.5 overflow-x-auto no-scrollbar scroll-smooth">
                  {questionGroups.map((group, idx) => {
                    const isActive = idx === currentActiveIdx;
                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => setActiveGroupIndex(idx)}
                        className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all shrink-0 cursor-pointer flex flex-col items-start gap-0.5 min-w-[100px] ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/15'
                            : 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850 border border-slate-100 dark:border-slate-800/40'
                        }`}
                      >
                        <span className="text-[9px] uppercase tracking-wider opacity-75">
                          {language === 'vi' ? `Dạng ${idx + 1}` : `Group ${idx + 1}`}
                        </span>
                        <span className="text-xs font-black">{group.rangeText}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Tailored Instruction Banner for Active Group */}
              <div className="bg-[#e03a3a] text-white rounded-xl p-4.5 mb-5 shadow-xs animate-fade-in select-none">
                <div className="text-[11px] font-extrabold tracking-wider opacity-90 uppercase">
                  Question {activeGroup?.rangeText || `${questionsInActiveGroup[0]?.number} - ${questionsInActiveGroup[questionsInActiveGroup.length - 1]?.number}`}
                </div>
                <div className="text-sm font-black mt-1 leading-snug">
                  {instructionDesc}
                </div>
                {instructionSteps && instructionSteps.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-white/20 text-[10px] font-bold flex flex-col gap-1 opacity-90">
                    {instructionSteps.map((step, idx) => (
                      <div key={idx} className="flex items-start gap-1.5">
                        <span>•</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Questions of Active Group */}
              {exam.type === 'listening' ? (
                <div className="space-y-4">
                  {/* Inner Section Header */}
                  <div className="border-b border-slate-100 dark:border-slate-800/80 pb-3 mb-2.5">
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1.5">
                      <span className="w-1.5 h-3 bg-indigo-600 rounded-xs" />
                      {currentSecObj?.title || (language === 'vi' ? 'Nội dung câu hỏi' : 'Question Sheet')}
                    </h3>
                  </div>

                  <div className="space-y-3">
                    {questionsInActiveGroup.map(q => {
                      const hasOptions = q.options && q.options.length > 0;
                      const isTF = isTFNGType(q.questionType, q.correctAnswer, questionsToRender);
                      const isYN = isYNNGType(q.questionType, q.correctAnswer, questionsToRender);
                      const blankRegex = /_{3,}|\.{3,}/g;
                      const hasBlanks = blankRegex.test(q.questionText);

                      return (
                        <div 
                          key={q.number} 
                          id={`question-card-${q.number}`}
                          className="py-2 border-b border-slate-50 dark:border-slate-850 last:border-b-0 space-y-2 text-xs scroll-mt-6 transition-all"
                        >
                          <div className="flex items-start gap-2.5 flex-wrap">
                            <span className="text-slate-400 select-none mt-0.5">•</span>

                            {!hasBlanks && (
                              <span className="font-extrabold text-blue-600 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded text-[10px] shrink-0 mt-0.5 border border-blue-100 dark:border-blue-900">
                                Q {q.number}
                              </span>
                            )}
                            {hasBlanks ? (
                              (() => {
                                const parts = q.questionText.split(blankRegex);
                                return (
                                  <span className="font-semibold text-slate-700 dark:text-slate-300 leading-relaxed inline-flex flex-wrap items-center gap-1.5 select-text">
                                    {parts.map((part, index) => (
                                      <React.Fragment key={index}>
                                        {index > 0 && (
                                          <span className="inline-flex items-center mx-1 select-none">
                                            <span className="text-[#1a73e8] dark:text-blue-400 font-extrabold text-xs shrink-0 mr-1.5">
                                              {q.number}.
                                            </span>
                                            <span className="relative inline-block w-32">
                                              <input
                                                type="text"
                                                placeholder=""
                                                value={answers[q.number] || ''}
                                                onChange={e => setAnswers({ ...answers, [q.number]: e.target.value })}
                                                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-md px-2.5 h-7.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-xs font-black text-center text-[#1a73e8] dark:text-blue-300 transition-all"
                                              />
                                            </span>
                                          </span>
                                        )}
                                        <span>{highlightText(part)}</span>
                                      </React.Fragment>
                                    ))}
                                  </span>
                                );
                              })()
                            ) : (
                              <span className="font-semibold text-slate-700 dark:text-slate-300 leading-normal">{highlightText(q.questionText)}</span>
                            )}
                          </div>

                          {/* Options if Multiple Choice */}
                          {hasOptions ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pl-5">
                              {q.options!.map((opt, oIdx) => {
                                const optionLetter = String.fromCharCode(65 + oIdx); // A, B, C, D
                                const isSelected = answers[q.number] === optionLetter;
                                return (
                                  <button
                                    key={oIdx}
                                    type="button"
                                    onClick={() => setAnswers({ ...answers, [q.number]: optionLetter })}
                                    className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 font-medium text-xs ${
                                      isSelected
                                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300 font-semibold shadow-xs'
                                        : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                                    }`}
                                  >
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                                      isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                    }`}>
                                      {optionLetter}
                                    </span>
                                    <span>{opt}</span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : isTF ? (
                            <div className="grid grid-cols-3 gap-2 mt-2 pl-5">
                              {['True', 'False', 'Not given'].map((label) => {
                                const optValue = label.toUpperCase();
                                const isSelected = (answers[q.number] || '').toUpperCase() === optValue;
                                return (
                                  <button
                                    key={label}
                                    type="button"
                                    onClick={() => setAnswers({ ...answers, [q.number]: optValue })}
                                    className={`py-2 px-1 rounded-xl border text-center transition-all font-bold text-[11px] sm:text-xs cursor-pointer ${
                                      isSelected
                                        ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-400 hover:bg-slate-50'
                                    }`}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          ) : isYN ? (
                            <div className="grid grid-cols-3 gap-2 mt-2 pl-5">
                              {['Yes', 'No', 'Not given'].map((label) => {
                                const optValue = label.toUpperCase();
                                const isSelected = (answers[q.number] || '').toUpperCase() === optValue;
                                return (
                                  <button
                                    key={label}
                                    type="button"
                                    onClick={() => setAnswers({ ...answers, [q.number]: optValue })}
                                    className={`py-2 px-1 rounded-xl border text-center transition-all font-bold text-[11px] sm:text-xs cursor-pointer ${
                                      isSelected
                                        ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-400 hover:bg-slate-50'
                                    }`}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          ) : hasBlanks ? null : (
                            <div className="mt-1 pl-5">
                              <input
                                type="text"
                                placeholder={language === 'vi' ? 'Nhập câu trả lời...' : 'Type answer...'}
                                value={answers[q.number] || ''}
                                onChange={e => setAnswers({ ...answers, [q.number]: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-slate-800 dark:text-slate-100"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {questionsInActiveGroup.map(q => {
                    const hasOptions = q.options && q.options.length > 0;
                    const isTF = isTFNGType(q.questionType, q.correctAnswer, questionsToRender);
                    const isYN = isYNNGType(q.questionType, q.correctAnswer, questionsToRender);
                    const blankRegex = /_{3,}|\.{3,}/g;
                    const hasBlanks = blankRegex.test(q.questionText);

                    return (
                      <div 
                        key={q.number} 
                        id={`question-card-${q.number}`}
                        className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/60 space-y-4 text-sm md:text-base scroll-mt-6 transition-all hover:shadow-xs"
                      >
                        <div className="flex items-start gap-2.5 flex-wrap">
                          {!hasBlanks && (
                            <span className="font-extrabold text-blue-600 bg-blue-50 dark:bg-blue-950 px-3 py-1.5 rounded-lg text-xs shrink-0 mt-0.5 border border-blue-100 dark:border-blue-900">
                              Q {q.number}
                            </span>
                          )}
                          {hasBlanks ? (
                            (() => {
                              const parts = q.questionText.split(blankRegex);
                              return (
                                <span className="font-bold text-slate-700 dark:text-slate-300 leading-relaxed inline-flex flex-wrap items-center gap-1.5 select-text">
                                  {parts.map((part, index) => (
                                    <React.Fragment key={index}>
                                      {index > 0 && (
                                        <span className="inline-flex items-center mx-1 select-none">
                                          <span className="text-[#1a73e8] dark:text-blue-400 font-extrabold text-sm shrink-0 mr-1.5">
                                            {q.number}.
                                          </span>
                                          <span className="relative inline-block w-36">
                                            <input
                                              type="text"
                                              placeholder=""
                                              value={answers[q.number] || ''}
                                              onChange={e => setAnswers({ ...answers, [q.number]: e.target.value })}
                                              className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-md px-3 w-full text-sm font-black text-center text-[#1a73e8] dark:text-blue-300 h-9 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                                            />
                                          </span>
                                        </span>
                                      )}
                                      <span>{highlightText(part)}</span>
                                    </React.Fragment>
                                  ))}
                                </span>
                              );
                            })()
                          ) : (
                            <span className="font-semibold text-slate-700 dark:text-slate-300 leading-normal select-text">{highlightText(q.questionText)}</span>
                          )}
                        </div>

                        {/* Options if Multiple Choice */}
                        {hasOptions ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                            {q.options!.map((opt, oIdx) => {
                              const optionLetter = String.fromCharCode(65 + oIdx);
                              const isSelected = answers[q.number] === optionLetter;
                              return (
                                <button
                                  key={oIdx}
                                  type="button"
                                  onClick={() => setAnswers({ ...answers, [q.number]: optionLetter })}
                                  className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 font-semibold text-sm cursor-pointer ${
                                    isSelected
                                      ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300'
                                      : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-850 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                                  }`}
                                >
                                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                                    isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                  }`}>
                                    {optionLetter}
                                  </span>
                                  <span>{opt}</span>
                                </button>
                              );
                            })}
                          </div>
                        ) : isTF ? (
                          <div className="grid grid-cols-3 gap-3 mt-3">
                            {['True', 'False', 'Not given'].map((label) => {
                              const optValue = label.toUpperCase();
                              const isSelected = (answers[q.number] || '').toUpperCase() === optValue;
                              return (
                                <button
                                  key={label}
                                  type="button"
                                  onClick={() => setAnswers({ ...answers, [q.number]: optValue })}
                                  className={`py-3 px-1.5 rounded-xl border text-center transition-all font-extrabold text-xs sm:text-sm cursor-pointer ${
                                    isSelected
                                      ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-400 hover:bg-slate-50'
                                  }`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        ) : isYN ? (
                          <div className="grid grid-cols-3 gap-3 mt-3">
                            {['Yes', 'No', 'Not given'].map((label) => {
                              const optValue = label.toUpperCase();
                              const isSelected = (answers[q.number] || '').toUpperCase() === optValue;
                              return (
                                <button
                                  key={label}
                                  type="button"
                                  onClick={() => setAnswers({ ...answers, [q.number]: optValue })}
                                  className={`py-3 px-1.5 rounded-xl border text-center transition-all font-extrabold text-xs sm:text-sm cursor-pointer ${
                                    isSelected
                                      ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-400 hover:bg-slate-50'
                                  }`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        ) : hasBlanks ? null : (
                          <div className="mt-1.5">
                            <input
                              type="text"
                              placeholder={language === 'vi' ? 'Nhập câu trả lời...' : 'Type answer...'}
                              value={answers[q.number] || ''}
                              onChange={e => setAnswers({ ...answers, [q.number]: e.target.value })}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-slate-800 dark:text-slate-100"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Navigation buttons between question groups */}
              {questionGroups.length > 1 && (
                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4 mt-6">
                  <button
                    type="button"
                    disabled={currentActiveIdx === 0}
                    onClick={() => setActiveGroupIndex(prev => Math.max(0, prev - 1))}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                      currentActiveIdx === 0
                        ? 'border-slate-100 text-slate-300 dark:border-slate-800 dark:text-slate-700 cursor-not-allowed'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer'
                    }`}
                  >
                    <ArrowLeft size={14} />
                    <span>{language === 'vi' ? 'Dạng trước' : 'Prev'}</span>
                  </button>

                  <div className="text-slate-400 dark:text-slate-500 text-[11px] font-bold">
                    {language === 'vi' 
                      ? `Dạng ${currentActiveIdx + 1} / ${questionGroups.length}`
                      : `Group ${currentActiveIdx + 1} of ${questionGroups.length}`}
                  </div>

                  <button
                    type="button"
                    disabled={currentActiveIdx === questionGroups.length - 1}
                    onClick={() => setActiveGroupIndex(prev => Math.min(questionGroups.length - 1, prev + 1))}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                      currentActiveIdx === questionGroups.length - 1
                        ? 'border-slate-100 text-slate-300 dark:border-slate-800 dark:text-slate-700 cursor-not-allowed'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer'
                    }`}
                  >
                    <span>{language === 'vi' ? 'Dạng tiếp' : 'Next'}</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  // Extract variables for simpler rendering
  const { correctCount, totalQuestions, band } = calculateResult();

  return (
    <div ref={containerRef} className="w-full min-h-screen bg-[#f8fafc] dark:bg-slate-950 flex flex-col text-left relative" onMouseUp={handleTextSelection}>
      {/* Floating Toolbar for Highlights and Notes */}
      {selectionCoords && (
        <div 
          className="absolute bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/70 border border-slate-200/80 dark:border-slate-800 p-1.5 flex items-center gap-1.5 z-50 animate-fade-in text-xs"
          style={{ top: selectionCoords.top, left: Math.max(10, selectionCoords.left - 100) }}
        >
          {/* Main Quick Highlighter Button (matching pink highlight in screenshot) */}
          <button 
            type="button"
            onClick={() => applyHighlight('pink')} 
            className="p-1.5 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all flex items-center justify-center cursor-pointer"
            title={language === 'vi' ? 'Highlight Hồng' : 'Pink Highlight'}
          >
            <Highlighter size={16} />
          </button>

          {/* Quick Note Button */}
          <button 
            type="button"
            onClick={handleAddNoteClick}
            className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl transition-all flex items-center justify-center cursor-pointer"
            title={language === 'vi' ? 'Ghi chú' : 'Add Note'}
          >
            <Edit2 size={15} />
          </button>

          {/* Quick Vocab Button */}
          <button 
            type="button"
            onClick={handleSaveVocabClick}
            className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl transition-all flex items-center justify-center cursor-pointer"
            title={language === 'vi' ? 'Lưu từ' : 'Save word'}
          >
            <BookOpen size={15} />
          </button>

          {/* Subtle alternative color options */}
          <div className="flex gap-1.5 pl-2 border-l border-slate-100 dark:border-slate-800 items-center">
            <button 
              type="button"
              onClick={() => applyHighlight('yellow')} 
              className="w-3.5 h-3.5 rounded-full bg-yellow-300 border border-yellow-400/55 hover:scale-110 transition-transform cursor-pointer" 
              title={language === 'vi' ? 'Vàng' : 'Yellow'} 
            />
            <button 
              type="button"
              onClick={() => applyHighlight('green')} 
              className="w-3.5 h-3.5 rounded-full bg-emerald-400 border border-emerald-500/55 hover:scale-110 transition-transform cursor-pointer" 
              title={language === 'vi' ? 'Lục' : 'Green'} 
            />
            <button 
              type="button"
              onClick={() => applyHighlight('blue')} 
              className="w-3.5 h-3.5 rounded-full bg-blue-400 border border-blue-500/55 hover:scale-110 transition-transform cursor-pointer" 
              title={language === 'vi' ? 'Lam' : 'Blue'} 
            />
          </div>
        </div>
      )}

      {/* Save Vocabulary Modal */}
      {showVocabSaveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <form onSubmit={submitVocabulary} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-xl max-w-md w-full space-y-4 animate-scale-up text-left">
            <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2 border-b border-slate-50 dark:border-slate-800 pb-2">
              <BookOpen className="text-amber-500" />
              <span>{language === 'vi' ? 'Lưu từ vựng mới' : 'Save New Vocabulary'}</span>
            </h4>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 font-bold mb-1">{language === 'vi' ? 'Từ vựng' : 'Word'}</label>
                <input 
                  type="text" 
                  value={tempWord} 
                  onChange={e => setTempWord(e.target.value)} 
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-850 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-850 text-[11px] leading-normal">
                <Loader2 className="w-4 h-4 animate-spin shrink-0 text-amber-500" />
                <span>
                  {language === 'vi' 
                    ? 'Bạn chỉ cần chọn lưu từ, hệ thống AI sẽ tự động tìm kiếm định nghĩa, phát âm IPA, collocations và câu ví dụ tương ứng!'
                    : 'Just save the word, and our AI will automatically fetch detailed definitions, IPA pronunciation, collocations, and example sentences!'}
                </span>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 text-xs">
              <button 
                type="button" 
                onClick={() => setShowVocabSaveModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 dark:text-slate-400 hover:bg-slate-50 rounded-lg font-bold"
              >
                {language === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button 
                type="submit" 
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md shadow-blue-500/10 cursor-pointer"
              >
                {language === 'vi' ? 'Lưu lại' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Note modal */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-xl max-w-md w-full space-y-4 animate-scale-up">
            <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2 border-b border-slate-50 pb-2">
              <Highlighter className="text-blue-500" />
              <span>{language === 'vi' ? 'Thêm ghi chú' : 'Add Note to Highlight'}</span>
            </h4>
            <div className="space-y-3 text-xs">
              <p className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg font-medium text-slate-600 dark:text-slate-300 italic">
                "{selectionCoords?.text}"
              </p>
              <div>
                <label className="block text-slate-400 font-bold mb-1">{language === 'vi' ? 'Chọn màu sắc' : 'Select Color'}</label>
                <div className="flex gap-2">
                  {(['yellow', 'green', 'pink', 'blue'] as const).map(c => (
                    <button 
                      key={c}
                      onClick={() => setSelectedHighlightColor(c)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold capitalize ${
                        selectedHighlightColor === c 
                          ? 'bg-blue-50 text-blue-600 border-blue-200 font-bold' 
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-slate-400 font-bold mb-1">{language === 'vi' ? 'Nội dung ghi chú' : 'Note Content'}</label>
                <textarea 
                  value={noteText} 
                  onChange={e => setNoteText(e.target.value)} 
                  placeholder={language === 'vi' ? 'Nhập ghi chú của bạn...' : 'Enter your note...'}
                  rows={3} 
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" 
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 text-xs">
              <button 
                onClick={() => setShowNoteModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 dark:text-slate-400 hover:bg-slate-50 rounded-lg font-bold"
              >
                {language === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button 
                onClick={saveNoteHighlight}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold"
              >
                {language === 'vi' ? 'Lưu' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audio Error Explanation Modal */}
      {audioErrorModal?.show && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-55 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl max-w-lg w-full space-y-4 animate-scale-up">
            <h4 className="font-extrabold text-amber-600 dark:text-amber-400 text-base flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <AlertCircle size={20} className="stroke-[2.5]" />
              <span>{language === 'vi' ? 'Không thể phát âm thanh' : 'Unable to Play Audio'}</span>
            </h4>
            
            <div className="space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300 font-medium">
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                {language === 'vi' 
                  ? '⚠️ Bạn đang sử dụng tài khoản Google AI Studio mới (hoặc cơ sở dữ liệu mới).' 
                  : '⚠️ You are currently using a new Google AI Studio account (or a new database).'}
              </p>
              <p>
                {language === 'vi' ? audioErrorModal.messageVi : audioErrorModal.messageEn}
              </p>
              
              <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                <p className="font-bold text-indigo-600 dark:text-indigo-400">
                  {language === 'vi' ? '💡 Giải thích chi tiết:' : '💡 Detailed Explanation:'}
                </p>
                <p>
                  {language === 'vi' 
                    ? 'Hệ thống IELTS lưu trữ âm thanh chất lượng cao dưới dạng mã hóa nén cục bộ để tối ưu chi phí. Khi đổi tài khoản Google AI Studio, trình duyệt sẽ chạy ứng dụng dưới một URL/Domain mới hoàn toàn (khiến bộ nhớ IndexedDB cũ bị khóa do bảo mật) và Firestore Database mới chưa có dữ liệu đồng bộ của các tệp tin này.'
                    : 'The IELTS platform stores high-quality audio compressed locally to optimize cloud database limits. When you switch Google AI Studio accounts, the browser runs the app on a completely new URL/domain (which secures/blocks previous IndexedDB storage due to Same-Origin rules) and the new Firestore database does not yet have these cached assets.'}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button 
                onClick={() => setAudioErrorModal(null)}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 text-xs transition-all active:scale-95 cursor-pointer"
              >
                {language === 'vi' ? 'Đã hiểu' : 'I Understand'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header section of practice */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3.5 flex items-center justify-between gap-4 shadow-xs shrink-0 select-none z-30">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-rose-500 hover:text-white dark:hover:bg-rose-600 transition-all flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0 border border-slate-200 dark:border-slate-700 font-extrabold"
            title={language === 'vi' ? 'Thoát' : 'Exit'}
          >
            ✕
          </button>
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />
          
          {/* DOL English Logo Design */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
            <div className="flex items-center gap-1">
              <span className="text-[#e03a3a] font-black text-xl tracking-tighter font-sans">DOL</span>
              <span className="text-slate-900 dark:text-slate-100 text-[10px] font-bold tracking-tight uppercase leading-none">
                IELTS & SAT <br /> <span className="text-[#e03a3a] text-[9px]">ĐÌNH LỰC</span>
              </span>
            </div>
            <div className="h-4 w-px bg-slate-300 dark:bg-slate-600 hidden md:block" />
            <div className="flex flex-col">
              <span className="text-slate-900 dark:text-slate-100 font-extrabold text-xs tracking-tight">
                {language === 'vi' ? 'Làm bài' : 'Exam Workspace'}
              </span>
              <span className="text-slate-500 dark:text-slate-400 font-medium text-[10px] leading-none max-w-[280px] truncate">
                {exam.title}
              </span>
            </div>
          </div>
        </div>

        {!isSubmitted && (
          <div className="flex items-center gap-2 bg-[#fff1f0] dark:bg-red-950/20 border border-[#ffa39e] dark:border-red-900 px-3.5 py-1.5 rounded-full text-xs font-mono font-bold text-[#cf1322] dark:text-red-400 shadow-xs animate-fade-in shrink-0">
            <Clock size={15} className="animate-pulse text-[#e03a3a]" />
            <span className="text-[13px] tracking-tight">{formatTimer(timer)}</span>
          </div>
        )}
      </div>

      {!isSubmitted ? (
        /* ================= ACTIVE PRACTICE VIEW ================= */
        <div className="flex-1 flex flex-col bg-[#f8fafc] dark:bg-slate-950 pb-56 sm:pb-64 md:pb-72">
          <div className={(exam.type as string) === 'listening' ? "flex-1 p-6" : "flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 p-6"}>
          {/* LEFT SIDE: INSTRUCTION / AUDIO / PASSAGE / SPEAKING PROMPT */}
          {(exam.type as string) !== 'listening' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5 select-text">
            
            {/* Listening Section practice info / audio */}
            {(exam.type as string) === 'listening' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-sm text-indigo-700 flex items-center gap-2">
                    <Volume2 size={18} />
                    <span>{language === 'vi' ? `Listening Section ${currentSection}` : `Listening Section ${currentSection}`}</span>
                  </h4>
                  {/* Section tabs for Listening if practicing the whole test */}
                  {!selectedSection && exam.sections && (
                    <div className="flex gap-1.5">
                      {exam.sections.map(s => (
                        <button
                          key={s.sectionNumber}
                          onClick={() => {
                            setCurrentSection(s.sectionNumber);
                            setIsPlaying(false);
                            if (audioRef.current) audioRef.current.pause();
                          }}
                          className={`px-2.5 py-1 text-[10px] rounded font-bold transition-all ${
                            currentSection === s.sectionNumber
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          S{s.sectionNumber}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section Content & Audio */}
                {(() => {
                  const activeSec = exam.sections?.find(s => s.sectionNumber === currentSection);
                  if (!activeSec) return <div className="text-center p-6 text-xs text-slate-400">{language === 'vi' ? 'Đang cập nhật dữ liệu section này.' : 'Section details are updating.'}</div>;
                  
                  return (
                    <div className="space-y-4">
                      {activeSec.audioUrl ? (
                        !isSubmitted ? (
                          // TEST MODE: Autoplay, cannot pause
                          isPlaying ? (
                            <div className="bg-[#fff1f0] dark:bg-red-950/10 border border-[#ffa39e] dark:border-red-900/50 p-4 rounded-xl flex items-center justify-between gap-4 animate-pulse select-none">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[#ffccc7] dark:bg-red-900/30 flex items-center justify-center text-[#e03a3a] shrink-0">
                                  <Volume2 size={20} className="animate-bounce text-[#e03a3a]" />
                                </div>
                                <div>
                                  <span className="text-[10px] font-extrabold text-[#cf1322] dark:text-red-400 uppercase block">
                                    {language === 'vi' ? 'ĐANG PHÁT AUDIO TỰ ĐỘNG' : 'TEST AUDIO PLAYING'}
                                  </span>
                                  <p className="text-[11px] text-slate-600 dark:text-slate-400 font-bold mt-0.5 leading-snug">
                                    {language === 'vi' 
                                      ? 'Không thể tạm dừng/tua để đảm bảo tính trung thực như thi thật.' 
                                      : 'Pausing/seeking is disabled to simulate real test conditions.'}
                                  </p>
                                </div>
                              </div>
                              <button
                                disabled
                                className="p-3 bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 rounded-full shrink-0 cursor-not-allowed border border-slate-300 dark:border-slate-700"
                                title={language === 'vi' ? 'Không thể tạm dừng khi làm bài' : 'Cannot pause during exam'}
                              >
                                <Pause size={16} fill="currentColor" />
                              </button>
                            </div>
                          ) : (
                            <div className="bg-blue-50/60 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-950/40 p-4 rounded-xl flex items-center justify-between gap-4 select-none">
                              <div>
                                <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase block">
                                  {language === 'vi' ? 'BẮT ĐẦU NGHE AUDIO' : 'PLAY TEST AUDIO'}
                                </span>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  {language === 'vi' 
                                    ? 'Click nút bên phải để bắt đầu làm bài nghe.' 
                                    : 'Click the button to start the listening section.'}
                                </p>
                              </div>
                              <button
                                onClick={() => toggleAudio(activeSec.audioUrl || '')}
                                className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shrink-0 shadow-md shadow-blue-500/10 flex items-center justify-center cursor-pointer"
                                title={language === 'vi' ? 'Bắt đầu nghe' : 'Start Listening'}
                              >
                                <Play size={16} fill="white" />
                              </button>
                            </div>
                          )
                        ) : (
                          // REVIEW MODE: FULL PRACTICE PLAYER (Seek, pause, speed control)
                          <div className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 p-4.5 rounded-xl space-y-3 shadow-xs">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                                  {language === 'vi' ? 'LUYỆN TẬP NGHE LẠI' : 'AUDIO REVIEW & PRACTICE'}
                                </span>
                                <span className="text-[11px] text-slate-500 font-semibold mt-0.5">
                                  {language === 'vi' ? 'Bạn có thể tua, tạm dừng và đổi tốc độ nghe.' : 'Feel free to play, pause, seek, and adjust speed.'}
                                </span>
                              </div>
                              
                              <button
                                onClick={() => toggleAudio(activeSec.audioUrl || '')}
                                className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow-md transition-all shrink-0 cursor-pointer ${
                                  isPlaying 
                                    ? 'bg-[#e03a3a] hover:bg-[#c22d2d] shadow-red-500/10' 
                                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10'
                                }`}
                              >
                                {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                              </button>
                            </div>

                            {/* Seek slider */}
                            <div className="space-y-1 pt-1">
                              <input 
                                type="range"
                                min={0}
                                max={audioDuration || 100}
                                value={audioCurrentTime}
                                onChange={e => handleSeek(parseFloat(e.target.value))}
                                className="w-full accent-emerald-600 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                              />
                              <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-500">
                                <span>{formatTimer(Math.floor(audioCurrentTime))}</span>
                                <span>{formatTimer(Math.floor(audioDuration))}</span>
                              </div>
                            </div>

                            {/* Speed selector */}
                            <div className="flex items-center gap-2 pt-1.5 border-t border-slate-200/50 dark:border-slate-800/40">
                              <span className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-wider">
                                {language === 'vi' ? 'Tốc độ:' : 'Speed:'}
                              </span>
                              <div className="flex gap-1.5">
                                {([0.8, 1.0, 1.2, 1.5, 2.0] as const).map(speed => (
                                  <button
                                    key={speed}
                                    onClick={() => handleSpeedChange(speed)}
                                    className={`px-2 py-0.5 rounded text-[10px] font-black tracking-tight transition-all cursor-pointer ${
                                      audioPlaybackSpeed === speed
                                        ? 'bg-emerald-600 text-white font-extrabold border border-transparent'
                                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-750'
                                    }`}
                                  >
                                    {speed === 1.0 ? 'Normal' : `${speed}x`}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-center text-xs text-slate-400">
                          {language === 'vi' ? 'Không tìm thấy audio bài nghe' : 'Listening audio not found.'}
                        </div>
                      )}

                      {activeSec.imageUrl && (
                        <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-xs max-h-[350px] flex justify-center">
                          <CachedImage src={activeSec.imageUrl} alt={activeSec.title || "Section diagram"} className="max-h-[330px] w-auto object-contain rounded-lg" referrerPolicy="no-referrer" />
                        </div>
                      )}

                      <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 text-xs text-slate-500 space-y-1">
                        <p className="font-bold text-slate-700 dark:text-slate-300">{language === 'vi' ? 'Mẹo làm bài' : 'Tips'}</p>
                        <p>{language === 'vi' ? '• Hãy đọc kỹ câu hỏi bên phải trước khi nghe.' : '• Read questions carefully before listening.'}</p>
                        <p>{language === 'vi' ? '• Bạn có thể bôi đen văn bản nghe sau khi hoàn thành để xem dịch/từ vựng.' : '• You can highlight texts for transcripts after submit.'}</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Reading Passage content */}
            {exam.type === 'reading' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-sm text-emerald-700 flex items-center gap-2">
                    <FileText size={18} />
                    <span>{language === 'vi' ? `Reading Passage ${currentSection}` : `Reading Passage ${currentSection}`}</span>
                  </h4>
                  {exam.passages && (
                    <div className="flex gap-1.5">
                      {exam.passages.map(p => (
                        <button
                          key={p.passageNumber}
                          onClick={() => setCurrentSection(p.passageNumber)}
                          className={`px-2.5 py-1 text-[10px] rounded font-bold transition-all ${
                            currentSection === p.passageNumber
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          P{p.passageNumber}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {(() => {
                  const activePassage = exam.passages?.find(p => p.passageNumber === currentSection);
                  if (!activePassage) return <div className="text-center p-6 text-xs text-slate-400">{language === 'vi' ? 'Chưa có Passage từ Admin.' : 'No passages from Admin.'}</div>;
                  return (
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl text-sm md:text-base font-black text-indigo-700 uppercase tracking-wide">
                        {activePassage.title}
                      </div>
                      
                      {activePassage.imageUrl && (
                        <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-xs max-h-[350px] flex justify-center">
                          <CachedImage src={activePassage.imageUrl} alt={activePassage.title || "Passage diagram"} className="max-h-[330px] w-auto object-contain rounded-lg" referrerPolicy="no-referrer" />
                        </div>
                      )}

                      {activePassage.audioUrl && (
                        !isSubmitted ? (
                          // TEST MODE: Autoplay or play, cannot pause once playing
                          isPlaying ? (
                            <div className="bg-[#fff1f0] dark:bg-red-950/10 border border-[#ffa39e] dark:border-red-900/50 p-4 rounded-xl flex items-center justify-between gap-4 animate-pulse select-none">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[#ffccc7] dark:bg-red-900/30 flex items-center justify-center text-[#e03a3a] shrink-0">
                                  <Volume2 size={20} className="animate-bounce text-[#e03a3a]" />
                                </div>
                                <div>
                                  <span className="text-[10px] font-extrabold text-[#cf1322] dark:text-red-400 uppercase block">
                                    {language === 'vi' ? 'ĐANG PHÁT AUDIO TỰ ĐỘNG' : 'TEST AUDIO PLAYING'}
                                  </span>
                                  <p className="text-[11px] text-slate-600 dark:text-slate-400 font-bold mt-0.5 leading-snug">
                                    {language === 'vi' 
                                      ? 'Không thể tạm dừng/tua để đảm bảo tính trung thực như thi thật.' 
                                      : 'Pausing/seeking is disabled to simulate real test conditions.'}
                                  </p>
                                </div>
                              </div>
                              <button
                                disabled
                                className="p-3 bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 rounded-full shrink-0 cursor-not-allowed border border-slate-300 dark:border-slate-700"
                                title={language === 'vi' ? 'Không thể tạm dừng khi làm bài' : 'Cannot pause during exam'}
                              >
                                <Pause size={16} fill="currentColor" />
                              </button>
                            </div>
                          ) : (
                            <div className="bg-blue-50/60 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-950/40 p-4 rounded-xl flex items-center justify-between gap-4 select-none">
                              <div>
                                <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase block">
                                  {language === 'vi' ? 'BẮT ĐẦU NGHE AUDIO' : 'PLAY TEST AUDIO'}
                                </span>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  {language === 'vi' 
                                    ? 'Click nút bên phải để nghe đoạn băng hỗ trợ.' 
                                    : 'Click the button to start the accompanying audio track.'}
                                </p>
                              </div>
                              <button
                                onClick={() => toggleAudio(activePassage.audioUrl || '')}
                                className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shrink-0 shadow-md shadow-blue-500/10 flex items-center justify-center cursor-pointer"
                                title={language === 'vi' ? 'Bắt đầu nghe' : 'Start Listening'}
                              >
                                <Play size={16} fill="white" />
                              </button>
                            </div>
                          )
                        ) : (
                          // REVIEW MODE: FULL PRACTICE PLAYER (Seek, pause, speed control)
                          <div className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 p-4.5 rounded-xl space-y-3 shadow-xs">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                                  {language === 'vi' ? 'LUYỆN TẬP NGHE LẠI' : 'AUDIO REVIEW & PRACTICE'}
                                </span>
                                <span className="text-[11px] text-slate-500 font-semibold mt-0.5">
                                  {language === 'vi' ? 'Bạn có thể tua, tạm dừng và đổi tốc độ nghe.' : 'Feel free to play, pause, seek, and adjust speed.'}
                                </span>
                              </div>
                              
                              <button
                                onClick={() => toggleAudio(activePassage.audioUrl || '')}
                                className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow-md transition-all shrink-0 cursor-pointer ${
                                  isPlaying 
                                    ? 'bg-[#e03a3a] hover:bg-[#c22d2d] shadow-red-500/10' 
                                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10'
                                }`}
                              >
                                {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                              </button>
                            </div>

                            {/* Seek slider */}
                            <div className="space-y-1 pt-1">
                              <input 
                                type="range"
                                min={0}
                                max={audioDuration || 100}
                                value={audioCurrentTime}
                                onChange={e => handleSeek(parseFloat(e.target.value))}
                                className="w-full accent-emerald-600 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                              />
                              <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-500">
                                <span>{formatTimer(Math.floor(audioCurrentTime))}</span>
                                <span>{formatTimer(Math.floor(audioDuration))}</span>
                              </div>
                            </div>

                            {/* Speed selector */}
                            <div className="flex items-center gap-2 pt-1.5 border-t border-slate-200/50 dark:border-slate-800/40">
                              <span className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-wider">
                                {language === 'vi' ? 'Tốc độ:' : 'Speed:'}
                              </span>
                              <div className="flex gap-1.5">
                                {([0.8, 1.0, 1.2, 1.5, 2.0] as const).map(speed => (
                                  <button
                                    key={speed}
                                    onClick={() => handleSpeedChange(speed)}
                                    className={`px-2 py-0.5 rounded text-[10px] font-black tracking-tight transition-all cursor-pointer ${
                                      audioPlaybackSpeed === speed
                                        ? 'bg-emerald-600 text-white font-extrabold border border-transparent'
                                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-750'
                                    }`}
                                  >
                                    {speed === 1.0 ? 'Normal' : `${speed}x`}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )
                      )}

                      <div className="select-text">
                        {renderTextWithHighlights(activePassage.content)}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Writing Tasks content */}
            {exam.type === 'writing' && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentSection(1)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                      currentSection === 1 ? 'bg-amber-100 text-amber-800 border border-amber-200 font-bold' : 'bg-slate-50 text-slate-500'
                    }`}
                  >
                    Writing Task 1
                  </button>
                  <button
                    onClick={() => setCurrentSection(2)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                      currentSection === 2 ? 'bg-amber-100 text-amber-800 border border-amber-200 font-bold' : 'bg-slate-50 text-slate-500'
                    }`}
                  >
                    Writing Task 2
                  </button>
                </div>

                {currentSection === 1 ? (
                  <div className="space-y-4">
                    {exam.writingTask1?.imageUrl && (
                      <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-xs max-h-[350px] flex justify-center">
                        <CachedImage src={exam.writingTask1.imageUrl} alt="Task 1 diagram" className="max-h-[330px] w-auto object-contain rounded-lg" referrerPolicy="no-referrer" />
                      </div>
                    )}
                    {exam.writingTask1?.audioUrl && (
                      <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-950 p-4 rounded-xl flex items-center justify-between gap-4">
                        <div>
                          <span className="text-[10px] font-bold text-blue-700 uppercase block">{language === 'vi' ? 'Audio bài nghe Task 1' : 'Task 1 Audio'}</span>
                          <p className="text-xs text-slate-500 mt-0.5">{language === 'vi' ? 'Bấm nút để nghe đoạn băng.' : 'Click to play the audio section.'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleAudio(exam.writingTask1?.audioUrl || '')}
                          className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shrink-0 shadow-md shadow-blue-500/10 flex items-center justify-center cursor-pointer"
                        >
                          {isPlaying ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" />}
                        </button>
                      </div>
                    )}
                    <div className="p-5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 rounded-2xl">
                      <span className="text-xs font-black text-amber-700 uppercase block mb-1.5">TASK 1 PROMPT:</span>
                      <p className="text-sm md:text-base text-slate-700 dark:text-slate-300 font-semibold leading-relaxed whitespace-pre-wrap select-text">
                        {exam.writingTask1?.prompt || <span className="italic text-slate-400">{language === 'vi' ? 'Đang cập nhật.' : 'Updating...'}</span>}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {exam.writingTask2?.imageUrl && (
                      <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-xs max-h-[350px] flex justify-center">
                        <CachedImage src={exam.writingTask2.imageUrl} alt="Task 2 diagram" className="max-h-[330px] w-auto object-contain rounded-lg" referrerPolicy="no-referrer" />
                      </div>
                    )}
                    {exam.writingTask2?.audioUrl && (
                      <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-950 p-4 rounded-xl flex items-center justify-between gap-4">
                        <div>
                          <span className="text-[10px] font-bold text-blue-700 uppercase block">{language === 'vi' ? 'Audio bài nghe Task 2' : 'Task 2 Audio'}</span>
                          <p className="text-xs text-slate-500 mt-0.5">{language === 'vi' ? 'Bấm nút để nghe đoạn băng.' : 'Click to play the audio section.'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleAudio(exam.writingTask2?.audioUrl || '')}
                          className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shrink-0 shadow-md shadow-blue-500/10 flex items-center justify-center cursor-pointer"
                        >
                          {isPlaying ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" />}
                        </button>
                      </div>
                    )}
                    <div className="p-5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 rounded-2xl">
                      <span className="text-xs font-black text-amber-700 uppercase block mb-1.5">TASK 2 PROMPT:</span>
                      <p className="text-sm md:text-base text-slate-700 dark:text-slate-300 font-semibold leading-relaxed whitespace-pre-wrap select-text">
                        {exam.writingTask2?.prompt || <span className="italic text-slate-400">{language === 'vi' ? 'Đang cập nhật.' : 'Updating...'}</span>}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Speaking Prompt content */}
            {exam.type === 'speaking' && (
              <div className="space-y-4">
                <div className="flex gap-1.5">
                  {(['Part 1', 'Part 2', 'Part 3'] as const).map((part, idx) => (
                    <button
                      key={part}
                      onClick={() => setCurrentSection(idx + 1)}
                      className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${
                        currentSection === idx + 1 ? 'bg-purple-100 text-purple-800 border border-purple-200 font-bold shadow-xs' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {part}
                    </button>
                  ))}
                </div>

                {currentSection === 1 && (
                  <div className="space-y-4">
                    <h5 className="font-extrabold text-sm md:text-base text-purple-700 uppercase">Part 1: General Interview Topics</h5>
                    {exam.speakingPart1?.imageUrl && (
                      <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-xs max-h-[300px] flex justify-center">
                        <CachedImage src={exam.speakingPart1.imageUrl} alt="Part 1 Illustration" className="max-h-[280px] w-auto object-contain rounded-lg" referrerPolicy="no-referrer" />
                      </div>
                    )}
                    {exam.speakingPart1?.audioUrl && (
                      <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-950 p-4 rounded-xl flex items-center justify-between gap-4">
                        <div>
                          <span className="text-[10px] font-bold text-blue-700 uppercase block">{language === 'vi' ? 'Audio câu hỏi Part 1' : 'Part 1 Audio'}</span>
                          <p className="text-xs text-slate-500 mt-0.5">{language === 'vi' ? 'Bấm nút để nghe câu hỏi hoặc hướng dẫn.' : 'Click to play the cue or introduction.'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleAudio(exam.speakingPart1?.audioUrl || '')}
                          className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shrink-0 shadow-md shadow-blue-500/10 flex items-center justify-center cursor-pointer"
                        >
                          {isPlaying ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" />}
                        </button>
                      </div>
                    )}
                    {exam.speakingPart1?.topics && exam.speakingPart1.topics.length > 0 ? (
                      <ul className="space-y-3">
                        {exam.speakingPart1.topics.map((t, index) => (
                          <li key={index} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm md:text-base text-slate-700 dark:text-slate-300 flex gap-2.5 font-semibold select-text">
                            <span className="font-black text-purple-600">{index + 1}.</span>
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-400 italic">{language === 'vi' ? 'Đang cập nhật.' : 'Updating...'}</p>
                    )}
                  </div>
                )}

                {currentSection === 2 && (
                  <div className="space-y-4">
                    <h5 className="font-extrabold text-sm md:text-base text-purple-700 uppercase">Part 2: Cue Card (Long Turn)</h5>
                    {exam.speakingPart2?.imageUrl && (
                      <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-xs max-h-[300px] flex justify-center">
                        <CachedImage src={exam.speakingPart2.imageUrl} alt="Part 2 Cue Card Illustration" className="max-h-[280px] w-auto object-contain rounded-lg" referrerPolicy="no-referrer" />
                      </div>
                    )}
                    {exam.speakingPart2?.audioUrl && (
                      <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-950 p-4 rounded-xl flex items-center justify-between gap-4">
                        <div>
                          <span className="text-[10px] font-bold text-blue-700 uppercase block">{language === 'vi' ? 'Audio câu hỏi Part 2' : 'Part 2 Audio'}</span>
                          <p className="text-xs text-slate-500 mt-0.5">{language === 'vi' ? 'Bấm nút để nghe gợi ý.' : 'Click to play the cue audio.'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleAudio(exam.speakingPart2?.audioUrl || '')}
                          className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shrink-0 shadow-md shadow-blue-500/10 flex items-center justify-center cursor-pointer"
                        >
                          {isPlaying ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" />}
                        </button>
                      </div>
                    )}
                    <div className="p-5 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900 rounded-2xl">
                      <p className="text-sm md:text-base text-slate-700 dark:text-slate-300 font-semibold leading-relaxed whitespace-pre-wrap select-text">
                        {exam.speakingPart2?.topic || <span className="italic text-slate-400">{language === 'vi' ? 'Đang cập nhật.' : 'Updating...'}</span>}
                      </p>
                    </div>
                  </div>
                )}

                {currentSection === 3 && (
                  <div className="space-y-4">
                    <h5 className="font-extrabold text-sm md:text-base text-purple-700 uppercase">Part 3: Discussion Questions</h5>
                    {exam.speakingPart3?.imageUrl && (
                      <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-xs max-h-[300px] flex justify-center">
                        <CachedImage src={exam.speakingPart3.imageUrl} alt="Part 3 Illustration" className="max-h-[280px] w-auto object-contain rounded-lg" referrerPolicy="no-referrer" />
                      </div>
                    )}
                    {exam.speakingPart3?.audioUrl && (
                      <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-950 p-4 rounded-xl flex items-center justify-between gap-4">
                        <div>
                          <span className="text-[10px] font-bold text-blue-700 uppercase block">{language === 'vi' ? 'Audio câu hỏi Part 3' : 'Part 3 Audio'}</span>
                          <p className="text-xs text-slate-500 mt-0.5">{language === 'vi' ? 'Bấm nút để nghe câu hỏi thảo luận.' : 'Click to play the discussion questions audio.'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleAudio(exam.speakingPart3?.audioUrl || '')}
                          className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shrink-0 shadow-md shadow-blue-500/10 flex items-center justify-center cursor-pointer"
                        >
                          {isPlaying ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" />}
                        </button>
                      </div>
                    )}
                    {exam.speakingPart3?.topics && exam.speakingPart3.topics.length > 0 ? (
                      <ul className="space-y-3">
                        {exam.speakingPart3.topics.map((t, index) => (
                          <li key={index} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm md:text-base text-slate-700 dark:text-slate-300 flex gap-2.5 font-semibold select-text">
                            <span className="font-black text-purple-600">{index + 1}.</span>
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-400 italic">{language === 'vi' ? 'Đang cập nhật.' : 'Updating...'}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            </div>
          )}

          {/* RIGHT SIDE: ANSWER SHEET OR CENTERED LISTENING */}
          {(exam.type as string) === 'listening' ? (
            <div className="max-w-6xl mx-auto space-y-6 w-full text-left">
              {(() => {
                const activeSec = exam.sections?.find(s => s.sectionNumber === currentSection);
                if (!activeSec) return null;
                return (
                  <>
                    {activeSec.imageUrl && (
                      <div className="bg-white dark:bg-slate-900 p-4 border border-slate-200/60 dark:border-slate-800 rounded-2xl shadow-sm flex justify-center">
                        <CachedImage 
                          src={activeSec.imageUrl} 
                          alt={activeSec.title || "Section diagram"} 
                          className="max-h-[300px] w-auto object-contain rounded-lg border border-slate-100 dark:border-slate-800" 
                          referrerPolicy="no-referrer" 
                        />
                      </div>
                    )}
                    
                    {(activeSec as any).tips && (
                      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 p-4 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex gap-2.5 shadow-sm">
                        <Sparkles className="shrink-0 text-amber-500 mt-0.5" size={15} />
                        <div>
                          <strong className="block mb-0.5">{language === 'vi' ? 'Mẹo làm bài nghe:' : 'Listening Strategy:'}</strong>
                          <p className="opacity-90">{(activeSec as any).tips}</p>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-sm">
                {renderAnswerSheet()}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
            <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-50 dark:border-slate-800 pb-2.5">
              <CheckCircle2 className="text-emerald-500 shrink-0" size={16} />
              <span>{language === 'vi' ? 'Bảng Điền Đáp Án' : 'Answer Sheet'}</span>
            </h4>

             {/* Answer Layout for Listening & Reading */}
            {((exam.type as string) === 'listening' || exam.type === 'reading') && (
              <div className="space-y-4">
                {(() => {
                  let questionsToRender: Array<{ number: number; questionType: string; questionText: string; options?: string[]; correctAnswer?: string; questionInstruction?: string; explanation?: string }> = [];
                  let currentSecObj: any = null;

                  if ((exam.type as string) === 'listening') {
                    currentSecObj = exam.sections?.find(s => s.sectionNumber === currentSection);
                    questionsToRender = currentSecObj?.questions || [];
                  } else {
                    const currentPassageObj = exam.passages?.find(p => p.passageNumber === currentSection);
                    questionsToRender = currentPassageObj?.questions || [];
                  }

                  if (questionsToRender.length === 0) {
                    return (
                      <div className="text-center p-8 text-slate-400 text-xs">
                        {language === 'vi' ? 'Admin chưa nhập câu hỏi cho phần này.' : 'Admin has not added questions for this section.'}
                      </div>
                    );
                  }

                  const questionGroups = groupQuestions(questionsToRender);
                  const activeIndex = Math.min(activeGroupIndex, questionGroups.length - 1);
                  const currentActiveIdx = activeIndex >= 0 ? activeIndex : 0;
                  const activeGroup = questionGroups[currentActiveIdx];
                  const questionsInActiveGroup = activeGroup ? activeGroup.questions : [];

                  const activeType = activeGroup?.type || '';
                  const isTFGroup = isTFNGType(activeType, activeGroup?.questions[0]?.correctAnswer, questionsToRender);
                  const isYNGroup = isYNNGType(activeType, activeGroup?.questions[0]?.correctAnswer, questionsToRender);
                  const parsedGroupInstruction = questionsInActiveGroup[0]?.questionInstruction || '';

                  let instructionTitle = '';
                  let instructionDesc = '';
                  let instructionSteps: string[] = [];
                  let bannerColorClass = 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-300';
                  let bannerTitleColor = 'text-slate-800 dark:text-slate-100';

                  if (parsedGroupInstruction) {
                    instructionTitle = language === 'vi' ? `YÊU CẦU ĐỀ BÀI: ${activeType.toUpperCase()}` : `QUESTION INSTRUCTIONS: ${activeType.toUpperCase()}`;
                    instructionDesc = parsedGroupInstruction;
                    
                    if (isTFGroup) {
                      instructionSteps = [
                        language === 'vi' ? 'TRUE: Nếu thông tin trùng khớp hoàn toàn với bài đọc.' : 'TRUE: If the statement agrees with the information.',
                        language === 'vi' ? 'FALSE: Nếu thông tin trái ngược hoặc mâu thuẫn hoàn toàn với bài đọc.' : 'FALSE: If the statement contradicts the information.',
                        language === 'vi' ? 'NOT GIVEN: Nếu không có hoặc không đủ thông tin trong bài đọc.' : 'NOT GIVEN: If there is no information on this.'
                      ];
                      bannerColorClass = 'bg-rose-50 dark:bg-rose-950/25 border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-200';
                      bannerTitleColor = 'text-rose-900 dark:text-rose-100 font-black';
                    } else if (isYNGroup) {
                      instructionSteps = [
                        language === 'vi' ? 'YES: Nếu câu nhận định khớp với quan điểm của tác giả.' : 'YES: If the statement agrees with the writer claims.',
                        language === 'vi' ? 'NO: Nếu câu nhận định trái ngược với quan điểm của tác giả.' : 'NO: If the statement contradicts the writer claims.',
                        language === 'vi' ? 'NOT GIVEN: Nếu không có thông tin về quan điểm của tác giả.' : 'NOT GIVEN: If it is impossible to say what the writer thinks.'
                      ];
                      bannerColorClass = 'bg-indigo-50 dark:bg-indigo-950/25 border-indigo-200 dark:border-indigo-900/40 text-indigo-800 dark:text-indigo-200';
                      bannerTitleColor = 'text-indigo-900 dark:text-indigo-100 font-black';
                    } else {
                      instructionSteps = [
                        language === 'vi' ? 'Chú ý giới hạn từ (ví dụ: NO MORE THAN TWO WORDS) để tránh mất điểm.' : 'Pay attention to the word limit constraints to avoid losing marks.',
                        language === 'vi' ? 'Điền chính xác từ vựng hoặc chữ cái lựa chọn tương ứng từ bài thi.' : 'Write exact keywords or letters matching the original question context.'
                      ];
                      bannerColorClass = 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/35 text-blue-800 dark:text-blue-200';
                      bannerTitleColor = 'text-blue-900 dark:text-blue-100 font-black';
                    }
                  } else if (isTFGroup) {
                    instructionTitle = language === 'vi' ? 'HƯỚNG DẪN: TRUE / FALSE / NOT GIVEN' : 'GUIDELINES: TRUE / FALSE / NOT GIVEN';
                    instructionDesc = language === 'vi'
                      ? 'Xác định xem thông tin trong câu hỏi có trùng khớp với thông tin trong bài đọc không:'
                      : 'Determine if the statements agree with the information in the reading passage:';
                    instructionSteps = [
                      language === 'vi' ? 'TRUE: Nếu thông tin trùng khớp hoàn toàn với bài đọc.' : 'TRUE: If the statement agrees with the information.',
                      language === 'vi' ? 'FALSE: Nếu thông tin trái ngược hoặc mâu thuẫn hoàn toàn với bài đọc.' : 'FALSE: If the statement contradicts the information.',
                      language === 'vi' ? 'NOT GIVEN: Nếu không có hoặc không đủ thông tin trong bài đọc.' : 'NOT GIVEN: If there is no information on this.'
                    ];
                    bannerColorClass = 'bg-rose-50 dark:bg-rose-950/25 border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-200';
                    bannerTitleColor = 'text-rose-900 dark:text-rose-100 font-black';
                  } else if (isYNGroup) {
                    instructionTitle = language === 'vi' ? 'HƯỚNG DẪN: YES / NO / NOT GIVEN' : 'GUIDELINES: YES / NO / NOT GIVEN';
                    instructionDesc = language === 'vi'
                      ? 'Xác định xem câu nhận định có khớp với quan điểm hoặc khẳng định của tác giả không:'
                      : 'Determine if the statements agree with the claims or views of the writer:';
                    instructionSteps = [
                      language === 'vi' ? 'YES: Nếu câu nhận định khớp với quan điểm của tác giả.' : 'YES: If the statement agrees with the writer claims.',
                      language === 'vi' ? 'NO: Nếu câu nhận định trái ngược với quan điểm của tác giả.' : 'NO: If the statement contradicts the writer claims.',
                      language === 'vi' ? 'NOT GIVEN: Nếu không có thông tin về quan điểm của tác giả.' : 'NOT GIVEN: If it is impossible to say what the writer thinks.'
                    ];
                    bannerColorClass = 'bg-indigo-50 dark:bg-indigo-950/25 border-indigo-200 dark:border-indigo-900/40 text-indigo-800 dark:text-indigo-200';
                    bannerTitleColor = 'text-indigo-900 dark:text-indigo-100 font-black';
                  } else {
                    instructionTitle = `${language === 'vi' ? 'HƯỚNG DẪN' : 'GUIDELINES'}: ${activeType.toUpperCase()}`;
                    if (activeType.toLowerCase().includes('completion')) {
                      instructionDesc = language === 'vi'
                        ? 'Điền từ thích hợp vào chỗ trống:'
                        : 'Fill in the blanks with appropriate words:';
                      instructionSteps = [
                        language === 'vi' ? 'Đọc kỹ giới hạn số từ (Ví dụ: NO MORE THAN TWO WORDS).' : 'Pay close attention to word limit restrictions.',
                        language === 'vi' ? 'Từ điền phải được lấy trực tiếp từ bài đọc/bài nghe.' : 'Words must be extracted directly from the text/audio.',
                        language === 'vi' ? 'Chú ý đúng ngữ pháp và chính tả của từ cần điền.' : 'Check spelling and grammar agreements.'
                      ];
                    } else if (activeType.toLowerCase().includes('choice')) {
                      instructionDesc = language === 'vi'
                        ? 'Chọn đáp án đúng nhất từ các lựa chọn cho sẵn:'
                        : 'Choose the best answer from the given options:';
                      instructionSteps = [
                        language === 'vi' ? 'Đọc kỹ câu hỏi và xác định từ khóa chính.' : 'Read questions carefully and identify key terms.',
                        language === 'vi' ? 'Loại trừ các phương án gây nhiễu rõ ràng trước.' : 'Eliminate obviously incorrect distractor options first.',
                        language === 'vi' ? 'Tìm đoạn thông tin liên quan trong bài để đối chiếu.' : 'Locate corresponding details in the text to match.'
                      ];
                    } else {
                      instructionDesc = language === 'vi'
                        ? 'Đọc kỹ yêu cầu đề bài và hoàn thành câu hỏi:'
                        : 'Read the task requirements carefully and complete:';
                      instructionSteps = [
                        language === 'vi' ? 'Đảm bảo điền đúng định dạng câu trả lời.' : 'Ensure the correct answer format.',
                        language === 'vi' ? 'Đối chiếu kỹ thông tin gốc để tránh lỗi sai không đáng có.' : 'Cross-check the original content to prevent errors.'
                      ];
                    }
                    bannerColorClass = 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/35 text-amber-800 dark:text-amber-200';
                    bannerTitleColor = 'text-amber-900 dark:text-amber-100 font-black';
                  }

                  return (
                    <div className="space-y-4">
                      {/* Horizontal Scrollable Question Group Tabs */}
                      {questionGroups.length > 1 && (
                        <div className="flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800/60 pb-2.5 overflow-x-auto no-scrollbar scroll-smooth">
                          {questionGroups.map((group, idx) => {
                            const isActive = idx === currentActiveIdx;
                            return (
                              <button
                                key={group.id}
                                type="button"
                                onClick={() => setActiveGroupIndex(idx)}
                                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all shrink-0 cursor-pointer flex flex-col items-start gap-0.5 min-w-[100px] ${
                                  isActive
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/15'
                                    : 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800/40'
                                }`}
                              >
                                <span className="text-[9px] uppercase tracking-wider opacity-75">
                                  {language === 'vi' ? `Dạng ${idx + 1}` : `Group ${idx + 1}`}
                                </span>
                                <span className="text-xs font-black">{group.rangeText}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Tailored Instruction Banner for Active Group */}
                      {(exam.type as string) === 'listening' || exam.type === 'reading' ? (
                        <div className="bg-[#e03a3a] text-white rounded-xl p-4.5 mb-5 shadow-xs animate-fade-in select-none">
                          <div className="text-[11px] font-extrabold tracking-wider opacity-90 uppercase">
                            Question {activeGroup?.rangeText || `${questionsInActiveGroup[0]?.number} - ${questionsInActiveGroup[questionsInActiveGroup.length - 1]?.number}`}
                          </div>
                          <div className="text-sm font-black mt-1 leading-snug">
                            {instructionDesc}
                          </div>
                          {instructionSteps && instructionSteps.length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-white/20 text-[10px] font-bold flex flex-col gap-1 opacity-90">
                              {instructionSteps.map((step, idx) => (
                                <div key={idx} className="flex items-start gap-1.5">
                                  <span>•</span>
                                  <span>{step}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className={`p-4 rounded-2xl border text-[11px] leading-relaxed space-y-2.5 shadow-xs mb-3 animate-fade-in ${bannerColorClass}`}>
                          <div className="flex items-center gap-1.5">
                            <Sparkles className="shrink-0 text-amber-500 animate-pulse" size={13} />
                            <div className={`font-extrabold uppercase text-[10px] tracking-wider ${bannerTitleColor}`}>
                              {instructionTitle}
                            </div>
                          </div>
                          <p className="font-bold text-xs leading-snug">
                            {instructionDesc}
                          </p>
                          <div className="grid grid-cols-1 gap-1.5 border-t border-slate-200/50 dark:border-slate-800/40 pt-2 text-[10px] font-semibold opacity-90">
                            {instructionSteps.map((step, idx) => (
                              <div key={idx} className="flex items-start gap-1">
                                <span className="text-blue-500 mr-1">•</span>
                                <span>{step}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Questions of Active Group */}
                      {(exam.type as string) === 'listening' ? (
                        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 md:p-8 shadow-xs space-y-4">
                          {/* Inner Section Header */}
                          <div className="border-b border-slate-100 dark:border-slate-800/80 pb-3 mb-2.5">
                            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1.5">
                              <span className="w-1.5 h-3 bg-indigo-600 rounded-xs" />
                              {currentSecObj?.title || (language === 'vi' ? 'Nội dung câu hỏi' : 'Question Sheet')}
                            </h3>
                          </div>

                          <div className="space-y-3">
                            {questionsInActiveGroup.map(q => {
                              const hasOptions = q.options && q.options.length > 0;
                              const isTF = isTFNGType(q.questionType, q.correctAnswer, questionsToRender);
                              const isYN = isYNNGType(q.questionType, q.correctAnswer, questionsToRender);
                              const blankRegex = /_{3,}|\.{3,}/g;
                              const hasBlanks = blankRegex.test(q.questionText);

                              return (
                                <div 
                                  key={q.number} 
                                  id={`question-card-${q.number}`}
                                  className="py-3 border-b border-slate-50 dark:border-slate-850 last:border-b-0 space-y-3 text-sm md:text-base scroll-mt-6 transition-all"
                                >
                                  <div className="flex items-start gap-2.5 flex-wrap">
                                    {/* Bullet dot indicator to make it look like a list */}
                                    <span className="text-slate-400 select-none mt-0.5">•</span>

                                    {!hasBlanks && (
                                      <span className="font-extrabold text-blue-600 bg-blue-50 dark:bg-blue-950 px-3 py-1.5 rounded-lg text-xs shrink-0 mt-0.5 border border-blue-100 dark:border-blue-900">
                                        Q {q.number}
                                      </span>
                                    )}
                                    {hasBlanks ? (
                                      (() => {
                                        const parts = q.questionText.split(blankRegex);
                                        return (
                                          <span className="font-semibold text-slate-700 dark:text-slate-300 leading-relaxed inline-flex flex-wrap items-center gap-1.5 select-text">
                                            {parts.map((part, index) => (
                                              <React.Fragment key={index}>
                                                {index > 0 && (
                                                  <span className="inline-flex items-center mx-1 select-none">
                                                    <span className="text-[#1a73e8] dark:text-blue-400 font-extrabold text-sm shrink-0 mr-1.5">
                                                      {q.number}.
                                                    </span>
                                                    <span className="relative inline-block w-36">
                                                      <input
                                                        type="text"
                                                        placeholder=""
                                                        value={answers[q.number] || ''}
                                                        onChange={e => setAnswers({ ...answers, [q.number]: e.target.value })}
                                                        className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-md px-3 h-9 focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-sm font-black text-center text-[#1a73e8] dark:text-blue-300 transition-all"
                                                      />
                                                    </span>
                                                  </span>
                                                )}
                                                <span>{highlightText(part)}</span>
                                              </React.Fragment>
                                            ))}
                                          </span>
                                        );
                                      })()
                                    ) : (
                                      <span className="font-semibold text-slate-700 dark:text-slate-300 leading-normal select-text">{highlightText(q.questionText)}</span>
                                    )}
                                  </div>

                                  {/* Options if Multiple Choice */}
                                  {hasOptions ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pl-5">
                                      {q.options!.map((opt, oIdx) => {
                                        const optionLetter = String.fromCharCode(65 + oIdx); // A, B, C, D
                                        const isSelected = answers[q.number] === optionLetter;
                                        return (
                                          <button
                                            key={oIdx}
                                            type="button"
                                            onClick={() => setAnswers({ ...answers, [q.number]: optionLetter })}
                                            className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 font-semibold text-sm cursor-pointer ${
                                              isSelected
                                                ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300 font-semibold shadow-xs'
                                                : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                                            }`}
                                          >
                                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                                              isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                            }`}>
                                              {optionLetter}
                                            </span>
                                            <span>{opt}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : isTF ? (
                                    <div className="grid grid-cols-3 gap-3 mt-3 pl-5">
                                      {['True', 'False', 'Not given'].map((label) => {
                                        const optValue = label.toUpperCase();
                                        const isSelected = (answers[q.number] || '').toUpperCase() === optValue;
                                        return (
                                          <button
                                            key={label}
                                            type="button"
                                            onClick={() => setAnswers({ ...answers, [q.number]: optValue })}
                                            className={`py-3 px-1.5 rounded-xl border text-center transition-all font-extrabold text-xs sm:text-sm cursor-pointer ${
                                              isSelected
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-400 hover:bg-slate-50'
                                            }`}
                                          >
                                            {label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : isYN ? (
                                    <div className="grid grid-cols-3 gap-3 mt-3 pl-5">
                                      {['Yes', 'No', 'Not given'].map((label) => {
                                        const optValue = label.toUpperCase();
                                        const isSelected = (answers[q.number] || '').toUpperCase() === optValue;
                                        return (
                                          <button
                                            key={label}
                                            type="button"
                                            onClick={() => setAnswers({ ...answers, [q.number]: optValue })}
                                            className={`py-3 px-1.5 rounded-xl border text-center transition-all font-extrabold text-xs sm:text-sm cursor-pointer ${
                                              isSelected
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-400 hover:bg-slate-50'
                                            }`}
                                          >
                                            {label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : hasBlanks ? null : (
                                    <div className="mt-1.5 pl-5">
                                      <input
                                        type="text"
                                        placeholder={language === 'vi' ? 'Nhập câu trả lời...' : 'Type answer...'}
                                        value={answers[q.number] || ''}
                                        onChange={e => setAnswers({ ...answers, [q.number]: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-slate-800 dark:text-slate-100"
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {questionsInActiveGroup.map(q => {
                            const hasOptions = q.options && q.options.length > 0;
                            const isTF = isTFNGType(q.questionType, q.correctAnswer, questionsToRender);
                            const isYN = isYNNGType(q.questionType, q.correctAnswer, questionsToRender);
                            const blankRegex = /_{3,}|\.{3,}/g;
                            const hasBlanks = blankRegex.test(q.questionText);

                            return (
                              <div 
                                key={q.number} 
                                id={`question-card-${q.number}`}
                                className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/60 space-y-4 text-sm md:text-base scroll-mt-6 transition-all hover:shadow-xs"
                              >
                                <div className="flex items-start gap-2.5 flex-wrap">
                                  {!hasBlanks && (
                                    <span className="font-extrabold text-blue-600 bg-blue-50 dark:bg-blue-950 px-3 py-1.5 rounded-lg text-xs shrink-0 mt-0.5 border border-blue-100 dark:border-blue-900">
                                      Q {q.number}
                                    </span>
                                  )}
                                  {hasBlanks ? (
                                    (() => {
                                      const parts = q.questionText.split(blankRegex);
                                      return (
                                        <span className="font-bold text-slate-700 dark:text-slate-300 leading-relaxed inline-flex flex-wrap items-center gap-1.5 select-text">
                                          {parts.map((part, index) => (
                                            <React.Fragment key={index}>
                                              {index > 0 && (
                                                <span className="inline-flex items-center mx-1 select-none">
                                                  <span className="text-[#1a73e8] dark:text-blue-400 font-extrabold text-sm shrink-0 mr-1.5">
                                                    {q.number}.
                                                  </span>
                                                  <span className="relative inline-block w-36">
                                                    <input
                                                      type="text"
                                                      placeholder=""
                                                      value={answers[q.number] || ''}
                                                      onChange={e => setAnswers({ ...answers, [q.number]: e.target.value })}
                                                      className="w-full bg-[#edf2f7] dark:bg-slate-800 border-none rounded-md px-3 h-9 focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-sm font-black text-center text-[#1a73e8] dark:text-blue-300"
                                                    />
                                                  </span>
                                                </span>
                                              )}
                                              <span>{highlightText(part)}</span>
                                            </React.Fragment>
                                          ))}
                                        </span>
                                      );
                                    })()
                                  ) : (
                                    <span className="font-semibold text-slate-700 dark:text-slate-300 leading-normal select-text">{highlightText(q.questionText)}</span>
                                  )}
                                </div>

                                {/* Options if Multiple Choice */}
                                {hasOptions ? (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                                    {q.options!.map((opt, oIdx) => {
                                      const optionLetter = String.fromCharCode(65 + oIdx); // A, B, C, D
                                      const isSelected = answers[q.number] === optionLetter;
                                      return (
                                        <button
                                          key={oIdx}
                                          type="button"
                                          onClick={() => setAnswers({ ...answers, [q.number]: optionLetter })}
                                          className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 font-semibold text-sm cursor-pointer ${
                                            isSelected
                                              ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300'
                                              : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 hover:border-slate-250'
                                          }`}
                                        >
                                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                                            isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                          }`}>
                                            {optionLetter}
                                          </span>
                                          <span>{opt}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : isTF ? (
                                  <div className="grid grid-cols-3 gap-3 mt-3">
                                    {['True', 'False', 'Not given'].map((label) => {
                                      const optValue = label.toUpperCase();
                                      const isSelected = (answers[q.number] || '').toUpperCase() === optValue;
                                      return (
                                        <button
                                          key={label}
                                          type="button"
                                          onClick={() => setAnswers({ ...answers, [q.number]: optValue })}
                                          className={`py-3 px-1.5 rounded-xl border text-center transition-all font-extrabold text-xs sm:text-sm cursor-pointer ${
                                            isSelected
                                              ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/10'
                                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                          }`}
                                        >
                                          {label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : isYN ? (
                                  <div className="grid grid-cols-3 gap-3 mt-3">
                                    {['Yes', 'No', 'Not given'].map((label) => {
                                      const optValue = label.toUpperCase();
                                      const isSelected = (answers[q.number] || '').toUpperCase() === optValue;
                                      return (
                                        <button
                                          key={label}
                                          type="button"
                                          onClick={() => setAnswers({ ...answers, [q.number]: optValue })}
                                          className={`py-3 px-1.5 rounded-xl border text-center transition-all font-extrabold text-xs sm:text-sm cursor-pointer ${
                                            isSelected
                                              ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/10'
                                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                          }`}
                                        >
                                          {label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : hasBlanks ? null : (
                                  <div className="mt-1.5">
                                    <input
                                      type="text"
                                      placeholder={language === 'vi' ? 'Nhập câu trả lời...' : 'Type answer...'}
                                      value={answers[q.number] || ''}
                                      onChange={e => setAnswers({ ...answers, [q.number]: e.target.value })}
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-slate-800 dark:text-slate-100"
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Navigation buttons between question groups */}
                      {questionGroups.length > 1 && (
                        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4 mt-6">
                          <button
                            type="button"
                            disabled={currentActiveIdx === 0}
                            onClick={() => setActiveGroupIndex(prev => Math.max(0, prev - 1))}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                              currentActiveIdx === 0
                                ? 'border-slate-100 text-slate-300 dark:border-slate-800 dark:text-slate-700 cursor-not-allowed'
                                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer'
                            }`}
                          >
                            <ArrowLeft size={14} />
                            <span>{language === 'vi' ? 'Dạng trước' : 'Prev'}</span>
                          </button>

                          <div className="text-slate-400 dark:text-slate-500 text-[11px] font-bold">
                            {language === 'vi' 
                              ? `Dạng ${currentActiveIdx + 1} / ${questionGroups.length}`
                              : `Group ${currentActiveIdx + 1} of ${questionGroups.length}`}
                          </div>

                          <button
                            type="button"
                            disabled={currentActiveIdx === questionGroups.length - 1}
                            onClick={() => setActiveGroupIndex(prev => Math.min(questionGroups.length - 1, prev + 1))}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                              currentActiveIdx === questionGroups.length - 1
                                ? 'border-slate-100 text-slate-300 dark:border-slate-800 dark:text-slate-700 cursor-not-allowed'
                                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer'
                            }`}
                          >
                            <span>{language === 'vi' ? 'Dạng tiếp' : 'Next'}</span>
                            <ArrowRight size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Answer Layout for Writing */}
            {exam.type === 'writing' && (
              <div className="space-y-4">
                {currentSection === 1 ? (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Your Task 1 Response:</label>
                    <textarea
                      placeholder="Write your response for Task 1 here..."
                      rows={12}
                      value={essayText1}
                      onChange={e => setEssayText1(e.target.value)}
                      className="w-full p-4 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <div className="text-right text-[10px] font-bold text-slate-400">
                      {language === 'vi' ? 'Số từ:' : 'Word count:'} {essayText1.trim() === '' ? 0 : essayText1.trim().split(/\s+/).length}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Your Task 2 Response:</label>
                    <textarea
                      placeholder="Write your response for Task 2 here..."
                      rows={12}
                      value={essayText2}
                      onChange={e => setEssayText2(e.target.value)}
                      className="w-full p-4 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <div className="text-right text-[10px] font-bold text-slate-400">
                      {language === 'vi' ? 'Số từ:' : 'Word count:'} {essayText2.trim() === '' ? 0 : essayText2.trim().split(/\s+/).length}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Answer Layout for Speaking (recording simulation / notes) */}
            {exam.type === 'speaking' && (
              <div className="space-y-5 text-center py-6">
                <div className="w-16 h-16 rounded-full bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900 flex items-center justify-center mx-auto animate-pulse">
                  <Mic size={32} className="text-rose-600" />
                </div>
                <div>
                  <span className="inline-flex items-center gap-1.5 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-full text-xs font-bold animate-pulse">
                    ● {language === 'vi' ? 'Hệ thống đang thu âm...' : 'System is recording...'}
                  </span>
                  <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto">
                    {language === 'vi' 
                      ? 'Nói vào micro để trả lời chủ đề bài nói. Bạn có thể sử dụng bảng dưới đây để phác thảo dàn ý (Cue Card).'
                      : 'Speak into your microphone. You can use the outline pad below to plan your cue card.'}
                  </p>
                </div>

                <div className="space-y-1 text-left">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">{language === 'vi' ? 'Phác thảo dàn ý nói' : 'Outline & Notes:'}</label>
                  <textarea
                    placeholder={language === 'vi' ? 'Nhập dàn ý nói của bạn tại đây...' : 'Draft your notes here...'}
                    rows={5}
                    value={speakingNotes}
                    onChange={e => setSpeakingNotes(e.target.value)}
                    className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            )}

            {/* Submitting Block */}
            {!isFullTestMode && (
              <div className="pt-4 border-t border-slate-50 dark:border-slate-800 flex items-center justify-end gap-3 text-xs">
                <button
                  type="button"
                  onClick={onBack}
                  className="px-4 py-2 border border-slate-250 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl font-bold cursor-pointer"
                >
                  {language === 'vi' ? 'Hủy bỏ' : 'Cancel'}
                </button>
              </div>
            )}

          </div>
          )}
        </div>

        {/* BOTTOM GLOBAL NAVIGATION FOOTER BAR */}
        {(() => {
          let questionsToRender: any[] = [];
          let progress = { answered: 0, total: 0 };

          if (exam.type === 'listening') {
            const currentSecObj = exam.sections?.find(s => s.sectionNumber === currentSection);
            questionsToRender = currentSecObj?.questions || [];
            progress = getListeningSectionProgress(currentSection);
          } else if (exam.type === 'reading') {
            const currentPassageObj = exam.passages?.find(p => p.passageNumber === currentSection);
            questionsToRender = currentPassageObj?.questions || [];
            progress = getSectionProgress(currentSection);
          }

          return (
            <div className="fixed bottom-4 left-4 right-4 md:left-6 md:right-6 lg:left-8 lg:right-8 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl select-none animate-fade-in flex flex-col overflow-hidden max-w-[1600px] mx-auto">
              {/* Row 1: Collapsible Question Quick Jump Grid */}
              {isNavExpanded && questionsToRender.length > 0 && (
                <div className="px-5 py-3 lg:py-4 bg-slate-50 dark:bg-slate-850/60 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-1.5 lg:gap-2 max-h-24 sm:max-h-36 overflow-y-auto custom-scrollbar">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                      {language === 'vi' ? 'Chuyển nhanh đến câu hỏi:' : 'Jump to question:'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    {questionsToRender.map(q => {
                      const hasAns = (answers[q.number] || '').trim() !== '';
                      return (
                        <button
                          key={q.number}
                          onClick={() => {
                            document.getElementById(`question-card-${q.number}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black transition-all cursor-pointer ${
                            hasAns 
                              ? 'bg-[#e6f7ff] border border-[#91d5ff] text-[#1890ff] dark:bg-blue-950/40 dark:border-blue-900/40 dark:text-blue-300' 
                              : 'bg-white border border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-750'
                          }`}
                          title={`${language === 'vi' ? 'Câu' : 'Question'} ${q.number}`}
                        >
                          {q.number}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Row 2: Navigation and Action Footer */}
              <div className="px-6 py-4 flex flex-col lg:flex-row items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800">
                {/* Left side: Navigation Toggle and Done Count */}
                <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-start">
                  {questionsToRender.length > 0 && (
                    <button
                      onClick={() => setIsNavExpanded(!isNavExpanded)}
                      className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors flex items-center justify-center border border-slate-200 dark:border-slate-750 shrink-0 cursor-pointer text-xs font-bold gap-1.5"
                      title={isNavExpanded ? "Collapse panel" : "Expand panel"}
                    >
                      <LayoutGrid size={15} />
                      {isNavExpanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                    </button>
                  )}
                  
                  <div className="flex flex-col text-left">
                    <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 dark:text-slate-500 leading-none">
                      {exam.type === 'listening' 
                        ? (language === 'vi' ? `Phần nghe ${currentSection}` : `Section ${currentSection}`) 
                        : (language === 'vi' ? `Bài đọc ${currentSection}` : `Passage ${currentSection}`)}
                    </span>
                    {questionsToRender.length > 0 && (
                      <span className="text-xs font-black text-slate-700 dark:text-slate-200 leading-tight mt-1">
                        {language === 'vi' ? `Đã làm ${progress.answered}/${progress.total}` : `Done ${progress.answered}/${progress.total}`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Middle: Integrated High-Fidelity Embedded Audio Player */}
                {(() => {
                  const activeAudioUrl = getActiveAudioUrl();
                  if (!activeAudioUrl) return <div className="hidden lg:block flex-1" />;

                  return (
                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/60 px-4 py-2 rounded-2xl border border-slate-200/60 dark:border-slate-750/60 shadow-inner max-w-md w-full shrink-0 mx-auto justify-center select-none animate-fade-in">
                      {!isSubmitted ? (
                        isPlaying ? (
                          <div className="flex items-center gap-3.5 py-1">
                            <Volume2 className="text-[#e03a3a] animate-bounce shrink-0" size={16} />
                            <div className="text-left">
                              <span className="text-[10px] font-black text-[#cf1322] dark:text-red-400 uppercase tracking-widest whitespace-nowrap animate-pulse">
                                {language === 'vi' ? 'ĐANG PHÁT AUDIO' : 'AUDIO PLAYING'}
                              </span>
                              <span className="text-[9px] text-slate-400 dark:text-slate-500 block leading-tight font-semibold">
                                {language === 'vi' ? 'Không thể tua hoặc tạm dừng âm thanh' : 'Seeking & pausing is disabled'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleAudio(activeAudioUrl)}
                            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all hover:scale-[1.02] flex items-center gap-2 cursor-pointer shadow-sm shadow-blue-500/10"
                          >
                            <Play size={12} fill="currentColor" />
                            <span>{language === 'vi' ? 'BẮT ĐẦU NGHE AUDIO' : 'START PLAYING AUDIO'}</span>
                          </button>
                        )
                      ) : (
                        <div className="flex items-center gap-3 w-full">
                          <button
                            type="button"
                            onClick={() => toggleAudio(activeAudioUrl)}
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-white transition-all shrink-0 cursor-pointer shadow-sm ${
                              isPlaying ? 'bg-[#e03a3a] hover:bg-[#c22d2d]' : 'bg-emerald-600 hover:bg-emerald-700'
                            }`}
                          >
                            {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                          </button>
                          
                          <div className="flex-1 flex items-center gap-2">
                            <span className="text-[9px] font-mono font-bold text-slate-500">{formatTimer(Math.floor(audioCurrentTime))}</span>
                            <input 
                              type="range"
                              min={0}
                              max={audioDuration || 100}
                              value={audioCurrentTime}
                              onChange={e => handleSeek(parseFloat(e.target.value))}
                              className="flex-1 accent-emerald-600 h-1 bg-slate-200 dark:bg-slate-750 rounded-lg cursor-pointer"
                            />
                            <span className="text-[9px] font-mono font-bold text-slate-500">{formatTimer(Math.floor(audioDuration))}</span>
                          </div>
                          
                          <div className="flex gap-1 shrink-0">
                            {([1.0, 1.2, 1.5] as const).map(speed => (
                              <button
                                key={speed}
                                type="button"
                                onClick={() => handleSpeedChange(speed)}
                                className={`px-1.5 py-0.5 rounded text-[8px] font-black transition-all cursor-pointer ${
                                  audioPlaybackSpeed === speed
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-white dark:bg-slate-900 text-slate-500 border border-slate-100 dark:border-slate-800 hover:bg-slate-50'
                                }`}
                              >
                                {speed}x
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Right side: Section Pills and Action buttons */}
                <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end shrink-0">
                  {/* Small Section Tabs Indicator/Pills inside footer */}
                  <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-slate-150 dark:border-slate-750">
                    {exam.type === 'reading' && exam.passages?.map(p => (
                      <button
                        key={p.passageNumber}
                        onClick={() => setCurrentSection(p.passageNumber)}
                        className={`px-2.5 py-1 text-[10px] rounded-lg font-extrabold transition-all cursor-pointer ${
                          currentSection === p.passageNumber
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        P{p.passageNumber}
                      </button>
                    ))}

                    {exam.type === 'listening' && exam.sections?.map(s => (
                      <button
                        key={s.sectionNumber}
                        onClick={() => {
                          setCurrentSection(s.sectionNumber);
                          setIsPlaying(false);
                          if (audioRef.current) audioRef.current.pause();
                        }}
                        className={`px-2.5 py-1 text-[10px] rounded-lg font-extrabold transition-all cursor-pointer ${
                          currentSection === s.sectionNumber
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        S{s.sectionNumber}
                      </button>
                    ))}

                    {exam.type === 'writing' && [1, 2].map(num => (
                      <button
                        key={num}
                        onClick={() => setCurrentSection(num)}
                        className={`px-2.5 py-1 text-[10px] rounded-lg font-extrabold transition-all cursor-pointer ${
                          currentSection === num
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        T{num}
                      </button>
                    ))}

                    {exam.type === 'speaking' && [1, 2, 3].map(num => (
                      <button
                        key={num}
                        onClick={() => {
                          setCurrentSection(num);
                          setIsPlaying(false);
                          if (audioRef.current) audioRef.current.pause();
                        }}
                        className={`px-2.5 py-1 text-[10px] rounded-lg font-extrabold transition-all cursor-pointer ${
                          currentSection === num
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        P{num}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    {currentSection > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentSection(currentSection - 1);
                          if (exam.type === 'listening') {
                            setIsPlaying(false);
                            if (audioRef.current) audioRef.current.pause();
                          }
                        }}
                        className="px-3.5 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <ChevronLeft size={13} />
                        <span>{language === 'vi' ? 'Trước' : 'Back'}</span>
                      </button>
                    )}

                     {currentSection < totalSections ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentSection(currentSection + 1);
                            if (exam.type === 'listening') {
                              setIsPlaying(false);
                              if (audioRef.current) audioRef.current.pause();
                            }
                          }}
                          className="px-4 py-1.5 bg-[#e03a3a] hover:bg-[#c22d2d] text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all hover:shadow-xs flex items-center gap-1 cursor-pointer"
                        >
                          <span>{language === 'vi' ? 'Tiếp' : 'Next'}</span>
                          <ChevronRight size={13} />
                        </button>
                        
                        <button
                          type="button"
                          onClick={handleSubmit}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                          title={language === 'vi' ? 'Nộp bài thi ngay' : 'Submit test now'}
                        >
                          <CheckCircle2 size={13} />
                          <span>{language === 'vi' ? 'Nộp bài' : 'Submit'}</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSubmit}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-[#059669] text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all hover:shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 size={13} />
                        <span>{language === 'vi' ? 'Nộp bài' : 'Submit'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      </div>
      ) : (
        /* ================= PRACTICE RESULTS VIEW ================= */
        <div className="space-y-6 animate-fade-in">
          {!viewingDetailedExplanation ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-8 shadow-xl max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-8 relative overflow-hidden text-left">
              {/* Background gradient decor */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-rose-400/5 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-400/5 rounded-full blur-3xl pointer-events-none" />
              
              {/* Left Score Gauge and Stats */}
              <div className="w-full md:w-1/2 space-y-6">
                <div>
                  {(() => {
                    let questionsToRender: any[] = [];
                    if (exam.type === 'listening') {
                      const currentSecObj = exam.sections?.find(s => s.sectionNumber === currentSection);
                      questionsToRender = currentSecObj?.questions || [];
                    } else if (exam.type === 'reading') {
                      const currentPassageObj = exam.passages?.find(p => p.passageNumber === currentSection);
                      questionsToRender = currentPassageObj?.questions || [];
                    }

                    let curCorrectCount = 0;
                    questionsToRender.forEach(q => {
                      const studentAns = (answers[q.number] || '').trim();
                      if (areAnswersMatching(studentAns, q.correctAnswer) && q.correctAnswer.trim() !== '') {
                        curCorrectCount++;
                      }
                    });

                    return (
                      <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 leading-tight">
                        {curCorrectCount === 0 
                          ? (language === 'vi' ? 'Oops! Bạn chưa làm đúng câu nào, cố gắng lần sau nha.' : 'Oops! No correct answers yet, try again next time.')
                          : (language === 'vi' ? 'Kết quả làm bài tuyệt vời! Hãy tiếp tục phát huy nhé.' : 'Excellent result! Keep up the good work.')
                        }
                      </h3>
                    );
                  })()}
                  <p className="text-xs text-slate-400 font-semibold mt-1">
                    {language === 'vi' ? 'Bài thi đã được ghi nhận trên hệ thống.' : 'Your exam has been submitted.'}
                  </p>
                </div>

                {(() => {
                  let questionsToRender: any[] = [];
                  if (exam.type === 'listening') {
                    const currentSecObj = exam.sections?.find(s => s.sectionNumber === currentSection);
                    questionsToRender = currentSecObj?.questions || [];
                  } else if (exam.type === 'reading') {
                    const currentPassageObj = exam.passages?.find(p => p.passageNumber === currentSection);
                    questionsToRender = currentPassageObj?.questions || [];
                  }
                  
                  let skippedCount = 0;
                  let curCorrectCount = 0;
                  questionsToRender.forEach(q => {
                    const studentAns = (answers[q.number] || '').trim();
                    if (!studentAns) {
                      skippedCount++;
                    } else if (areAnswersMatching(studentAns, q.correctAnswer) && q.correctAnswer.trim() !== '') {
                      curCorrectCount++;
                    }
                  });
                  const incorrectCount = questionsToRender.length - curCorrectCount - skippedCount;

                  return (
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                      {/* Circle Gauge */}
                      <div className="relative flex items-center justify-center w-24 h-24 shrink-0">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle
                            cx="48"
                            cy="48"
                            r="40"
                            className="text-slate-100 dark:text-slate-800"
                            strokeWidth="8"
                            stroke="currentColor"
                            fill="transparent"
                          />
                          <circle
                            cx="48"
                            cy="48"
                            r="40"
                            className="text-rose-500"
                            strokeWidth="8"
                            strokeDasharray={2 * Math.PI * 40}
                            strokeDashoffset={2 * Math.PI * 40 * (1 - (questionsToRender.length ? curCorrectCount / questionsToRender.length : 0))}
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="transparent"
                          />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                          <span className="text-2xl font-black text-slate-800 dark:text-slate-100 leading-none">
                            {exam.type === 'listening' || exam.type === 'reading' ? `${band}` : '100%'}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            {language === 'vi' ? 'Điểm số' : 'Score'}
                          </span>
                        </div>
                      </div>

                      {/* Stats Labels Grid */}
                      <div className="space-y-2 text-xs font-bold w-full">
                        <div className="flex items-center justify-between p-1.5 px-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 rounded-xl">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>{language === 'vi' ? 'Đúng' : 'Correct'}</span>
                          </div>
                          <span>{curCorrectCount}</span>
                        </div>
                        
                        <div className="flex items-center justify-between p-1.5 px-3 bg-rose-50 dark:bg-rose-950/20 text-rose-600 rounded-xl">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-rose-500" />
                            <span>{language === 'vi' ? 'Sai' : 'Incorrect'}</span>
                          </div>
                          <span>{incorrectCount}</span>
                        </div>

                        <div className="flex items-center justify-between p-1.5 px-3 bg-slate-50 dark:bg-slate-800 text-slate-500 rounded-xl">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-slate-400" />
                            <span>{language === 'vi' ? 'Bỏ qua' : 'Skipped'}</span>
                          </div>
                          <span>{skippedCount}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Bottom buttons */}
                <div className="pt-2 flex gap-3">
                  <button
                    onClick={() => setViewingDetailedExplanation(true)}
                    className="flex-1 py-3 px-6 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-rose-500/20 hover:shadow-rose-500/30 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <BookOpen size={14} />
                    <span>{language === 'vi' ? 'Xem giải thích' : 'See Explanation'}</span>
                  </button>

                  {!isFullTestMode && (
                    <button
                      onClick={onBack}
                      className="py-3 px-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                    >
                      {language === 'vi' ? 'Thư viện' : 'Library'}
                    </button>
                  )}
                </div>
              </div>

              {/* Right Astronaut Reading Illustration */}
              <div className="w-full md:w-1/2 flex justify-center relative">
                <div className="w-64 h-64 relative bg-slate-50 dark:bg-slate-850 rounded-full flex items-center justify-center overflow-hidden border border-slate-100 dark:border-slate-800 shadow-inner">
                  {/* Star decoration */}
                  <div className="absolute top-8 left-12 w-1.5 h-1.5 bg-yellow-300 rounded-full animate-ping" />
                  <div className="absolute top-16 right-16 w-1 h-1 bg-yellow-200 rounded-full animate-pulse" />
                  <div className="absolute bottom-16 left-16 w-1 h-1 bg-white rounded-full animate-pulse" />
                  
                  {/* Moon crescent */}
                  <div className="absolute top-12 right-12 w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-950 shadow-md flex items-center justify-center">
                    <div className="w-6 h-6 rounded-full bg-slate-50 dark:bg-slate-850 translate-x-2 -translate-y-1" />
                  </div>

                  {/* Astronaut Reader custom vector body */}
                  <svg viewBox="0 0 120 120" className="w-40 h-40 drop-shadow-lg">
                    {/* Suit Body */}
                    <rect x="45" y="65" width="30" height="30" rx="10" fill="#E2E8F0" />
                    <circle cx="60" cy="50" r="22" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" />
                    {/* Visor faceplate */}
                    <circle cx="60" cy="48" r="15" fill="#1E293B" />
                    <ellipse cx="55" cy="46" r="3" fill="#38BDF8" opacity="0.6" />
                    <ellipse cx="62" cy="52" r="1.5" fill="#38BDF8" opacity="0.3" />
                    {/* Suit control panel */}
                    <rect x="53" y="70" width="14" height="12" rx="2" fill="#94A3B8" />
                    <circle cx="57" cy="74" r="1.5" fill="#EF4444" />
                    <circle cx="63" cy="74" r="1.5" fill="#10B981" />
                    <rect x="56" y="78" width="8" height="2" fill="#3B82F6" />
                    {/* Arms holding a book */}
                    <path d="M 38,76 C 42,76 46,72 50,72 L 50,78 Z" fill="#E2E8F0" />
                    <path d="M 82,76 C 78,76 74,72 70,72 L 70,78 Z" fill="#E2E8F0" />
                    {/* Book */}
                    <polygon points="44,70 60,76 76,70 72,84 60,88 48,84" fill="#F43F5E" />
                    <polygon points="46,71 60,76 74,71 71,83 60,87 49,83" fill="#FFFFFF" />
                    <line x1="60" y1="76" x2="60" y2="87" stroke="#E2E8F0" strokeWidth="1" />
                  </svg>
                  
                  {/* Glow ring */}
                  <div className="absolute inset-0 border-4 border-slate-200/20 dark:border-slate-800/20 rounded-full pointer-events-none" />
                </div>
              </div>
            </div>
          ) : (
            /* Detailed Explanation View (Split screen style, Image 3) */
            <div className="space-y-4 animate-fade-in text-left">
              {/* Nav Header */}
              <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-50 dark:bg-slate-900/60 p-3 px-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs gap-3">
                <button
                  onClick={() => setViewingDetailedExplanation(false)}
                  className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border border-slate-200/60 dark:border-slate-700/60 transition-all hover:bg-slate-50 cursor-pointer"
                >
                  <ArrowLeft size={14} />
                  <span>{language === 'vi' ? 'Quay lại kết quả chung' : 'Back to General Results'}</span>
                </button>
                
                {(() => {
                  let questionsToRender: any[] = [];
                  if (exam.type === 'listening') {
                    const currentSecObj = exam.sections?.find(s => s.sectionNumber === currentSection);
                    questionsToRender = currentSecObj?.questions || [];
                  } else if (exam.type === 'reading') {
                    const currentPassageObj = exam.passages?.find(p => p.passageNumber === currentSection);
                    questionsToRender = currentPassageObj?.questions || [];
                  }

                  let curCorrectCount = 0;
                  questionsToRender.forEach(q => {
                    const studentAns = (answers[q.number] || '').trim();
                    if (areAnswersMatching(studentAns, q.correctAnswer) && q.correctAnswer.trim() !== '') {
                      curCorrectCount++;
                    }
                  });

                  return (
                    <div className="text-xs font-bold text-slate-500 flex items-center gap-4">
                      <span>{exam.title}</span>
                      <span className="h-4 w-px bg-slate-200 dark:bg-slate-800" />
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {language === 'vi' ? 'Đúng' : 'Correct'}: {curCorrectCount}/{questionsToRender.length}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Main Split Pane Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 h-[76vh] overflow-hidden">
                
                {/* Left Pane - Document (Passage, Transcript, Translation, Vocab) */}
                <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl flex flex-col overflow-hidden h-full shadow-xs">
                  {/* Tab bar header */}
                  <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-1">
                    <button
                      onClick={() => setExplanationTab('content')}
                      className={`flex-1 py-2 text-center text-xs font-black rounded-lg transition-all cursor-pointer ${
                        explanationTab === 'content'
                          ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-100 dark:border-slate-700'
                          : 'text-slate-500 hover:text-slate-850 dark:hover:text-slate-200'
                      }`}
                    >
                      {exam.type === 'listening' ? (language === 'vi' ? 'Bản ghi âm (Transcript)' : 'Transcript') : (language === 'vi' ? 'Bài đọc (Passage)' : 'Passage')}
                    </button>
                    
                    <button
                      onClick={() => setExplanationTab('translation')}
                      className={`flex-1 py-2 text-center text-xs font-black rounded-lg transition-all cursor-pointer ${
                        explanationTab === 'translation'
                          ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-100 dark:border-slate-700'
                          : 'text-slate-500 hover:text-slate-850 dark:hover:text-slate-200'
                      }`}
                    >
                      {language === 'vi' ? 'Bản dịch' : 'Translation'}
                    </button>

                    <button
                      onClick={() => setExplanationTab('vocabulary')}
                      className={`flex-1 py-2 text-center text-xs font-black rounded-lg transition-all cursor-pointer ${
                        explanationTab === 'vocabulary'
                          ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-100 dark:border-slate-700'
                          : 'text-slate-500 hover:text-slate-850 dark:hover:text-slate-200'
                      }`}
                    >
                      {language === 'vi' ? 'Từ vựng cốt lõi' : 'Vocabulary'}
                    </button>
                  </div>

                  {/* Tab Contents inside a scrollable div */}
                  <div className="flex-1 p-5 overflow-y-auto select-text custom-scrollbar leading-relaxed text-xs">
                    
                    {explanationTab === 'content' && (
                      <div className="space-y-4">
                        {exam.type === 'listening' ? (
                          <div className="space-y-5">
                            {/* Listening controls if it is listening type */}
                            {(() => {
                              const activeSec = exam.sections?.find(s => s.sectionNumber === currentSection);
                              if (activeSec?.audioUrl) {
                                return (
                                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-4 rounded-2xl space-y-3.5 shadow-xs transition-all hover:shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="flex items-center gap-2.5">
                                        <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                                          <Volume2 size={16} className={isPlaying ? "animate-bounce" : ""} />
                                        </div>
                                        <div className="flex flex-col">
                                          <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                                            {language === 'vi' ? 'LUYỆN NGHE TỰ CHỌN' : 'INTERACTIVE PRACTICE PLAYER'}
                                          </span>
                                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold leading-none mt-0.5">
                                            {language === 'vi' ? 'Chạm vào câu bất kỳ để nghe trực tiếp đoạn đó' : 'Click on any sentence in transcript below to jump to it'}
                                          </span>
                                        </div>
                                      </div>
                                      
                                      <button
                                        type="button"
                                        onClick={() => toggleAudio(activeSec.audioUrl || '')}
                                        className={`w-9 h-9 rounded-full flex items-center justify-center text-white shadow-md transition-all shrink-0 cursor-pointer ${
                                          isPlaying 
                                            ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/10' 
                                            : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10'
                                        }`}
                                      >
                                        {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                                      </button>
                                    </div>

                                    {/* Seek slider */}
                                    <div className="space-y-1">
                                      <input 
                                        type="range"
                                        min={0}
                                        max={audioDuration || 100}
                                        value={audioCurrentTime}
                                        onChange={e => handleSeek(parseFloat(e.target.value))}
                                        className="w-full accent-emerald-600 h-1 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
                                      />
                                      <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-500">
                                        <span>{formatTimer(Math.floor(audioCurrentTime))}</span>
                                        <span>{formatTimer(Math.floor(audioDuration))}</span>
                                      </div>
                                    </div>

                                    {/* Speed selector & Auto scroll toggle */}
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2.5 border-t border-slate-200/50 dark:border-slate-800/40">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-wider">
                                          {language === 'vi' ? 'Tốc độ:' : 'Speed:'}
                                        </span>
                                        <div className="flex gap-1">
                                          {([0.8, 1.0, 1.2, 1.5, 2.0] as const).map(speed => (
                                            <button
                                              key={speed}
                                              type="button"
                                              onClick={() => handleSpeedChange(speed)}
                                              className={`px-1.5 py-0.5 rounded text-[9px] font-black tracking-tight transition-all cursor-pointer ${
                                                audioPlaybackSpeed === speed
                                                  ? 'bg-emerald-600 text-white font-extrabold'
                                                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                                              }`}
                                            >
                                              {speed === 1.0 ? 'Normal' : `${speed}x`}
                                            </button>
                                          ))}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 self-end sm:self-auto">
                                        <span className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-wider">
                                          {language === 'vi' ? 'Tự cuộn chữ:' : 'Auto-Scroll:'}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => setIsAutoScrollEnabled(!isAutoScrollEnabled)}
                                          className={`px-2 py-0.5 rounded text-[9px] font-black tracking-tight transition-all cursor-pointer ${
                                            isAutoScrollEnabled
                                              ? 'bg-emerald-600 text-white'
                                              : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                                          }`}
                                        >
                                          {isAutoScrollEnabled ? 'ON' : 'OFF'}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                            
                            <div className="font-medium whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-300 select-text bg-white dark:bg-slate-950 p-4 border border-slate-100 dark:border-slate-800/80 rounded-2xl max-h-[50vh] overflow-y-auto custom-scrollbar">
                              {(() => {
                                const activeSec = exam.sections?.find(s => s.sectionNumber === currentSection);
                                if (!activeSec?.transcript) {
                                  return (
                                    <div className="italic text-slate-400 p-4 text-center">
                                      {language === 'vi' ? 'Không có bản ghi âm.' : 'No transcript available.'}
                                    </div>
                                  );
                                }
                                
                                const parsed = parseTranscript(activeSec.transcript, audioDuration);
                                
                                return (
                                  <div className="space-y-4 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed select-text">
                                    {parsed.map((p, pIdx) => {
                                      if (p.sentences.length === 0) return null;
                                      return (
                                        <p key={pIdx} className="mb-4">
                                          {p.sentences.map((s, sIdx) => {
                                            const isActive = activeSentenceId === `${pIdx}-${sIdx}`;
                                            return (
                                              <span
                                                key={sIdx}
                                                id={`transcript-sentence-${pIdx}-${sIdx}`}
                                                onClick={() => {
                                                  handleSeek(s.startTime);
                                                  if (!isPlaying && audioRef.current) {
                                                    audioRef.current.play().then(() => setIsPlaying(true));
                                                  }
                                                }}
                                                className={`inline cursor-pointer transition-all duration-200 rounded px-1.5 py-0.5 leading-relaxed ${
                                                  isActive
                                                    ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-950 dark:text-amber-200 font-black shadow-xs border-b border-amber-500 scale-[1.01]'
                                                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                                                }`}
                                                title={language === 'vi' ? 'Click để nghe đoạn này' : 'Click to listen to this segment'}
                                              >
                                                {s.text}{' '}
                                              </span>
                                            );
                                          })}
                                        </p>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {(() => {
                              const activePassage = exam.passages?.find(p => p.passageNumber === currentSection);
                              if (!activePassage) return null;
                              return (
                                <>
                                  <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-850 pb-2">
                                    {activePassage.title}
                                  </h2>
                                  <div className="font-medium whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-300 select-text">
                                    {renderTextWithHighlights(activePassage.content)}
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    )}

                    {explanationTab === 'translation' && (
                      <div className="font-medium text-slate-600 dark:text-slate-300 whitespace-pre-wrap select-text leading-relaxed">
                        {(() => {
                          if (exam.type === 'listening') {
                            const activeSec = exam.sections?.find(s => s.sectionNumber === currentSection);
                            return activeSec?.translation || <span className="italic text-slate-400 block text-center p-4">{language === 'vi' ? 'Bản dịch đang được cập nhật.' : 'Translation is being updated...'}</span>;
                          } else {
                            const activePassage = exam.passages?.find(p => p.passageNumber === currentSection);
                            return activePassage?.translation || <span className="italic text-slate-400 block text-center p-4">{language === 'vi' ? 'Bản dịch đang được cập nhật.' : 'Translation is being updated...'}</span>;
                          }
                        })()}
                      </div>
                    )}

                    {explanationTab === 'vocabulary' && (
                      <div className="font-medium text-slate-600 dark:text-slate-300 select-text leading-relaxed space-y-4">
                        {(() => {
                          let rawText = '';
                          if (exam.type === 'listening') {
                            const activeSec = exam.sections?.find(s => s.sectionNumber === currentSection);
                            rawText = activeSec?.vocabulary || '';
                          } else {
                            const activePassage = exam.passages?.find(p => p.passageNumber === currentSection);
                            rawText = activePassage?.vocabulary || '';
                          }

                          if (!rawText.trim()) {
                            return (
                              <div className="italic text-slate-400 p-8 text-center bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                                {language === 'vi' ? 'Từ vựng đang được cập nhật.' : 'Vocabulary is being updated...'}
                              </div>
                            );
                          }

                           // Parse lines into list
                          const lines = rawText.split('\n');
                          const items: { word: string; meaning: string }[] = [];
                          lines.forEach(l => {
                            let line = l.trim();
                            if (!line) return;
                            
                            // Remove bullet points/numbers at the beginning (e.g. "- word: definition" or "1. word: definition")
                            line = line.replace(/^[-*•]\s*/, '').replace(/^\d+[\s.)\-\/:]+\s*/, '');
                            
                            // Split by colon or dash
                            const parts = line.split(/[:\-]/);
                            if (parts.length >= 2) {
                              const word = cleanVocabularyWord(parts[0]);
                              const meaning = parts.slice(1).join(':').trim();
                              if (word) {
                                items.push({ word, meaning });
                              }
                            } else {
                              if (line) {
                                const word = cleanVocabularyWord(line);
                                if (word) {
                                  items.push({ word, meaning: '' });
                                }
                              }
                            }
                          });

                          if (items.length === 0) {
                            return (
                              <div className="italic text-slate-400 p-8 text-center bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                                {language === 'vi' ? 'Không tìm thấy từ vựng hợp lệ để hiển thị.' : 'No valid vocabulary found to display.'}
                              </div>
                            );
                          }

                          const uncompletedCount = items.filter(item => !enrichedVocab[item.word.trim()]).length;

                          return (
                            <div className="space-y-4">
                              {/* Header control bar */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-850">
                                <div className="text-xs">
                                  <p className="font-extrabold text-slate-800 dark:text-slate-200">
                                    {language === 'vi' ? 'Danh sách từ vựng cốt lõi' : 'Core Vocabulary List'}
                                  </p>
                                  <p className="text-slate-500 font-semibold mt-0.5">
                                    {language === 'vi' 
                                      ? `Tìm thấy ${items.length} từ vựng quan trọng.` 
                                      : `Found ${items.length} core vocabulary words.`}
                                  </p>
                                </div>
                                {uncompletedCount > 0 && (
                                  <button
                                    onClick={() => enrichAllVocab(items)}
                                    disabled={isEnrichingAll}
                                    className="px-4 py-2 text-[11px] font-black uppercase tracking-wider rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                  >
                                    {isEnrichingAll ? (
                                      <Loader2 size={12} className="animate-spin" />
                                    ) : (
                                      <Sparkles size={12} />
                                    )}
                                    <span>
                                      {isEnrichingAll 
                                        ? (language === 'vi' ? 'Đang hoàn thiện...' : 'Enriching...') 
                                        : (language === 'vi' ? 'Hoàn thiện tất cả bằng AI' : 'Enrich All with AI')}
                                    </span>
                                  </button>
                                )}
                              </div>

                              {/* Card List Grid */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {items.map((item, idx) => {
                                  const keyWord = item.word.trim();
                                  const enriched = enrichedVocab[keyWord];
                                  const isEnriching = enrichingWords[keyWord];

                                  return (
                                    <div 
                                      key={idx} 
                                      className="p-4.5 border border-slate-100 dark:border-slate-850 rounded-2xl bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between gap-4 hover:border-indigo-500/30 dark:hover:border-indigo-500/20 transition-all duration-300 relative overflow-hidden group"
                                    >
                                      {/* Top Word Header row */}
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center flex-wrap gap-2">
                                          <span className="font-extrabold text-[13px] text-indigo-600 dark:text-indigo-400 font-sans tracking-tight">
                                            {item.word}
                                          </span>
                                          {enriched?.ipa && (
                                            <span className="font-mono text-[9px] text-rose-500 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md font-extrabold">
                                              {enriched.ipa}
                                            </span>
                                          )}
                                          <button
                                            onClick={() => playPronunciation(item.word)}
                                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-all cursor-pointer"
                                            title={language === 'vi' ? 'Nghe phát âm' : 'Listen pronunciation'}
                                          >
                                            <Volume2 size={12} />
                                          </button>
                                        </div>

                                        <div className="shrink-0">
                                          {enriched ? (
                                            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                              AI OK
                                            </span>
                                          ) : (
                                            <button
                                              onClick={() => enrichWord(item.word, item.meaning)}
                                              disabled={isEnriching}
                                              className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:hover:bg-blue-950/80 px-2.5 py-1 rounded-md transition-all cursor-pointer disabled:opacity-50"
                                            >
                                              {isEnriching ? (
                                                <Loader2 size={9} className="animate-spin" />
                                              ) : (
                                                <Sparkles size={9} />
                                              )}
                                              <span>{language === 'vi' ? 'AI' : 'AI'}</span>
                                            </button>
                                          )}
                                        </div>
                                      </div>

                                      {/* Word Meaning details block */}
                                      <div className="space-y-3 flex-1">
                                        <div>
                                          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                                            {language === 'vi' ? 'ĐỊNH NGHĨA' : 'MEANING'}
                                          </span>
                                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                            {enriched ? enriched.meaning : item.meaning || (language === 'vi' ? 'Nhấp AI để xem thêm thông tin...' : 'Click AI to discover...')}
                                          </span>
                                        </div>

                                        {enriched?.collocation && (
                                          <div>
                                            <span className="text-[9px] font-black uppercase tracking-wider text-indigo-500 block mb-1">
                                              {language === 'vi' ? 'COLLOCATIONS' : 'COLLOCATIONS'}
                                            </span>
                                            <div className="flex flex-wrap gap-1.5">
                                              {enriched.collocation.split(',').map((c, cIdx) => (
                                                <span key={cIdx} className="text-[9px] font-extrabold bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 border border-indigo-500/10 px-2 py-0.5 rounded-md">
                                                  {c.trim()}
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {enriched?.example && (
                                          <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border-l-2 border-slate-300 dark:border-slate-700 space-y-1">
                                            <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block">
                                              {language === 'vi' ? 'VÍ DỤ' : 'EXAMPLE'}
                                            </span>
                                            <p className="text-[10px] font-bold text-slate-800 dark:text-slate-200 italic leading-relaxed">
                                              "{enriched.example}"
                                            </p>
                                            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">
                                              {enriched.exampleTranslation}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                  </div>
                </div>

                {/* Right Pane - Question List with collapsibles */}
                <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-2xl p-5 overflow-y-auto custom-scrollbar h-full flex flex-col gap-4">
                  {(() => {
                    let questionsToRender: any[] = [];
                    if (exam.type === 'listening') {
                      const currentSecObj = exam.sections?.find(s => s.sectionNumber === currentSection);
                      questionsToRender = currentSecObj?.questions || [];
                    } else if (exam.type === 'reading') {
                      const currentPassageObj = exam.passages?.find(p => p.passageNumber === currentSection);
                      questionsToRender = currentPassageObj?.questions || [];
                    }

                    return (
                      <>
                        <div className="border-b border-slate-50 dark:border-slate-850 pb-2.5 flex items-center justify-between">
                          <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">
                            {language === 'vi' ? 'GIẢI THÍCH CHI TIẾT ĐÁP ÁN' : 'DETAILED EXPLANATIONS'}
                          </span>
                          <span className="text-[10px] font-extrabold bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-md">
                            {questionsToRender.length} {language === 'vi' ? 'Câu hỏi' : 'Questions'}
                          </span>
                        </div>

                        <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                          {questionsToRender.map((q, idx) => {
                            const studentAns = (answers[q.number] || '').trim();
                            const correctAns = q.correctAnswer.trim();
                            const isCorrect = areAnswersMatching(studentAns, correctAns) && correctAns !== '';
                            const isMC = q.questionType === 'Multiple Choice' || (q.options && q.options.length > 0);

                            return (
                              <div key={q.number} className="border border-slate-100 dark:border-slate-800 rounded-2xl p-4.5 bg-slate-50/50 dark:bg-slate-900/10 space-y-3.5 transition-all text-left">
                                {/* Question header row */}
                                <div className="flex items-start justify-between gap-3">
                                  <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                                    Câu {q.number}: {q.questionText}
                                  </span>
                                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase shrink-0 ${
                                    isCorrect 
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                                      : !studentAns 
                                        ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' 
                                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                  }`}>
                                    {isCorrect ? (language === 'vi' ? 'Đúng' : 'Correct') : !studentAns ? (language === 'vi' ? 'Bỏ trống' : 'Skipped') : (language === 'vi' ? 'Sai' : 'Incorrect')}
                                  </span>
                                </div>

                                {/* Options if Multiple Choice */}
                                {isMC && q.options && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                    {q.options.map((opt: string, optIdx: number) => {
                                      const optionLetter = String.fromCharCode(65 + optIdx);
                                      const isOptionCorrect = correctAns.toUpperCase() === optionLetter;
                                      const isOptionSelected = studentAns.toUpperCase() === optionLetter;
                                      
                                      return (
                                        <div
                                          key={optIdx}
                                          className={`p-2.5 rounded-xl border text-[11px] font-semibold flex items-center gap-2.5 transition-all ${
                                            isOptionCorrect
                                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                                              : isOptionSelected && !isCorrect
                                                ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400'
                                                : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                                          }`}
                                        >
                                          <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black uppercase ${
                                            isOptionCorrect
                                              ? 'bg-emerald-500 text-white shadow-xs'
                                              : isOptionSelected && !isCorrect
                                                ? 'bg-rose-500 text-white shadow-xs'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                          }`}>
                                            {optionLetter}
                                          </span>
                                          <span className="truncate">{opt}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Non-MC / Fill in the blank feedback */}
                                {!isMC && (
                                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                    <div>
                                      <span className="text-slate-400 block font-semibold">{language === 'vi' ? 'Bài làm của bạn:' : 'Your answer:'}</span>
                                      <span className={`font-extrabold uppercase ${isCorrect ? 'text-emerald-600' : studentAns ? 'text-rose-500' : 'text-slate-400'}`}>
                                        {studentAns || '—'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 block font-semibold">{language === 'vi' ? 'Đáp án đúng:' : 'Key answer:'}</span>
                                      <span className="text-blue-600 dark:text-blue-400 font-extrabold uppercase">
                                        {correctAns}
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {/* Collapse/Expandable explanation box */}
                                <div className="bg-blue-500/5 border border-blue-500/10 dark:border-blue-400/10 rounded-xl p-3.5 space-y-2 animate-fade-in text-[11px] leading-relaxed">
                                  <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-rose-500 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md">
                                    {language === 'vi' ? `GIẢI THÍCH CÂU ${q.number}` : `EXPLANATION Q${q.number}`}
                                  </span>
                                  <div className="font-medium text-slate-700 dark:text-slate-300">
                                    {q.explanation ? (
                                      <p className="whitespace-pre-wrap">{q.explanation}</p>
                                    ) : (
                                      <p>
                                        {language === 'vi' 
                                          ? `Dựa vào dữ liệu và mạch lập luận của đề bài, đáp án chính xác là "${correctAns}". Hệ thống tự động đối chiếu các từ khóa chính xác từ câu hỏi với ngữ cảnh của đoạn văn.`
                                          : `Based on the passage context and logic, the correct key is "${correctAns}". The system matched the correct keywords from the query directly to the text.`
                                        }
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </div>

              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
