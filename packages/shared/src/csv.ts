import { BALANCE } from './balance.js';
import { cleanDistractors, isPlaceholderAnswer, normalizeText } from './choices.js';
import { DIFFICULTIES, type Difficulty } from './subjects.js';

/* ------------------------------------------------------------------ RFC 4180 parsing / writing */

export interface ParsedCsv {
  rows: string[][];
  /** Set when the file is structurally broken (e.g. an unterminated quote). */
  error?: string;
}

/**
 * RFC 4180-style parser: comma separated, CRLF or LF, "quoted" fields with embedded commas/newlines and
 * "" for a literal quote. A UTF-8 BOM is ignored; fully blank lines are skipped. A quote in the middle of
 * an unquoted field is kept literally (spreadsheets do produce those).
 */
export function parseCsv(input: string): ParsedCsv {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let fieldStarted = false;
  let quotedStartRow = 0;

  const endField = () => {
    row.push(field);
    field = '';
    fieldStarted = false;
  };
  const endRow = () => {
    endField();
    if (!(row.length === 1 && row[0] === '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i] as string;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
      quotedStartRow = rows.length + 1;
    } else if (ch === ',') endField();
    else if (ch === '\n') endRow();
    else if (ch === '\r') {
      if (text[i + 1] === '\n') i++;
      endRow();
    } else {
      field += ch;
      fieldStarted = true;
    }
  }
  if (inQuotes)
    return { rows, error: `Unterminated quoted field starting at row ${quotedStartRow}` };
  if (fieldStarted || field !== '' || row.length > 0) endRow();
  return { rows };
}

/**
 * CSV formula injection hardening: a cell that starts with = + - @ (or a tab/CR) could run as a formula
 * when opened in a spreadsheet. On export such cells get a leading apostrophe; on import a leading
 * apostrophe before one of those characters is removed, so exports round-trip exactly.
 */
export const neutralizeFormula = (cell: string): string =>
  /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell;
export const restoreFormula = (cell: string): string =>
  /^'[=+\-@\t\r]/.test(cell) ? cell.slice(1) : cell;

const quoteCell = (cell: string): string =>
  /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;

export const toCsv = (rows: readonly (readonly string[])[]): string =>
  rows.map((r) => r.map((c) => quoteCell(neutralizeFormula(c))).join(',')).join('\r\n') + '\r\n';

/* ------------------------------------------------------------------ Flashcard CSV */

export const CSV_HEADER = [
  'question',
  'correct',
  'wrong1',
  'wrong2',
  'subject',
  'difficulty',
] as const;
export const CSV_REVIEW_COLUMNS = ['ease', 'interval', 'repetitions', 'nextReview'] as const;

export interface CsvCard {
  /** Spreadsheet row number (the header is row 1). */
  row: number;
  question: string;
  answer: string;
  distractors: string[];
  subject: string | null;
  difficulty: Difficulty | null;
  review: { ease: number; intervalDays: number; repetitions: number; dueAt: Date } | null;
}
export interface CsvRowIssue {
  row: number;
  message: string;
}
export interface FlashcardCsvParse {
  cards: CsvCard[];
  errors: CsvRowIssue[];
  /** Data rows seen (excluding the header and blank lines). */
  totalRows: number;
  /** Set when nothing can be imported at all (bad header, too big, broken quoting). */
  fatal?: string;
}

export interface ExportableCard {
  question: string;
  answer: string;
  distractors: readonly string[];
  subject: string;
  difficulty: Difficulty;
  ease: number;
  intervalDays: number;
  repetitions: number;
  dueAt: Date;
}

export function flashcardsToCsv(cards: readonly ExportableCard[], includeReview: boolean): string {
  const header: string[] = [...CSV_HEADER, ...(includeReview ? CSV_REVIEW_COLUMNS : [])];
  const rows: string[][] = [header];
  for (const c of cards) {
    const wrong = cleanDistractors(c.answer, c.distractors);
    rows.push([
      c.question,
      c.answer,
      wrong[0] ?? '',
      wrong[1] ?? '',
      c.subject,
      c.difficulty,
      ...(includeReview
        ? [String(c.ease), String(c.intervalDays), String(c.repetitions), c.dueAt.toISOString()]
        : []),
    ]);
  }
  return toCsv(rows);
}

const num = (v: string): number | null =>
  v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null;

/**
 * Parses flashcard CSV text. Accepts the new header (question,correct,wrong1,wrong2,subject,difficulty
 * [,ease,interval,repetitions,nextReview]) and the old export header (no "difficulty"). Extra
 * "wrong3".."wrong5" columns are accepted. Every bad row yields a message like "row 14: missing answer";
 * good rows are still returned. Placeholder wrong answers ("N/A", empty) are dropped.
 */
export function parseFlashcardCsv(
  text: string,
  limits: { maxBytes: number; maxRows: number } = BALANCE.csv,
): FlashcardCsvParse {
  const empty = (fatal: string): FlashcardCsvParse => ({
    cards: [],
    errors: [],
    totalRows: 0,
    fatal,
  });
  if (text.length > limits.maxBytes)
    return empty(`The file is too large (max ${limits.maxBytes} characters).`);
  const parsed = parseCsv(text);
  if (parsed.error) return empty(parsed.error);
  const [headerRow, ...body] = parsed.rows;
  if (!headerRow) return empty('The file is empty.');

  const header = headerRow.map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const iQ = col('question');
  const iC = col('correct');
  if (iQ < 0 || iC < 0)
    return empty('Missing header. The first row must contain at least "question" and "correct".');
  if (body.length > limits.maxRows)
    return empty(`Too many rows (${body.length}); the limit is ${limits.maxRows} per import.`);

  const iSubject = col('subject');
  const iDiff = col('difficulty');
  const iEase = col('ease');
  const iInterval = col('interval');
  const iReps = col('repetitions');
  const iNext = col('nextreview');
  const wrongCols = header.map((h, i) => (/^wrong[1-5]$/.test(h) ? i : -1)).filter((i) => i >= 0);

  const cards: CsvCard[] = [];
  const errors: CsvRowIssue[] = [];
  body.forEach((cells, idx) => {
    const row = idx + 2;
    const get = (i: number) => (i >= 0 ? restoreFormula((cells[i] ?? '').trim()) : '');
    const question = get(iQ);
    const answer = get(iC);
    if (!question) return void errors.push({ row, message: 'missing question' });
    if (!answer || isPlaceholderAnswer(answer))
      return void errors.push({ row, message: 'missing answer' });
    if (question.length > BALANCE.flashcards.questionMaxLength)
      return void errors.push({
        row,
        message: `question is longer than ${BALANCE.flashcards.questionMaxLength} characters`,
      });
    if (answer.length > BALANCE.flashcards.answerMaxLength)
      return void errors.push({
        row,
        message: `answer is longer than ${BALANCE.flashcards.answerMaxLength} characters`,
      });

    let difficulty: Difficulty | null = null;
    const d = get(iDiff).toLowerCase();
    if (d) {
      if (!(DIFFICULTIES as readonly string[]).includes(d))
        return void errors.push({ row, message: 'difficulty must be easy, medium or hard' });
      difficulty = d as Difficulty;
    }
    const subject = get(iSubject);
    if (subject.length > 40)
      return void errors.push({ row, message: 'subject is longer than 40 characters' });

    let review: CsvCard['review'] = null;
    if (iEase >= 0 || iInterval >= 0 || iReps >= 0 || iNext >= 0) {
      const ease = num(get(iEase));
      const interval = num(get(iInterval));
      const reps = num(get(iReps));
      const next = get(iNext);
      const when = next ? new Date(next) : null;
      const present = [get(iEase), get(iInterval), get(iReps), next].some((v) => v !== '');
      if (present) {
        const ok =
          ease !== null &&
          ease >= BALANCE.srs.minEase &&
          ease <= 5 &&
          interval !== null &&
          Number.isInteger(interval) &&
          interval >= 0 &&
          interval <= BALANCE.srs.maxIntervalDays &&
          reps !== null &&
          Number.isInteger(reps) &&
          reps >= 0 &&
          reps <= 1000 &&
          when !== null &&
          !Number.isNaN(when.getTime());
        if (!ok)
          return void errors.push({
            row,
            message: 'review data (ease/interval/repetitions/nextReview) is invalid',
          });
        review = {
          ease: ease as number,
          intervalDays: interval as number,
          repetitions: reps as number,
          dueAt: when as Date,
        };
      }
    }

    cards.push({
      row,
      question,
      answer,
      distractors: cleanDistractors(
        answer,
        wrongCols.map((i) => get(i)),
      ),
      subject: subject || null,
      difficulty,
      review,
    });
  });
  return { cards, errors, totalRows: body.length };
}

/** Key used to dedupe cards inside one deck: normalized question text. */
export const cardDedupeKey = (question: string): string => normalizeText(question);
