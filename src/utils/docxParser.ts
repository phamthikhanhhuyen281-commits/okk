// Custom Parser for IELTS Word Documents (.docx)
// Supports tags: THÔNG TIN ĐỀ, SECTION, PASSAGE, QUESTION GROUP, QUESTION TYPE, QUESTION, ANSWER, TRANSCRIPT, VOCABULARY, TRANSLATION, EXPLANATION

export interface ParsedQuestion {
  number: number;
  text: string;
  options?: string[];
  answer?: string;
  explanation?: string;
}

export interface ParsedQuestionGroup {
  range: string;
  type: string;
  instruction: string;
  questions: ParsedQuestion[];
}

export interface ParsedPassage {
  title: string;
  content: string;
  translation?: string;
  vocabulary?: string;
}

export interface ParsedSection {
  id: string; // e.g., SECTION 1, PASSAGE 1, TASK 1, PART 1
  title?: string;
  passages: ParsedPassage[];
  questionGroups: ParsedQuestionGroup[];
  transcript?: string;
  translation?: string;
  vocabulary?: string;
}

export interface ParsedVocabulary {
  word: string;
  definition: string;
}

export interface ParsedExamData {
  info: {
    title: string;
    code: string;
    skill: string;
    difficulty: string;
    timeLimit: number;
    description: string;
  };
  sections: ParsedSection[];
  vocabulary: ParsedVocabulary[];
}

export interface ParserError {
  line: number;
  message: string;
  context: string;
}

export interface ParserResult {
  success: boolean;
  data?: ParsedExamData;
  error?: ParserError;
  warnings?: string[];
}

