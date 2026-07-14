import React, { useState } from 'react';
import { BookOpen, Clock, AlertTriangle, ArrowRight, ArrowLeft, Volume2, HelpCircle, FileText, Mic, CheckCircle2, Star, Sparkles } from 'lucide-react';
import { Exam, VocabularyItem, HighlightItem, User } from '../../types';
import ExamSectionPractice from './ExamSectionPractice';

const PracticeComponent = ExamSectionPractice as any;

interface FullTestRunnerProps {
  exam: any; // IELTS Exam
  currentUser: User;
  onBack: () => void;
  onAddVocab: (vocab: Omit<VocabularyItem, 'id' | 'userId' | 'dateAdded'>) => Promise<void>;
  onAddHighlight: (highlight: Omit<HighlightItem, 'id' | 'userId' | 'createdAt'>) => Promise<void>;
  onDeleteHighlight: (id: string) => Promise<void>;
  highlightList: HighlightItem[];
  vocabList: VocabularyItem[];
  language: 'vi' | 'en';
}

const localTranslations = {
  vi: {
    welcomeTitle: 'KỲ THI THỬ IELTS FULL MOCK TEST',
    welcomeDesc: 'Chào mừng bạn đến với hệ thống thi thử IELTS mô phỏng hoàn toàn thực tế. Bạn sẽ thực hiện các phần thi liên tục dưới áp lực thời gian.',
    modulesIncluded: 'Các phần thi bao gồm trong đề này:',
    listeningName: 'Listening (Nghe)',
    listeningDesc: '4 phần, 40 câu hỏi. Bạn chỉ được nghe một lần duy nhất.',
    readingName: 'Reading (Đọc)',
    readingDesc: '3 bài đọc dài học thuật, 40 câu hỏi.',
    writingName: 'Writing (Viết)',
    writingDesc: '2 bài viết: Task 1 (Mô tả biểu đồ) và Task 2 (Nghị luận xã hội).',
    speakingName: 'Speaking (Nói)',
    speakingDesc: '3 phần phỏng vấn và thảo luận trực tiếp.',
    startBtn: 'BẮT ĐẦU THI NGAY',
    warningTitle: 'LƯU Ý QUAN TRỌNG:',
    warningText1: 'Hãy đảm bảo kết nối mạng ổn định và thiết bị tai nghe hoạt động tốt.',
    warningText2: 'Không tải lại trang hoặc tắt tab trình duyệt khi đang làm bài thi để tránh mất tiến trình.',
    nextStepTitle: 'Hoàn thành phần thi!',
    nextStepDesc: 'Bạn đã hoàn thành xuất sắc phần thi này. Hãy nghỉ ngơi giây lát và nhấn nút bên dưới để chuyển sang phần tiếp theo.',
    nextStepBtn: 'BẮT ĐẦU PHẦN THI TIẾP THEO',
    resultsTitle: 'BÁO CÁO KẾT QUẢ THI THỬ IELTS',
    resultsDesc: 'Chúc mừng bạn đã hoàn thành xuất sắc kỳ thi thử IELTS Full Test. Dưới đây là bảng điểm chi tiết của bạn:',
    overallBand: 'ĐIỂM OVERALL BAND',
    finishBtn: 'HOÀN THÀNH & QUAY LẠI CỔNG HỌC VIÊN',
    scoreLabel: 'Điểm số:',
    correctAnswers: 'Số câu đúng:',
    statusCompleted: 'Đã hoàn thành',
    noScore: 'Chưa có điểm',
    backBtn: 'Thoát kỳ thi',
    backToPortal: 'Quay lại cổng',
    overviewHeader: 'Tổng quan Full Test',
    sectionText: 'Phần',
  },
  en: {
    welcomeTitle: 'IELTS FULL MOCK TEST CHAMPIONSHIP',
    welcomeDesc: 'Welcome to the fully simulated realistic IELTS Mock Test. You will take the tests consecutively under real exam pressure.',
    modulesIncluded: 'Modules included in this test:',
    listeningName: 'Listening',
    listeningDesc: '4 sections, 40 questions. Audio will play once only.',
    readingName: 'Reading',
    readingDesc: '3 academic passages, 40 questions.',
    writingName: 'Writing',
    writingDesc: '2 tasks: Task 1 (Data description) and Task 2 (Opinion essay).',
    speakingName: 'Speaking',
    speakingDesc: '3 parts of simulated interview and discussion.',
    startBtn: 'START EXAM NOW',
    warningTitle: 'CRITICAL INSTRUCTIONS:',
    warningText1: 'Please ensure your headphones work perfectly and network connection is stable.',
    warningText2: 'Do not refresh the page or close the tab to avoid losing your exam progress.',
    nextStepTitle: 'Section Completed!',
    nextStepDesc: 'You have successfully finished this module. Please take a deep breath and proceed to the next section.',
    nextStepBtn: 'PROCEED TO NEXT SECTION',
    resultsTitle: 'IELTS MOCK TEST SCORE REPORT',
    resultsDesc: 'Congratulations on completing the entire IELTS Full Test! Here is your detailed performance report:',
    overallBand: 'OVERALL BAND SCORE',
    finishBtn: 'FINISH & BACK TO STUDENT PORTAL',
    scoreLabel: 'Band Score:',
    correctAnswers: 'Correct answers:',
    statusCompleted: 'Completed',
    noScore: 'No score',
    backBtn: 'Exit Exam',
    backToPortal: 'Back to Portal',
    overviewHeader: 'Full Test Progress',
    sectionText: 'Section',
  }
};

