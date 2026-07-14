import React, { useState } from 'react';
import { BookOpen, Star, Trash2, Plus, Search, AlertCircle, Volume2, RotateCw, Loader2 } from 'lucide-react';
import { VocabularyItem } from '../../types';

interface VocabularyLibraryProps {
  vocabList: VocabularyItem[];
  onAddVocab: (vocab: Omit<VocabularyItem, 'id' | 'userId' | 'dateAdded'>) => Promise<void>;
  onDeleteVocab: (id: string) => Promise<void>;
  onToggleFavorite: (item: VocabularyItem) => Promise<void>;
  language: 'vi' | 'en';
}

// Subcomponent for each flippable 3D podcast card
function PodcastCard({
  item,
  onToggleFavorite,
  onDeleteVocab,
  speak,
  language
}: {
  item: any;
  onToggleFavorite: (item: any) => Promise<void>;
  onDeleteVocab: (id: string) => Promise<void>;
  speak: (word: string) => void;
  language: 'vi' | 'en';
  key?: string;
}) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handlePlayPronunciation = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPlaying(true);
    speak(item.word);
    setTimeout(() => {
      setIsPlaying(false);
    }, 1200);
  };

  const handleCardClick = () => {
    if (item.isEnriching || showDeleteConfirm) return;
    setIsFlipped(!isFlipped);
  };

  return (
    <div 
      className="relative h-[330px] w-full perspective-1000 cursor-pointer group"
      onClick={handleCardClick}
    >
      <div 
        className={`relative w-full h-full duration-500 transform-style-3d transition-transform ${
          isFlipped ? 'rotate-y-180' : ''
        }`}
      >
        {/* FRONT SIDE */}
        <div className="absolute inset-0 w-full h-full backface-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 shadow-sm p-6 flex flex-col justify-between overflow-hidden">
          {showDeleteConfirm && (
            <div 
              className="absolute inset-0 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-sm z-30 rounded-2xl p-6 flex flex-col justify-between text-center select-none"
              onClick={(e) => e.stopPropagation()} // Prevent card flip
            >
              <div className="flex flex-col items-center justify-center flex-1 space-y-3">
                <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
                  <Trash2 size={24} className="animate-bounce" />
                </div>
                <div>
                  <h5 className="font-extrabold text-sm text-white">
                    {language === 'vi' ? 'Xóa từ vựng này?' : 'Delete this word?'}
                  </h5>
                  <p className="text-[11px] text-slate-300 mt-1 max-w-[180px] mx-auto leading-normal">
                    {language === 'vi' 
                      ? `Bạn có chắc chắn muốn xóa từ "${item.word}" khỏi sổ tay?` 
                      : `Are you sure you want to delete "${item.word}"?`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(false);
                  }}
                  className="flex-1 py-2 bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-[11px] font-bold transition-all cursor-pointer"
                >
                  {language === 'vi' ? 'Hủy' : 'Cancel'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteVocab(item.id);
                    setShowDeleteConfirm(false);
                  }}
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[11px] font-bold transition-all shadow-md shadow-rose-500/10 cursor-pointer"
                >
                  {language === 'vi' ? 'Xóa' : 'Delete'}
                </button>
              </div>
            </div>
          )}

          {/* Top header - Favorite & Delete */}
          <div className="flex justify-between items-center z-10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(item);
              }}
              className="text-slate-300 hover:text-amber-500 transition-colors p-1"
            >
              <Star size={18} className={item.favorite ? 'fill-amber-500 text-amber-500' : ''} />
            </button>
            <div className="flex items-center gap-2">
              {item.source && (
                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold px-2 py-0.5 rounded-full max-w-[120px] truncate">
                  {item.source}
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(true);
                }}
                className="text-slate-300 hover:text-rose-500 transition-colors p-1"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* Center Content - Word and IPA */}
          <div className="flex flex-col items-center justify-center flex-1 py-4 text-center z-10">
            {item.isEnriching ? (
              <div className="flex flex-col items-center space-y-3">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                <p className="text-xs text-slate-400 font-semibold animate-pulse">
                  {language === 'vi' ? 'AI đang biên soạn từ vựng...' : 'AI is composing vocabulary...'}
                </p>
              </div>
            ) : (
              <>
                <h4 className="font-black text-2xl sm:text-3xl text-slate-800 dark:text-slate-100 tracking-tight group-hover:scale-105 transition-transform duration-300 break-words max-w-full">
                  {item.word}
                </h4>
                {item.ipa && (
                  <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-0.5 mt-2 rounded-full font-bold">
                    {item.ipa}
                  </span>
                )}
                {item.vietnameseMeaning && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">
                    {item.vietnameseMeaning}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Bottom Audio / Interactive Action */}
          <div className="flex flex-col items-center justify-center space-y-2 pb-2 z-10">
            {!item.isEnriching && (
              <>
                <button
                  onClick={handlePlayPronunciation}
                  className={`relative w-12 h-12 rounded-full flex items-center justify-center text-white transition-all shadow-md duration-300 bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 scale-100 active:scale-95 ${
                    isPlaying ? 'ring-4 ring-blue-500/30' : ''
                  }`}
                  title={language === 'vi' ? 'AI Phát âm' : 'AI Pronunciation'}
                >
                  <Volume2 size={20} className={isPlaying ? 'animate-bounce' : ''} />
                  {isPlaying && (
                    <>
                      <span className="absolute -inset-1 rounded-full border-2 border-blue-500 animate-ping opacity-75"></span>
                      <span className="absolute -inset-2 rounded-full border border-blue-400 animate-ping opacity-40"></span>
                    </>
                  )}
                </button>
                <div className="flex items-center gap-1 text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider group-hover:text-blue-500 transition-colors">
                  <RotateCw size={9} />
                  <span>{language === 'vi' ? 'Chạm để lật nghĩa' : 'Click to flip'}</span>
                </div>
              </>
            )}
          </div>

          <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-blue-50/40 dark:bg-slate-800/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="absolute -left-10 -top-10 w-32 h-32 bg-indigo-50/40 dark:bg-slate-800/5 rounded-full blur-2xl pointer-events-none"></div>
        </div>

        {/* BACK SIDE */}
        <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-md p-5 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-3 text-left text-xs">
            <div>
              <span className="text-[9px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest block mb-0.5">{language === 'vi' ? 'Định nghĩa / Tiếng Việt' : 'Definition / Vietnamese'}</span>
              <p className="font-extrabold text-slate-800 dark:text-slate-100 text-sm leading-snug">
                {item.vietnameseMeaning || item.meaning || <span className="italic text-slate-400 font-normal">{language === 'vi' ? 'Chưa cập nhật...' : 'Updating...'}</span>}
              </p>
            </div>

            {item.meaning && item.meaning !== item.vietnameseMeaning && (
              <div>
                <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-0.5">{language === 'vi' ? 'Giải nghĩa tiếng Anh' : 'English Meaning'}</span>
                <p className="font-semibold text-slate-600 dark:text-slate-300 leading-snug">
                  {item.meaning}
                </p>
              </div>
            )}

            {item.collocation && (
              <div>
                <span className="text-[9px] font-extrabold text-purple-600 dark:text-purple-400 uppercase tracking-widest block mb-1">Collocations</span>
                <div className="flex flex-wrap gap-1">
                  {item.collocation.split(',').map((col: string, idx: number) => (
                    <span key={idx} className="bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 font-semibold px-2 py-0.5 rounded text-[10px] border border-purple-100/50 dark:border-purple-900/30">
                      {col.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {item.example && (
              <div>
                <span className="text-[9px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block mb-0.5">{language === 'vi' ? 'Ví dụ đặt câu' : 'Example Sentence'}</span>
                <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-2.5 rounded-lg border-l-2 border-indigo-500">
                  <p className="text-slate-700 dark:text-slate-300 font-medium italic leading-relaxed">
                    "{item.example}"
                  </p>
                  {item.exampleTranslation && (
                    <p className="text-slate-500 dark:text-slate-400 mt-1 leading-relaxed text-[10px]">
                      {item.exampleTranslation}
                    </p>
                  )}
                </div>
              </div>
            )}

            {item.synonym && (
              <div>
                <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block mb-1">{language === 'vi' ? 'Từ đồng nghĩa' : 'Synonyms'}</span>
                <p className="text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                  {item.synonym}
                </p>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-200/40 dark:border-slate-800/60 flex items-center justify-between text-[9px] text-slate-400 font-bold">
            <span>{item.dateAdded ? new Date(item.dateAdded).toLocaleDateString() : ''}</span>
            <div className="flex items-center gap-1 hover:text-blue-500 transition-colors">
              <RotateCw size={10} />
              <span>{language === 'vi' ? 'Quay lại' : 'Flip front'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VocabularyLibrary({
  vocabList,
  onAddVocab,
  onDeleteVocab,
  onToggleFavorite,
  language
}: VocabularyLibraryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [favoriteOnly, setFavoriteOnly] = useState(false);

  // Simplified form states (student only inputs word and optional source)
  const [word, setWord] = useState('');
  const [source, setSource] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddVocab({
        word: word.trim(),
        source: source.trim() || (language === 'vi' ? 'Sổ tay cá nhân' : 'My Notebook'),
        favorite: false
      });
      // Reset
      setWord('');
      setSource('');
      setShowAddForm(false);
    } catch (err) {
      console.error('Error adding word:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredList = vocabList.filter(item => {
    const matchesSearch = item.word.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.vietnameseMeaning && item.vietnameseMeaning.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.meaning && item.meaning.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFavorite = !favoriteOnly || item.favorite;
    return matchesSearch && matchesFavorite;
  });

  const speak = (txt: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // cancel playing voices
      const utterance = new SpeechSynthesisUtterance(txt);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* CSS for 3D flip effect */}
      <style dangerouslySetInnerHTML={{ __html: `
        .perspective-1000 {
          perspective: 1000px;
        }
        .transform-style-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
      `}} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <BookOpen className="text-blue-600" />
            <span>{language === 'vi' ? 'Sổ từ vựng của tôi' : 'My Vocabulary Notebook'}</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'vi'
              ? 'Lưu trữ từ vựng. Bạn chỉ cần nhập từ, AI sẽ tự động tra cứu nghĩa, phát âm, ví dụ và cụm từ đi kèm.'
              : 'Save words. You only need to type the word, and AI will automatically resolve meaning, pronunciation, examples, and collocations.'}
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-blue-500/10 self-start sm:self-center cursor-pointer"
        >
          <Plus size={14} />
          {language === 'vi' ? 'Thêm từ mới' : 'Add New Word'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleFormSubmit} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 animate-scale-up">
          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 border-b border-slate-50 dark:border-slate-800 pb-2">
            {language === 'vi' ? 'Nhập từ vựng mới' : 'Enter New Word'}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{language === 'vi' ? 'Từ vựng (Bắt buộc)' : 'Word (Required)'}</label>
              <input
                type="text"
                required
                value={word}
                onChange={e => setWord(e.target.value)}
                placeholder="e.g. Inevitable, catch-22, play a role..."
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-850 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{language === 'vi' ? 'Nguồn tham khảo (Tùy chọn)' : 'Reference Source (Optional)'}</label>
              <input
                type="text"
                value={source}
                onChange={e => setSource(e.target.value)}
                placeholder="e.g. Reading Section 1, Cambridge 18..."
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-850 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-850 text-[11px]">
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-blue-500" />
            <span>
              {language === 'vi' 
                ? 'Sau khi lưu, AI sẽ tự tìm phiên âm, định nghĩa chi tiết, dịch nghĩa tiếng Việt, cụm từ collocation và ví dụ thực tế!'
                : 'After saving, AI will automatically generate IPA, detailed definitions, Vietnamese translations, collocations, and contextual examples!'}
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
            >
              {language === 'vi' ? 'Hủy' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting && <Loader2 size={12} className="animate-spin" />}
              {language === 'vi' ? 'Lưu lại' : 'Save'}
            </button>
          </div>
        </form>
      )}

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder={language === 'vi' ? 'Tìm từ vựng hoặc nghĩa tiếng Việt...' : 'Search word or translation...'}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-700 dark:text-slate-300 shadow-sm"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto shrink-0">
          <button
            onClick={() => setFavoriteOnly(!favoriteOnly)}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              favoriteOnly
                ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50 text-amber-600 dark:text-amber-400'
                : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            <Star size={14} className={favoriteOnly ? 'fill-amber-500 text-amber-500' : ''} />
            <span>{language === 'vi' ? 'Yêu thích' : 'Favorites'}</span>
          </button>
        </div>
      </div>

      {/* Podcast Card Grid */}
      <div>
        {filteredList.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400 dark:text-slate-500">
            <AlertCircle className="mx-auto text-slate-300 mb-2" size={32} />
            <p className="text-xs">
              {language === 'vi'
                ? 'Không tìm thấy từ vựng nào phù hợp.'
                : 'No vocabulary matches found.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredList.map(item => (
              <PodcastCard
                key={item.id}
                item={item}
                onToggleFavorite={onToggleFavorite}
                onDeleteVocab={onDeleteVocab}
                speak={speak}
                language={language}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
