import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { DIFFICULTIES, SUBJECTS, normalizeText, type Difficulty } from '@studyverse/shared';
import type { PrismaClient } from '../lib/prisma.js';

/** One entry of the old data/questions.js, exactly as written there. */
export interface LegacyQuestion {
  id: string;
  subject: string;
  difficulty: string;
  text: string;
  choices: string[];
  correctIndex: number;
}

/**
 * Where the old question bank lives. The file is never edited (03-core-modules section 1); it stays in
 * the repo (in `legacy/` once Phase 8 moves it). QUESTION_BANK_PATH overrides the search.
 */
export function findQuestionBankFile(env: NodeJS.ProcessEnv = process.env): string {
  const repoRoot = join(import.meta.dirname, '../../../..');
  const candidates = [
    env['QUESTION_BANK_PATH'],
    join(repoRoot, 'legacy/Studyverse/data/questions.js'),
    join(repoRoot, 'legacy/data/questions.js'),
    join(repoRoot, 'Studyverse/data/questions.js'),
  ].filter((p): p is string => Boolean(p));
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error(`Question bank not found. Looked in:\n  ${candidates.join('\n  ')}`);
  return found;
}

/**
 * The old file assigns `window.QUESTION_BANK = [...]`. Run it in an isolated vm context with a fake
 * `window` (no require, no process, 2 s limit) and copy the result out through JSON, so nothing from the
 * sandbox realm leaks into the seed.
 */
export function parseQuestionBank(source: string): unknown[] {
  const sandbox: { window: Record<string, unknown> } = { window: {} };
  vm.runInNewContext(source, sandbox, { timeout: 2000 });
  const bank: unknown = sandbox.window['QUESTION_BANK'];
  if (!Array.isArray(bank))
    throw new Error('questions.js did not define window.QUESTION_BANK as an array');
  return JSON.parse(JSON.stringify(bank)) as unknown[];
}

export const loadQuestionBank = (path = findQuestionBankFile()): unknown[] =>
  parseQuestionBank(readFileSync(path, 'utf8'));

/**
 * Entries a human should look at, found by reading the bank (hist-h-007 has choices that do not answer the
 * question; the others are contested, ambiguous or near-duplicates). They are FLAGGED, never edited:
 * the question stays in the game with a "report this question" action (docs/DECISIONS.md).
 */
export const MANUAL_REVIEW: Record<string, string> = {
  'hist-h-007': 'malformed: the choices do not answer the question',
  'hist-h-004': 'contested: the largest extent was reached under later khans',
  'hist-m-005': 'contested: the date the Cold War ended is a convention',
  'sci-e-007': 'contested: quarks are smaller than atoms',
  'sci-e-008': 'ambiguous: "type of energy" (fusion, nuclear, radiant)',
  'math-m-003': 'ambiguous: depends on the value of pi used; a distractor is nearly equal',
  'lang-m-008': 'contested: metaphor vs extended metaphor vs allusion',
  'lang-h-005': 'contested terminology (idiolect vs voice)',
  'other-h-005': 'vague: the answer options are not mutually exclusive',
  'sci-m-009': 'near-duplicate of bio-e-003',
  'bio-e-003': 'near-duplicate of sci-m-009',
  'sci-m-005': 'near-duplicate of bio-h-006',
  'bio-h-006': 'near-duplicate of sci-m-005',
  'sci-e-002': 'near-duplicate of other-e-007',
  'other-e-007': 'near-duplicate of sci-e-002',
  'lang-h-003': 'near-duplicate of lang-h-006',
  'lang-h-006': 'near-duplicate of lang-h-003',
};

export interface Analysis {
  /** Can be stored at all (id, subject, difficulty, text, choices, correctIndex are usable). */
  usable: boolean;
  question?: LegacyQuestion;
  /** Why it needs review (empty = clean). */
  flags: string[];
  /** Why it could not be stored. */
  problem?: string;
}