export default function FullTestRunner({
  exam,
  currentUser,
  onBack,
  onAddVocab,
  onAddHighlight,
  onDeleteHighlight,
  highlightList,
  vocabList,
  language
}: FullTestRunnerProps) {
  const t = localTranslations[language];

  // Dynamic modules builder based on defined sections/fields in exam object
  const availableModules = [];
  if (exam.sections && exam.sections.length > 0) {
    availableModules.push({
      type: 'listening',
      name: t.listeningName,
      icon: Volume2,
      duration: 40,
      desc: t.listeningDesc
    });
  }
  if (exam.passages && exam.passages.length > 0) {
    availableModules.push({
      type: 'reading',
      name: t.readingName,
      icon: BookOpen,
      duration: 60,
      desc: t.readingDesc
    });
  }
  if (exam.writingTask1 || exam.writingTask2) {
    availableModules.push({
      type: 'writing',
      name: t.writingName,
      icon: FileText,
      duration: 60,
      desc: t.writingDesc
    });
  }
  if (exam.speakingPart1 || exam.speakingPart2 || exam.speakingPart3) {
    availableModules.push({
      type: 'speaking',
      name: t.speakingName,
      icon: Mic,
      duration: 15,
      desc: t.speakingDesc
    });
  }

  // Fallbacks if metadata lists are currently unpopulated in backend mock DB
  if (availableModules.length === 0) {
    availableModules.push(
      { type: 'listening', name: t.listeningName, icon: Volume2, duration: 40, desc: t.listeningDesc },
      { type: 'reading', name: t.readingName, icon: BookOpen, duration: 60, desc: t.readingDesc },
      { type: 'writing', name: t.writingName, icon: FileText, duration: 60, desc: t.writingDesc },
      { type: 'speaking', name: t.speakingName, icon: Mic, duration: 15, desc: t.speakingDesc }
    );
  }

  // Application flow states
  const [currentStep, setCurrentStep] = useState<'welcome' | 'testing' | 'transition' | 'results'>('welcome');
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [resultsMap, setResultsMap] = useState<Record<string, { answers: Record<string, string>; score: number; correctCount: number }>>({});

  const activeModule = availableModules[currentModuleIndex];

  const handleStartExam = () => {
    setCurrentStep('testing');
    setCurrentModuleIndex(0);
  };

  const handleSectionPracticeComplete = (answers: Record<string, string>, score: number, correctCount: number) => {
    const nextResults = {
      ...resultsMap,
      [activeModule.type]: { answers, score, correctCount }
    };
    setResultsMap(nextResults);

    if (currentModuleIndex < availableModules.length - 1) {
      setCurrentStep('transition');
    } else {
      setCurrentStep('results');
    }
  };

  const handleNextSection = () => {
    setCurrentModuleIndex(prev => prev + 1);
    setCurrentStep('testing');
  };

  const getOverallBand = (): number => {
    const scores = (Object.values(resultsMap) as any[]).map(r => r.score);
    if (scores.length === 0) return 0;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    // IELTS standard overall band rounding to nearest 0.5 or 0.25
    // e.g., 6.25 -> 6.5, 6.75 -> 7.0, 6.125 -> 6.0 etc.
    const fractional = avg % 1;
    let rounded = Math.floor(avg);
    if (fractional >= 0.75) {
      rounded += 1;
    } else if (fractional >= 0.25) {
      rounded += 0.5;
    }
    return rounded;
  };

  // Safe wrapper around our exam content to ensure perfect filtering for current module
  const makeSubExam = () => {
    return {
      ...exam,
      type: activeModule.type,
      duration: activeModule.duration,
      title: `${exam.title} - ${activeModule.type.toUpperCase()}`
    };
  };

  return (
    <div className="bg-slate-950 text-white min-h-[calc(100vh-120px)] flex flex-col rounded-3xl overflow-hidden border border-slate-800 shadow-2xl transition-all">
      {/* HEADER SECTION */}
      <div className="bg-slate-900 border-b border-slate-800 p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-extrabold text-sm">
            🏆
          </span>
          <div>
            <h2 className="font-extrabold text-sm tracking-tight">{exam.title}</h2>
            <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">
              {t.overviewHeader}
            </p>
          </div>
        </div>

        {currentStep !== 'results' && (
          <button
            onClick={onBack}
            className="px-3.5 py-1.5 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
          >
            <ArrowLeft size={12} />
            {t.backToPortal}
          </button>
        )}
      </div>

      {/* BODY CONTENT */}
      {currentStep === 'welcome' && (
        <div className="flex-1 p-8 md:p-12 flex flex-col justify-center items-center max-w-5xl mx-auto space-y-8 text-center">
          <div className="space-y-4">
            <span className="bg-indigo-950 text-indigo-400 border border-indigo-900/40 text-xs font-extrabold uppercase tracking-widest px-4 py-1.5 rounded-full">
              Full IELTS Mock Simulator
            </span>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">{t.welcomeTitle}</h1>
            <p className="text-base text-slate-300 leading-relaxed max-w-3xl mx-auto">{t.welcomeDesc}</p>
          </div>

          {/* Module Grid */}
          <div className="w-full text-left space-y-4 bg-slate-900/60 p-6 md:p-8 rounded-3xl border border-slate-800">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-indigo-400">
              {t.modulesIncluded}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {availableModules.map((m, idx) => {
                const Icon = m.icon;
                return (
                  <div key={m.type} className="flex gap-4 p-4.5 bg-slate-900 rounded-2xl border border-slate-800/40 hover:border-indigo-500/30 transition-all">
                    <span className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-900/50 flex items-center justify-center text-indigo-400 shrink-0">
                      <Icon size={18} />
                    </span>
                    <div>
                      <h4 className="font-bold text-sm text-slate-200">
                        {idx + 1}. {m.name}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{m.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Warning Message */}
          <div className="flex gap-3.5 p-5 bg-amber-950/20 border border-amber-900/40 rounded-2xl text-left w-full">
            <AlertTriangle className="text-amber-500 shrink-0" size={20} />
            <div>
              <h5 className="font-bold text-sm text-amber-500 uppercase tracking-wide">
                {t.warningTitle}
              </h5>
              <ul className="text-xs text-amber-200/80 mt-1.5 space-y-1.5 list-disc list-inside">
                <li>{t.warningText1}</li>
                <li>{t.warningText2}</li>
              </ul>
            </div>
          </div>

          <button
            onClick={handleStartExam}
            className="w-full sm:w-auto px-10 py-4.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-base rounded-2xl tracking-wide shadow-xl shadow-indigo-600/20 hover:scale-[1.02] active:scale-100 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {t.startBtn}
            <ArrowRight size={18} />
          </button>
        </div>
      )}

      {currentStep === 'testing' && (
        <div className="flex-1 flex flex-col bg-slate-950 relative">
          {/* Active section header banner */}
          <div className="bg-indigo-950/40 border-b border-indigo-900/20 px-6 py-2.5 flex items-center justify-between text-xs font-bold text-indigo-400">
            <span className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
              {t.sectionText} {currentModuleIndex + 1} / {availableModules.length}: {activeModule.name}
            </span>
            <span className="text-sm">
              {t.scoreLabel} {resultsMap[activeModule.type]?.score || t.noScore}
            </span>
          </div>

          {/* Embedded Interactive Practice Screen */}
          <div className="flex-1 min-h-[500px]">
            <PracticeComponent
              key={activeModule.type}
              exam={makeSubExam()}
              currentUser={currentUser}
              onBack={onBack}
              onAddVocab={onAddVocab}
              onAddHighlight={onAddHighlight}
              onDeleteHighlight={onDeleteHighlight}
              highlightList={highlightList}
              vocabList={vocabList}
              language={language}
              isFullTestMode={true}
              onFullTestSectionComplete={handleSectionPracticeComplete}
            />
          </div>
        </div>
      )}

      {currentStep === 'transition' && (
        <div className="flex-1 p-8 md:p-12 flex flex-col justify-center items-center max-w-2xl mx-auto space-y-6 text-center animate-fade-in">
          <span className="w-20 h-20 bg-emerald-950 border border-emerald-900/30 text-emerald-400 rounded-full flex items-center justify-center text-3xl font-bold shadow-lg shadow-emerald-900/10">
            ✓
          </span>

          <div className="space-y-3">
            <h1 className="text-3xl font-black text-white">{t.nextStepTitle}</h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              {t.nextStepDesc}
            </p>
          </div>

          {/* Module Complete Summary */}
          <div className="w-full bg-slate-900 border border-slate-800 p-5 rounded-2xl text-left flex justify-between items-center">
            <span className="font-bold text-slate-200 text-sm">{activeModule.name}</span>
            <span className="bg-emerald-950 text-emerald-400 border border-emerald-900/30 font-bold text-xs px-3 py-1 rounded-full uppercase">
              {t.statusCompleted}
            </span>
          </div>

          <button
            onClick={handleNextSection}
            className="w-full px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-100"
          >
            {t.nextStepBtn}
            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {currentStep === 'results' && (
        <div className="flex-1 p-8 md:p-12 flex flex-col justify-center items-center max-w-4xl mx-auto space-y-8 text-center animate-fade-in">
          <div className="space-y-3">
            <span className="text-4xl">🎉</span>
            <h1 className="text-4xl font-black text-white tracking-tight">{t.resultsTitle}</h1>
            <p className="text-sm text-slate-400 leading-relaxed max-w-xl mx-auto">{t.resultsDesc}</p>
          </div>

          {/* OVERALL BAND CARD */}
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white p-8 rounded-3xl shadow-xl w-full flex flex-col items-center gap-3 border border-indigo-500/30 relative overflow-hidden">
            <div className="absolute right-0 top-0 opacity-10">
              <Sparkles size={160} />
            </div>
            <span className="text-xs font-extrabold uppercase tracking-widest text-indigo-200">
              {t.overallBand}
            </span>
            <span className="text-6xl font-black font-mono tracking-tight text-white drop-shadow-md">
              {getOverallBand().toFixed(1)}
            </span>
            <span className="text-xs bg-white/20 px-4 py-1 rounded-full font-bold uppercase tracking-wider">
              Excellent Performance
            </span>
          </div>

          {/* MODULE BY MODULE breakdown */}
          <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden divide-y divide-slate-800/60 text-left">
            {availableModules.map((m) => {
              const Icon = m.icon;
              const result = resultsMap[m.type];
              return (
                <div key={m.type} className="p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4.5">
                    <span className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-900/50 flex items-center justify-center text-indigo-400 shrink-0">
                      <Icon size={18} />
                    </span>
                    <div>
                      <h4 className="font-bold text-sm text-slate-200">{m.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {result ? `${t.correctAnswers} ${result.correctCount} / 40` : t.noScore}
                      </p>
                    </div>
                  </div>

                  <span className="font-mono font-black text-lg text-indigo-400">
                    {result ? `Band ${result.score}` : '--'}
                  </span>
                </div>
              );
            })}
          </div>

          <button
            onClick={onBack}
            className="w-full px-6 py-4.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-indigo-600/10 transition-all cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.01]"
          >
            {t.finishBtn}
          </button>
        </div>
      )}
    </div>
  );
}