export function parseIELTSDocumentText(text: string): ParserResult {
  const lines = text.split(/\r?\n/);
  const warnings: string[] = [];
  
  const data: ParsedExamData = {
    info: {
      title: '',
      code: '',
      skill: 'listening',
      difficulty: 'Medium',
      timeLimit: 40,
      description: ''
    },
    sections: [],
    vocabulary: []
  };

  let currentState: 'NONE' | 'INFO' | 'CONTENT_BLOCK' | 'PASSAGE' | 'QUESTION_GROUP' | 'TRANSCRIPT' | 'VOCABULARY' | 'TRANSLATION' | 'EXPLANATION' | 'ANSWER' = 'NONE';
  let currentSection: ParsedSection | null = null;
  let currentPassage: ParsedPassage | null = null;
  let currentGroup: ParsedQuestionGroup | null = null;
  let lastParsedQuestion: ParsedQuestion | null = null;
  
  const answersMap = new Map<number, { text: string; explanation?: string }>();
  const declaredQuestions = new Set<number>();
  let lastQuestionNumber = 0;

  // Helper to ensure section exists
  function ensureSection(): ParsedSection {
    if (!currentSection) {
      currentSection = {
        id: 'SECTION 1',
        title: 'Practice Section',
        passages: [],
        questionGroups: [],
        transcript: '',
        translation: '',
        vocabulary: ''
      };
      data.sections.push(currentSection);
      warnings.push('Phát hiện nội dung nằm ngoài SECTION. Hệ thống tự động tạo "SECTION 1".');
    }
    return currentSection;
  }

  // Helper to ensure group exists
  function ensureGroup(): ParsedQuestionGroup {
    const sec = ensureSection();
    if (!currentGroup) {
      currentGroup = {
        range: '1-10',
        type: 'Sentence Completion',
        instruction: 'Complete the questions.',
        questions: []
      };
      sec.questionGroups.push(currentGroup);
      warnings.push('Phát hiện câu hỏi nằm ngoài nhóm. Hệ thống tự động tạo nhóm câu hỏi "1-10".');
    }
    return currentGroup;
  }

  // Robust heading classification
  function detectHeading(lineStr: string): { type: string; id?: string; title?: string } | null {
    const cleanLine = lineStr
      .normalize('NFC')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\u00A0/g, ' ')
      .trim();
    const upper = cleanLine.toUpperCase();

    // 1. INFO
    if (upper.includes("THÔNG TIN ĐỀ") || upper.includes("THONG TIN DE") || upper.includes("EXAM INFORMATION") || upper.includes("EXAM INFO")) {
      return { type: "INFO" };
    }

    // 2. Main Content Blocks (SECTION, PASSAGE, TASK, PART)
    // E.g. SECTION 1, PASSAGE 2, TASK 1, PART 1, PHẦN 1, BÀI ĐỌC 2, BÀI VIẾT 1, PHẦN NÓI 1
    const blockRegex = /^(?:SECTION|SECTIONS|PHẦN|PHAN|PASSAGE|PASSAGES|BÀI\s*ĐỌC|BAI\s*DOC|TASK|TASKS|BÀI\s*VIẾT|BAI\s*VIET|PART|PARTS|PHẦN\s*NÓI|PHAN\s*NOI)\s*(\d+)(?:[\s.:\-\–\—]*(.*))?/i;
    const blockMatch = cleanLine.match(blockRegex);
    if (blockMatch) {
      const num = blockMatch[1];
      const titleText = blockMatch[2] ? blockMatch[2].trim() : '';
      let label = "SECTION";
      if (/passage/i.test(cleanLine) || /bài\s*đọc/i.test(cleanLine) || /bai\s*doc/i.test(cleanLine)) {
        label = "PASSAGE";
      } else if (/task/i.test(cleanLine) || /bài\s*viết/i.test(cleanLine) || /bai\s*viet/i.test(cleanLine)) {
        label = "TASK";
      } else if (/part/i.test(cleanLine) || /phần\s*nói/i.test(cleanLine) || /phan\s*noi/i.test(cleanLine)) {
        label = "PART";
      }
      return { type: "CONTENT_BLOCK", id: `${label} ${num}`, title: titleText };
    }

    // 3. Standalone Passage
    const standalonePassageRegex = /^(?:PASSAGE|BÀI\s*ĐỌC|BAI\s*DOC)[:\s\-\–\—]+(.*)/i;
    const passageMatch = cleanLine.match(standalonePassageRegex);
    if (passageMatch && !/^\d/.test(passageMatch[1].trim())) {
      return { type: "PASSAGE_STANDALONE", title: passageMatch[1].trim() };
    }

    // 4. Question Group
    const groupRegex = /^(?:QUESTION\s*GROUP|NHÓM\s*CÂU\s*HỎI|NHOM\s*CAU\s*HOI)\s*(\d+(?:\s*[-–—tođến]+\s*\d+)?)/i;
    const groupMatch = cleanLine.match(groupRegex);
    if (groupMatch) {
      return { type: "QUESTION_GROUP", id: groupMatch[1] };
    }

    // Questions Range like "QUESTIONS 1-10" or "CÂU 1-10"
    const questionsRangeRegex = /^(?:QUESTIONS|CÂU|CAU|Q)\s*(\d+)\s*[-–—tođến]+\s*(\d+)/i;
    const rangeMatch = cleanLine.match(questionsRangeRegex);
    if (rangeMatch) {
      return { type: "QUESTION_GROUP", id: `${rangeMatch[1]}-${rangeMatch[2]}` };
    }

    // 5. Question Type
    if (upper.startsWith("QUESTION TYPE") || upper.startsWith("LOẠI CÂU HỎI") || upper.startsWith("LOAI CAU HOI") || upper.startsWith("DẠNG CÂU HỎI") || upper.startsWith("DANG CAU HOI") || upper.startsWith("DẠNG BÀI") || upper.startsWith("DANG BAI")) {
      return { type: "QUESTION_TYPE" };
    }

    // 6. Transcript
    if (upper.startsWith("TRANSCRIPT") || upper.startsWith("BẢN GHI ÂM") || upper.startsWith("BAN GHI AM") || upper.startsWith("TAPE") || upper.startsWith("TAPESCRIPT") || upper.startsWith("BÀI NGHE") || upper.startsWith("BAI NGHE")) {
      return { type: "TRANSCRIPT" };
    }

    // 7. Vocabulary
    if (upper.startsWith("VOCABULARY") || upper.startsWith("TỪ VỰNG") || upper.startsWith("TU VUNG") || upper.startsWith("GLOSSARY") || upper.startsWith("TU_VUNG")) {
      return { type: "VOCABULARY" };
    }

    // 8. Translation
    if (upper.startsWith("TRANSLATION") || upper.startsWith("BẢN DỊCH") || upper.startsWith("BAN DICH")) {
      return { type: "TRANSLATION" };
    }

    // 9. Answers Section
    if (upper.startsWith("ANSWERS") || upper.startsWith("ĐÁP ÁN") || upper.startsWith("DAP AN") || upper.startsWith("KEY") || upper.startsWith("KEYS") || upper.startsWith("ANSWER KEY") || upper.startsWith("ĐÁP ÁN CHI TIẾT") || upper.startsWith("BẢNG ĐÁP ÁN") || upper.startsWith("BANG DAP AN")) {
      return { type: "ANSWER_SECTION" };
    }

    // 10. Explanations Section
    if (upper.startsWith("EXPLANATIONS") || upper.startsWith("GIẢI THÍCH") || upper.startsWith("GIAI THICH") || upper.startsWith("EXPLANATION") || upper.startsWith("GIẢI THÍCH CHI TIẾT")) {
      return { type: "EXPLANATION_SECTION" };
    }

    return null;
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine
      .normalize('NFC')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\u00A0/g, ' ')
      .trim();

    // Handle empty lines gracefully based on active state
    if (!line) {
      if (currentState === 'PASSAGE' && currentPassage) {
        currentPassage.content += '\n';
      } else if (currentState === 'TRANSCRIPT' && currentSection) {
        currentSection.transcript = (currentSection.transcript || '') + '\n';
      } else if (currentState === 'TRANSLATION') {
        if (currentPassage) {
          currentPassage.translation = (currentPassage.translation || '') + '\n';
        } else if (currentSection) {
          currentSection.translation = (currentSection.translation || '') + '\n';
        }
      }
      continue;
    }

    // Detect heading switches
    const heading = detectHeading(line);
    if (heading) {
      switch (heading.type) {
        case 'INFO':
          currentState = 'INFO';
          break;
        case 'CONTENT_BLOCK':
          currentState = 'CONTENT_BLOCK';
          currentSection = {
            id: heading.id || 'SECTION',
            title: heading.title || '',
            passages: [],
            questionGroups: [],
            transcript: '',
            translation: '',
            vocabulary: ''
          };
          data.sections.push(currentSection);
          currentPassage = null;
          currentGroup = null;
          lastParsedQuestion = null;

          // Auto-initialize passage context for PASSAGE content blocks
          if (currentSection.id.startsWith('PASSAGE') || currentSection.id.startsWith('BÀI ĐỌC') || currentSection.id.startsWith('BAI DOC')) {
            currentPassage = {
              title: currentSection.title || currentSection.id,
              content: ''
            };
            currentSection.passages.push(currentPassage);
          }
          break;

        case 'PASSAGE_STANDALONE':
          currentState = 'PASSAGE';
          const sec = ensureSection();
          currentPassage = {
            title: heading.title || 'Untitled Passage',
            content: ''
          };
          sec.passages.push(currentPassage);
          currentGroup = null;
          lastParsedQuestion = null;
          break;

        case 'QUESTION_GROUP':
          currentState = 'QUESTION_GROUP';
          const sectionCtx = ensureSection();
          const range = heading.id || '1-10';
          
          // Look for existing group with matching range to support scattered sheets
          const existing = sectionCtx.questionGroups.find(g => g.range === range);
          if (existing) {
            currentGroup = existing;
          } else {
            currentGroup = {
              range,
              type: 'Sentence Completion', // Default
              instruction: '',
              questions: []
            };
            sectionCtx.questionGroups.push(currentGroup);
          }
          currentPassage = null;
          lastParsedQuestion = null;
          break;

        case 'QUESTION_TYPE':
          // The line itself switches context conceptually, handled inline in QUESTION_GROUP
          break;

        case 'TRANSCRIPT':
          currentState = 'TRANSCRIPT';
          const tSec = ensureSection();
          tSec.transcript = '';
          currentPassage = null;
          currentGroup = null;
          lastParsedQuestion = null;
          break;

        case 'TRANSLATION':
          currentState = 'TRANSLATION';
          currentGroup = null;
          lastParsedQuestion = null;
          break;

        case 'VOCABULARY':
          currentState = 'VOCABULARY';
          currentGroup = null;
          lastParsedQuestion = null;
          break;

        case 'ANSWER_SECTION':
          currentState = 'ANSWER';
          currentGroup = null;
          lastParsedQuestion = null;
          break;

        case 'EXPLANATION_SECTION':
          currentState = 'EXPLANATION';
          currentGroup = null;
          lastParsedQuestion = null;
          break;
      }
      continue;
    }

    // Intercept explicit ANSWER and EXPLANATION declarations globally for robust matching,
    // avoiding false matches inside raw Passage readings, Translations, and Transcripts.
    if (currentState !== 'PASSAGE' && currentState !== 'TRANSCRIPT' && currentState !== 'TRANSLATION') {
      // 1. Explicit Answer format: e.g. "ANSWER 5: TRUE" or "ĐÁP ÁN: 12. A" or "ĐÁP ÁN CÂU 12: A"
      const explicitAnswerMatch = line.match(/^[-\*•\s=>~]*?(?:ANSWER|ĐÁP\s*ÁN|DAP\s*AN|ANS|KEY)[\s.:\)\-–—\/]*(?:FOR|TO|CÂU\s*HỎI|CAU\s*HOI|CÂU|CAU|QUESTION|Q|q)?\s*(\d+)(?![\s\d]*[-–—tođến]+\d+)[\s.:\)\-–—\/]*\s*(.*)/i);
      if (explicitAnswerMatch) {
        const ansNum = parseInt(explicitAnswerMatch[1]);
        let ansText = explicitAnswerMatch[2] ? explicitAnswerMatch[2].trim() : '';

        // If empty on the same line, peek at the next non-empty line
        if (!ansText) {
          let nextIdx = i + 1;
          while (nextIdx < lines.length) {
            const peekLine = lines[nextIdx].trim();
            if (peekLine) {
              if (detectHeading(peekLine) || peekLine.toUpperCase().startsWith('QUESTION') || peekLine.toUpperCase().startsWith('CÂU') || peekLine.toUpperCase().startsWith('CAU')) {
                break;
              }
              ansText = peekLine;
              i = nextIdx; // consume line
              break;
            }
            nextIdx++;
          }
        }

        if (ansNum > 0) {
          let textOnly = ansText || 'No answer provided';
          let inlineExp = '';
          const inlineMatch = textOnly.match(/(?:\(|\[)\s*(?:explanation|giải\s*thích|giai\s*thich|explain|why)\s*[:\-]\s*(.*?)\s*(?:\)|\])/i);
          if (inlineMatch) {
            inlineExp = inlineMatch[1].trim();
            textOnly = textOnly.replace(inlineMatch[0], '').trim();
          }

          const existing = answersMap.get(ansNum) || { text: '' };
          existing.text = textOnly;
          if (inlineExp) {
            existing.explanation = inlineExp;
          }
          answersMap.set(ansNum, existing);
        }
        continue;
      }

      // 2. Explicit Explanation format: e.g. "EXPLANATION: 5. because..." or "GIẢI THÍCH 5: because the writer mentioned..."
      const explicitExplanationMatch = line.match(/^[-\*•\s=>~]*?(?:EXPLANATION|GIẢI\s*THÍCH|GIAI\s*THICH|EXPLAIN|EXPL)[\s.:\)\-–—\/]*(?:FOR|TO|CÂU\s*HỎI|CAU\s*HOI|CÂU|CAU|QUESTION|Q|q)?\s*(\d+)(?![\s\d]*[-–—tođến]+\d+)[\s.:\)\-–—\/]*\s*(.*)/i);
      if (explicitExplanationMatch) {
        const expNum = parseInt(explicitExplanationMatch[1]);
        let expText = explicitExplanationMatch[2] ? explicitExplanationMatch[2].trim() : '';

        if (!expText) {
          let nextIdx = i + 1;
          while (nextIdx < lines.length) {
            const peekLine = lines[nextIdx].trim();
            if (peekLine) {
              if (detectHeading(peekLine) || peekLine.toUpperCase().startsWith('QUESTION') || peekLine.toUpperCase().startsWith('CÂU') || peekLine.toUpperCase().startsWith('CAU')) {
                break;
              }
              expText = peekLine;
              i = nextIdx; // consume line
              break;
            }
            nextIdx++;
          }
        }

        if (expNum > 0) {
          const existing = answersMap.get(expNum) || { text: '' };
          existing.explanation = expText;
          answersMap.set(expNum, existing);
          lastQuestionNumber = expNum; // Track for potential multi-line details
        }
        continue;
      }
    }

    // Standard state accumulator processing
    if (currentState === 'INFO') {
      const parts = line.split(/[:=]/);
      if (parts.length >= 2) {
        const key = parts[0].trim().toUpperCase();
        const val = parts.slice(1).join(':').trim();
        
        if (key.includes('TÊN ĐỀ') || key.includes('TEN DE') || key.includes('TITLE')) {
          data.info.title = val;
        } else if (key.includes('MÃ ĐỀ') || key.includes('MA DE') || key.includes('CODE')) {
          data.info.code = val;
        } else if (key.includes('KỸ NĂNG') || key.includes('KY NANG') || key.includes('SKILL')) {
          data.info.skill = val.toLowerCase();
        } else if (key.includes('ĐỘ KHÓ') || key.includes('DO KHO') || key.includes('DIFFICULTY')) {
          data.info.difficulty = val;
        } else if (key.includes('THỜI GIAN') || key.includes('THOI GIAN') || key.includes('TIME')) {
          data.info.timeLimit = parseInt(val) || 40;
        } else if (key.includes('MÔ TẢ') || key.includes('MO TA') || key.includes('DESCRIPTION')) {
          data.info.description = val;
        }
      } else if (data.info.description) {
        data.info.description += '\n' + line;
      }
      continue;
    }

    if (currentState === 'PASSAGE') {
      const sec = ensureSection();
      if (!currentPassage) {
        currentPassage = {
          title: 'Passage Content',
          content: ''
        };
        sec.passages.push(currentPassage);
      }
      currentPassage.content += (currentPassage.content ? '\n' : '') + rawLine;
      continue;
    }

    if (currentState === 'TRANSCRIPT') {
      const sec = ensureSection();
      sec.transcript += (sec.transcript ? '\n' : '') + rawLine;
      continue;
    }

    if (currentState === 'TRANSLATION') {
      const sec = ensureSection();
      if (currentPassage) {
        currentPassage.translation = (currentPassage.translation || '') + (currentPassage.translation ? '\n' : '') + rawLine;
      } else {
        sec.translation = (sec.translation || '') + (sec.translation ? '\n' : '') + rawLine;
      }
      continue;
    }

    if (currentState === 'VOCABULARY') {
      // Extensible vocabulary parser supporting bullets, numbering, or plain text lists
      const cleaned = line.replace(/^[-*•\d+.\s/()]+/, '').trim();
      let wordPart = '';
      let definitionPart = '';

      const separators = [':', '—', '–', '-', '='];
      let matchedSep = false;
      for (const sep of separators) {
        const idx = cleaned.indexOf(sep);
        if (idx !== -1) {
          wordPart = cleaned.substring(0, idx).trim();
          definitionPart = cleaned.substring(idx + 1).trim();
          matchedSep = true;
          break;
        }
      }

      if (!matchedSep) {
        wordPart = cleaned;
        definitionPart = '';
      }

      const cleanW = cleanVocabularyWord(wordPart);
      if (cleanW) {
        data.vocabulary.push({
          word: cleanW,
          definition: definitionPart
        });
      }

      // Append raw list to displaying contexts
      const sec = ensureSection();
      if (currentPassage) {
        currentPassage.vocabulary = (currentPassage.vocabulary || '') + (currentPassage.vocabulary ? '\n' : '') + rawLine;
      } else {
        sec.vocabulary = (sec.vocabulary || '') + (sec.vocabulary ? '\n' : '') + rawLine;
      }
      continue;
    }

    if (currentState === 'EXPLANATION') {
      // Multi-line explanation matcher: look for numbered list: e.g. "5. text..."
      const expMatch = line.match(/^[-\*•\s]*(?:Question|Câu|Cau|Q|q)?\s*(\d+)[\s.:\)\-–—\/]*\s*(.*)/i);
      if (expMatch) {
        const num = parseInt(expMatch[1]);
        const explanationText = expMatch[2].trim();
        const existing = answersMap.get(num) || { text: '' };
        existing.explanation = explanationText;
        answersMap.set(num, existing);
        lastQuestionNumber = num;
      } else if (lastQuestionNumber > 0) {
        const existing = answersMap.get(lastQuestionNumber);
        if (existing) {
          existing.explanation = (existing.explanation || '') + '\n' + line;
          answersMap.set(lastQuestionNumber, existing);
        }
      }
      continue;
    }

    if (currentState === 'ANSWER') {
      // Look for standard key-value answer lists inside answer section: e.g. "5. A"
      const ansMatch = line.match(/^[-\*•\s]*(?:(?:ANSWER|ĐÁP\s*ÁN|DAP\s*AN|ANS|KEY)\s*(?:FOR|TO|CÂU\s*HỎI|CAU\s*HOI|CÂU|CAU|QUESTION|Q|q)?|(?:Question|Câu|Cau|Q|q))?\s*(\d+)[\s.:\)\-–—\/]*\s*(.*)/i);
      if (ansMatch) {
        const num = parseInt(ansMatch[1]);
        const valText = ansMatch[2].trim();
        const existing = answersMap.get(num) || { text: '' };

        let textOnly = valText || 'No answer provided';
        let inlineExp = '';
        const inlineMatch = textOnly.match(/(?:\(|\[)\s*(?:explanation|giải\s*thích|giai\s*thich|explain|why)\s*[:\-]\s*(.*?)\s*(?:\)|\])/i);
        if (inlineMatch) {
          inlineExp = inlineMatch[1].trim();
          textOnly = textOnly.replace(inlineMatch[0], '').trim();
        }

        existing.text = textOnly;
        if (inlineExp) {
          existing.explanation = inlineExp;
        }
        answersMap.set(num, existing);
      }
      continue;
    }

    if (currentState === 'QUESTION_GROUP') {
      const group = ensureGroup();

      // Check if it is an inline answer line
      const inlineAnswerMatch = line.match(/^[-\*•\s=>~]*?(?:ANSWER|ĐÁP\s*ÁN|DAP\s*AN|ANS|KEY)[\s.:\)\-–—\/]*(?:FOR|TO|CÂU\s*HỎI|CAU\s*HOI|CÂU|CAU|QUESTION|Q|q)?\s*(\d+)?[\s.:\)\-–—\/]*\s*(.*)/i);
      if (inlineAnswerMatch) {
        const numVal = inlineAnswerMatch[1] ? parseInt(inlineAnswerMatch[1]) : null;
        let ansText = inlineAnswerMatch[2] ? inlineAnswerMatch[2].trim() : '';

        // If empty, peek
        if (!ansText) {
          let nextIdx = i + 1;
          while (nextIdx < lines.length) {
            const peekLine = lines[nextIdx].trim();
            if (peekLine) {
              if (detectHeading(peekLine) || peekLine.toUpperCase().startsWith('QUESTION') || peekLine.toUpperCase().startsWith('CÂU') || peekLine.toUpperCase().startsWith('CAU')) {
                break;
              }
              ansText = peekLine;
              i = nextIdx;
              break;
            }
            nextIdx++;
          }
        }

        let textOnly = ansText || 'No answer provided';
        let inlineExp = '';
        const inlineMatch = textOnly.match(/(?:\(|\[)\s*(?:explanation|giải\s*thích|giai\s*thich|explain|why)\s*[:\-]\s*(.*?)\s*(?:\)|\])/i);
        if (inlineMatch) {
          inlineExp = inlineMatch[1].trim();
          textOnly = textOnly.replace(inlineMatch[0], '').trim();
        }

        const targetQNum = numVal || (lastParsedQuestion ? lastParsedQuestion.number : null);
        if (targetQNum) {
          const existing = answersMap.get(targetQNum) || { text: '' };
          existing.text = textOnly;
          if (inlineExp) {
            existing.explanation = inlineExp;
          }
          answersMap.set(targetQNum, existing);

          // Update active question directly if it matches the active question number or there was no explicit number
          if (lastParsedQuestion && lastParsedQuestion.number === targetQNum) {
            lastParsedQuestion.answer = textOnly;
            if (inlineExp) {
              lastParsedQuestion.explanation = inlineExp;
            }
          }
        }
        continue;
      }

      // Check if it is an inline explanation line
      const inlineExplanationMatch = line.match(/^[-\*•\s=>~]*?(?:EXPLANATION|GIẢI\s*THÍCH|GIAI\s*THICH|EXPLAIN|EXPL)[\s.:\)\-–—\/]*(?:FOR|TO|CÂU\s*HỎI|CAU\s*HOI|CÂU|CAU|QUESTION|Q|q)?\s*(\d+)?[\s.:\)\-–—\/]*\s*(.*)/i);
      if (inlineExplanationMatch) {
        const numVal = inlineExplanationMatch[1] ? parseInt(inlineExplanationMatch[1]) : null;
        let expText = inlineExplanationMatch[2] ? inlineExplanationMatch[2].trim() : '';

        // If empty, peek
        if (!expText) {
          let nextIdx = i + 1;
          while (nextIdx < lines.length) {
            const peekLine = lines[nextIdx].trim();
            if (peekLine) {
              if (detectHeading(peekLine) || peekLine.toUpperCase().startsWith('QUESTION') || peekLine.toUpperCase().startsWith('CÂU') || peekLine.toUpperCase().startsWith('CAU')) {
                break;
              }
              expText = peekLine;
              i = nextIdx;
              break;
            }
            nextIdx++;
          }
        }

        const targetQNum = numVal || (lastParsedQuestion ? lastParsedQuestion.number : null);
        if (targetQNum) {
          const existing = answersMap.get(targetQNum) || { text: '' };
          existing.explanation = expText;
          answersMap.set(targetQNum, existing);

          if (lastParsedQuestion && lastParsedQuestion.number === targetQNum) {
            lastParsedQuestion.explanation = expText;
          }
        }
        continue;
      }

      // Check if it's a QUESTION TYPE specification
      const upperLine = line.toUpperCase();
      const isTypeLine = upperLine.startsWith('QUESTION TYPE') || 
                         upperLine.startsWith('DẠNG CÂU HỎI') || 
                         upperLine.startsWith('DANG CAU HOI') ||
                         upperLine.startsWith('LOẠI CÂU HỎI') ||
                         upperLine.startsWith('LOAI CAU HOI') ||
                         upperLine.startsWith('DẠNG BÀI') ||
                         upperLine.startsWith('DANG BAI') ||
                         upperLine.startsWith('LOẠI BÀI') ||
                         upperLine.startsWith('LOAI BAI');
      if (isTypeLine) {
        const parts = line.split(':');
        let typeVal = '';
        if (parts.length >= 2) {
          typeVal = parts.slice(1).join(':').trim();
        } else {
          typeVal = line.replace(/^(?:QUESTION TYPE|DẠNG CÂU HỎI|DANG CAU HOI|LOẠI CÂU HỎI|LOAI CAU HOI|DẠNG BÀI|DANG BAI|LOẠI BÀI|LOAI BAI)[:\s]*/i, '').trim();
        }

        if (!typeVal) {
          // Peek ahead
          let nextIdx = i + 1;
          while (nextIdx < lines.length) {
            const peekLine = lines[nextIdx].trim();
            if (peekLine) {
              if (detectHeading(peekLine) || peekLine.toUpperCase().startsWith('QUESTION') || peekLine.toUpperCase().startsWith('CÂU') || peekLine.toUpperCase().startsWith('CAU')) {
                break;
              }
              typeVal = peekLine;
              i = nextIdx; // consume line
              break;
            }
            nextIdx++;
          }
        }
        if (typeVal) {
          group.type = typeVal;
        }
        continue;
      }

      // Match question definitions
      let qNum: number | null = null;
      let qText = '';

      const isStandaloneQL = /^[-\*•\s]*(?:QUESTION|CÂU|CAU)[:\s\-\/.]*$/i.test(line);
      if (isStandaloneQL) {
        lastQuestionNumber++;
        qNum = lastQuestionNumber;
        // Peek ahead
        let nextIdx = i + 1;
        while (nextIdx < lines.length) {
          const peekLine = lines[nextIdx].trim();
          if (peekLine) {
            if (detectHeading(peekLine) || peekLine.toUpperCase().startsWith('QUESTION') || peekLine.toUpperCase().startsWith('CÂU') || peekLine.toUpperCase().startsWith('CAU')) {
              break;
            }
            qText = peekLine;
            i = nextIdx; // consume line
            break;
          }
          nextIdx++;
        }
      } else {
        const qPrefixMatch = line.match(/^[-\*•\s]*(?:QUESTION|CÂU|CAU|Q)\s*(\d+)[\s.:\)\-–—\/]*\s*(.*)/i);
        const qRawNumMatch = line.match(/^[-\*•\s]*(\d+)(?![\s\d]*[-–—tođến]+\d+)[\s.:\)\-–—\/]+\s*(.*)/) || 
                             line.match(/^[-\*•\s]*\[(\d+)\]\s*(.*)/);
        
        if (qPrefixMatch) {
          qNum = parseInt(qPrefixMatch[1]);
          qText = qPrefixMatch[2].trim();
        } else if (qRawNumMatch) {
          qNum = parseInt(qRawNumMatch[1]);
          qText = qRawNumMatch[2].trim();
        }
      }

      if (qNum !== null) {
        lastQuestionNumber = Math.max(lastQuestionNumber, qNum);
        declaredQuestions.add(qNum);

        if (!qText) {
          // Peek ahead
          let nextIdx = i + 1;
          while (nextIdx < lines.length) {
            const peekLine = lines[nextIdx].trim();
            if (peekLine) {
              const upperPeek = peekLine.toUpperCase();
              if (detectHeading(peekLine) || upperPeek.startsWith('QUESTION') || upperPeek.startsWith('CÂU') || upperPeek.startsWith('CAU')) {
                break;
              }
              qText = peekLine;
              i = nextIdx; // consume line
              break;
            }
            nextIdx++;
          }
        }

        const newQ: ParsedQuestion = {
          number: qNum,
          text: qText || 'No question text provided',
          options: []
        };
        group.questions.push(newQ);
        lastParsedQuestion = newQ;
        continue;
      }

      // Check if it is a Multiple Choice Option line: e.g. "A. Option Text"
      const optionMatch = line.match(/^[-\*•\s]*([A-E])[\s.:\)\/]+\s*(.*)/i);
      if (optionMatch && lastParsedQuestion) {
        const letter = optionMatch[1].toUpperCase();
        const optionText = optionMatch[2].trim();
        if (!lastParsedQuestion.options) {
          lastParsedQuestion.options = [];
        }
        lastParsedQuestion.options.push(`${letter}. ${optionText}`);
        continue;
      }

      // Append multi-line question text or instruction text
      if (lastParsedQuestion) {
        lastParsedQuestion.text += '\n' + line;
      } else {
        if (!group.instruction) {
          group.instruction = line;
        } else {
          group.instruction += '\n' + line;
        }
      }
    }
  }

  // Bind answers and build diagnostics
  data.sections.forEach(sec => {
    // Clean empty question groups
    sec.questionGroups = sec.questionGroups.filter(grp => grp.questions.length > 0);

    sec.questionGroups.forEach(grp => {
      grp.questions.forEach(q => {
        const ans = answersMap.get(q.number);
        if (ans) {
          q.answer = ans.text;
          if (ans.explanation) {
            q.explanation = ans.explanation;
          }
        } else {
          // Fault tolerant fallback - don't crash, warn instead
          q.answer = '';
          warnings.push(`Câu hỏi số ${q.number} thiếu đáp án tương ứng (Hệ thống đã tự động bổ sung đáp án trống).`);
        }
      });
    });
  });

  // Ensure there's at least one section
  if (data.sections.length === 0) {
    const defaultSec: ParsedSection = {
      id: 'SECTION 1',
      title: 'Practice Section',
      passages: [],
      questionGroups: []
    };
    data.sections.push(defaultSec);
    warnings.push('Không phát hiện thấy SECTION/PASSAGE/TASK/PART nào trong văn bản (Hệ thống đã tự động bổ sung SECTION 1).');
  }

  return {
    success: true,
    data,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

// Generate standard default Word text templates for each skill type
export function getDefaultIELTSTemplateText(skill: string, title: string = 'Sample Practice Test', code: string = 'IELTS-TST-01'): string {
  if (skill === 'listening') {
    return `THÔNG TIN ĐỀ
Tên đề: ${title}
Mã đề: ${code}
Kỹ năng: listening
Độ khó: Medium
Thời gian: 40 phút
Mô tả: Bài luyện tập Listening tiêu chuẩn đầy đủ.

SECTION 1
QUESTION GROUP 1-5
QUESTION TYPE: Sentence Completion
Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.
Complete the travel reservation details.

QUESTION 1: Name of the traveler: Mr. James [1] _______________
QUESTION 2: Departure city: [2] _______________
QUESTION 3: Date of flight: [3] _______________ September
QUESTION 4: Seat preference: [4] _______________ seat
QUESTION 5: Total cost of ticket: £[5] _______________

ANSWER 1: Harrison
ANSWER 2: Sydney
ANSWER 3: 21st
ANSWER 4: window
ANSWER 5: 450

TRANSCRIPT
MAN: Travel booking services, Mr. Harrison speaking. How can I help you today?
WOMAN: Hello, I would like to confirm my booking to Sydney on the 21st of September.
MAN: Certainly, let me pull up your records. Yes, Mr. James Harrison...

VOCABULARY
- reservation: sự đặt chỗ (noun)
- confirm: xác nhận (verb)
- departure: sự khởi hành (noun)
`;
  } else if (skill === 'reading') {
    return `THÔNG TIN ĐỀ
Tên đề: ${title}
Mã đề: ${code}
Kỹ năng: reading
Độ khó: Medium
Thời gian: 60 phút
Mô tả: Bài thi Reading chuẩn hóa.

SECTION 1
PASSAGE 1: The Rise of Artificial Intelligence
Artificial Intelligence (AI) is transforming the landscape of modern education. By automating grading systems and delivering customized tutoring feedback, AI systems enable educators to focus on mentoring rather than administration. However, concerns regarding data privacy and the loss of interpersonal connection remain primary obstacles to widespread institutional integration.

QUESTION GROUP 1-3
QUESTION TYPE: True/False/Not Given
Do the following statements agree with the information given in Reading Passage 1?
Write TRUE if the statement agrees with the information, FALSE if it contradicts, or NOT GIVEN if there is no information.

QUESTION 1: AI helps teachers reduce their grading workload.
QUESTION 2: Educators completely dislike using AI in universities.
QUESTION 3: Data privacy is a minor concern in school AI deployments.

ANSWER 1: TRUE
ANSWER 2: FALSE
ANSWER 3: FALSE

VOCABULARY
- artificial: nhân tạo (adj)
- obstacle: trở ngại (noun)
- customized: tùy biến, cá nhân hóa (adj)
`;
  } else if (skill === 'writing') {
    return `THÔNG TIN ĐỀ
Tên đề: ${title}
Mã đề: ${code}
Kỹ năng: writing
Độ khó: Hard
Thời gian: 60 phút
Mô tả: Đề bài IELTS Writing Học thuật Task 1 & Task 2.

SECTION 1
QUESTION GROUP 1-1
QUESTION TYPE: Academic Writing Task 1
The chart below shows the percentage of energy generated from coal in three European countries from 2000 to 2020.
Summarize the information by selecting and reporting the main features, and make comparisons where relevant.
Write at least 150 words.

QUESTION 1: [Task 1 Prompt] Describe the energy source comparisons shown in the chart.

ANSWER 1: [Sample Band 8.0 Model Answer] The line graph compares the percentage of total electricity produced from coal in Sweden, Germany, and France between 2000 and 2020...

VOCABULARY
- electricity: điện năng (noun)
- compare: so sánh (verb)
- transition: sự chuyển dịch (noun)
`;
  } else if (skill === 'speaking') {
    return `THÔNG TIN ĐỀ
Tên đề: ${title}
Mã đề: ${code}
Kỹ năng: speaking
Độ khó: Medium
Thời gian: 15 phút
Mô tả: Đề phỏng vấn IELTS Speaking gồm Part 1, 2 và 3.

SECTION 1
QUESTION GROUP 1-3
QUESTION TYPE: Interview Q&A
Answer the examiner's speaking questions as naturally as possible.

QUESTION 1: Part 1 - What is your favorite hobby and why?
QUESTION 2: Part 2 - Describe a book you read recently that you found helpful.
QUESTION 3: Part 3 - Do you think technology will completely replace paper books?

ANSWER 1: My absolute favorite hobby is reading history books, because it teaches me...
ANSWER 2: Recently, I read Atomic Habits by James Clear. It has very practical tips...
ANSWER 3: I do not believe technology will fully replace printed books, because holding a real book...

VOCABULARY
- hobby: sở thích (noun)
- printed: được in ấn (adj)
- substitute: sự thay thế (noun)
`;
  }

  // Fallback Full Test
  return `THÔNG TIN ĐỀ
Tên đề: ${title}
Mã đề: ${code}
Kỹ năng: full
Độ khó: Hard
Thời gian: 140 phút
Mô tả: Full Test IELTS bao gồm các kỹ năng đầy đủ.

SECTION 1
QUESTION GROUP 1-10
QUESTION TYPE: Listening Section 1
QUESTION 1: Booking Reference: [1] _______________
ANSWER 1: BR-9988

VOCABULARY
- enrollment: sự tuyển sinh (noun)
`;
}

export function cleanVocabularyWord(rawWord: string): string {
  if (!rawWord) return '';
  let word = rawWord.trim();
  
  // 1. Remove list/bullets or numbers at the start (e.g. "- reservation", "1. confirm", "• departure")
  word = word.replace(/^[-*•\d+.\s/()]+/g, '');
  
  // 2. Remove IPA phonetics if written inside the word part, e.g. "reservation /ˌrez.əˈveɪ.ʃən/" -> "reservation"
  word = word.replace(/\/.*?\//g, '');
  
  // 3. Remove parts of speech in parentheses (e.g., "(noun)", "(v)", "(adj)", "(adverb)", "(adj.)", etc.)
  word = word.replace(/\((?:noun|verb|adj|adverb|adjective|pronoun|preposition|conjunction|interjection|n|v|adj|adv)\.?\)/i, '');
  
  // 4. Remove other parenthesized contents
  word = word.replace(/\(.*?\)/g, '');
  
  // 5. Clean any trailing or leading non-word symbols except space (like dashes, colons, dots)
  word = word.replace(/^[:\-.\s]+|[:\-.\s]+$/g, '');
  
  return word.trim();
}