/** Automated checks (duplicate choices, bad correctIndex, ...) plus the manual list. Never edits anything. */
export function analyzeQuestions(raw: readonly unknown[]): Analysis[] {
  const seenText = new Map<string, string>();
  return raw.map((r, i): Analysis => {
    const q = r as Partial<LegacyQuestion> | null;
    if (!q || typeof q !== 'object')
      return { usable: false, flags: [], problem: `entry ${i} is not an object` };
    const label = typeof q.id === 'string' ? q.id : `entry ${i}`;
    if (typeof q.id !== 'string' || !q.id)
      return { usable: false, flags: [], problem: `${label}: missing id` };
    if (typeof q.text !== 'string' || !q.text.trim())
      return { usable: false, flags: [], problem: `${label}: missing text` };
    if (!(SUBJECTS as readonly string[]).includes(q.subject ?? ''))
      return {
        usable: false,
        flags: [],
        problem: `${label}: unknown subject ${String(q.subject)}`,
      };
    if (!(DIFFICULTIES as readonly string[]).includes(q.difficulty ?? ''))
      return {
        usable: false,
        flags: [],
        problem: `${label}: unknown difficulty ${String(q.difficulty)}`,
      };
    if (!Array.isArray(q.choices) || q.choices.some((c) => typeof c !== 'string'))
      return { usable: false, flags: [], problem: `${label}: choices are not a list of strings` };
    if (typeof q.correctIndex !== 'number' || !Number.isInteger(q.correctIndex))
      return { usable: false, flags: [], problem: `${label}: correctIndex is not a whole number` };

    const flags: string[] = [];
    if (q.choices.length !== 3) flags.push(`has ${q.choices.length} choices (expected 3)`);
    if (q.correctIndex < 0 || q.correctIndex >= q.choices.length)
      flags.push('correctIndex is out of range');
    if (new Set(q.choices.map(normalizeText)).size !== q.choices.length)
      flags.push('duplicate choices');
    if (q.choices.some((c) => !c.trim())) flags.push('empty choice');
    const key = normalizeText(q.text);
    const twin = seenText.get(key);
    if (twin) flags.push(`same text as ${twin}`);
    else seenText.set(key, q.id);
    const manual = MANUAL_REVIEW[q.id];
    if (manual) flags.push(manual);
    return { usable: true, question: q as LegacyQuestion, flags };
  });
}

export interface QuestionSeedReport {
  sourceCount: number;
  stored: number;
  flagged: number;
  skipped: { id: string; reason: string }[];
  flaggedList: { id: string; reasons: string[] }[];
}

/** Upserts by legacyId: repeatable, never duplicates, keeps any explanation the owner added. */
export async function seedQuestionBank(
  prisma: PrismaClient,
  raw: readonly unknown[] = loadQuestionBank(),
): Promise<QuestionSeedReport> {
  const analysis = analyzeQuestions(raw);
  const report: QuestionSeedReport = {
    sourceCount: raw.length,
    stored: 0,
    flagged: 0,
    skipped: [],
    flaggedList: [],
  };
  for (const a of analysis) {
    if (!a.usable || !a.question) {
      report.skipped.push({ id: a.problem?.split(':')[0] ?? '?', reason: a.problem ?? 'unusable' });
      continue;
    }
    const q = a.question;
    const needsReview = a.flags.length > 0;
    const data = {
      subject: q.subject,
      difficulty: q.difficulty as Difficulty,
      text: q.text,
      choices: q.choices,
      correctIndex: q.correctIndex,
      needsReview,
      source: 'builtin',
    };
    await prisma.question.upsert({
      where: { legacyId: q.id },
      update: data,
      create: { legacyId: q.id, ...data },
    });
    report.stored += 1;
    if (needsReview) {
      report.flagged += 1;
      report.flaggedList.push({ id: q.id, reasons: a.flags });
    }
  }
  return report;
}
