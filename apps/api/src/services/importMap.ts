import { createHash } from 'node:crypto';
import {
  BALANCE,
  bankSubject,
  cleanDistractors,
  legacyFlashcardSchema,
  legacySessionSchema,
  legacyTaskSchema,
  normalizeText,
  SUBJECTS,
  type Difficulty,
} from '@studyverse/shared';

/** Pure mapping/cleaning helpers for the local-data import (no database). */

/** Stable JSON (sorted keys) so the same payload always hashes the same. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
export const payloadHash = (payload: unknown): string =>
  createHash('sha256').update(canonicalJson(payload)).digest('hex');

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
export const cleanLine = (v: string, max: number): string =>
  v.normalize('NFC').replace(CONTROL, '').replace(/\s+/g, ' ').trim().slice(0, max);
export const cleanText = (v: string, max: number): string =>
  v.normalize('NFC').replace(/\r\n?/g, '\n').replace(CONTROL, '').trim().slice(0, max);

/** The old app wrote dates with Date.toDateString() ("Thu Oct 22 2026") or ISO strings. */
export function parseLegacyDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  const t = d.getTime();
  return Number.isNaN(t) || t < Date.UTC(2015, 0, 1) || t > Date.now() + 86_400_000 ? null : d;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export interface MappedTask {
  title: string;
  difficulty: Difficulty;
  completed: boolean;
  createdAt: Date | null;
}
export function mapTask(raw: unknown): MappedTask | { error: string } {
  const p = legacyTaskSchema.safeParse(raw);
  if (!p.success) return { error: 'not a task' };
  const title = cleanLine(p.data.title, BALANCE.tasks.titleMaxLength);
  if (!title) return { error: 'empty title' };
  return {
    title,
    difficulty: p.data.difficulty,
    completed: p.data.completed,
    createdAt: parseLegacyDate(p.data.createdDate),
  };
}

export interface MappedSession {
  title: string;
  subject: string;
  difficulty: Difficulty;
  plannedMinutes: number;
  validated: boolean;
  xp: number;
  energy: number;
  focusRatio: number;
  finishedAt: Date | null;
}
export function mapSession(raw: unknown): MappedSession | { error: string } {
  const p = legacySessionSchema.safeParse(raw);
  if (!p.success) return { error: 'not a session' };
  const minutes = Math.round(p.data.duration);
  if (!(minutes >= 1 && minutes <= 600)) return { error: 'invalid duration' };
  const subject = cleanLine(p.data.subject ?? '', 40);
  return {
    title: cleanLine(p.data.title ?? '', BALANCE.sessions.titleMaxLength) || 'Imported session',
    subject: subject || 'Other',
    difficulty: p.data.difficulty,
    plannedMinutes: minutes,
    validated: p.data.validated,
    xp: clamp(Math.floor(p.data.xpEarned), 0, 100_000),
    energy: clamp(Math.floor(p.data.energyEarned), 0, 1000),
    focusRatio: clamp(p.data.focusRatio, 0, 1),
    finishedAt: parseLegacyDate(p.data.completedDate ?? undefined),
  };
}

export interface MappedCard {
  question: string;
  answer: string;
  distractors: string[];
  subject: string;
  ease: number;
  intervalDays: number;
  repetitions: number;
  dueAt: Date | null;
}
/** Placeholder wrong answers ("N/A", empty) are dropped; a card with an empty question/answer is skipped. */
export function mapCard(raw: unknown): MappedCard | { error: string } {
  const p = legacyFlashcardSchema.safeParse(raw);
  if (!p.success) return { error: 'not a flashcard' };
  const question = cleanText(p.data.question, BALANCE.flashcards.questionMaxLength);
  const answer = cleanText(p.data.correct, BALANCE.flashcards.answerMaxLength);
  if (!question) return { error: 'missing question' };
  if (!answer) return { error: 'missing answer' };
  const subject = cleanLine(p.data.subject ?? '', 40);
  const due = parseLegacyDate(p.data.nextReview);
  return {
    question,
    answer,
    distractors: cleanDistractors(
      answer,
      p.data.answers.map((a) => cleanText(a, BALANCE.flashcards.answerMaxLength)),
    ),
    subject: subject || 'Other',
    ease: clamp(p.data.ease, BALANCE.srs.minEase, 5),
    intervalDays: clamp(Math.round(p.data.interval), 0, BALANCE.srs.maxIntervalDays),
    repetitions: clamp(Math.round(p.data.repetitions), 0, 1000),
    dueAt: due,
  };
}

/** Old skill ids use underscores (power_strike); new slugs use hyphens. */
export const legacySkillSlug = (id: string): string => id.trim().toLowerCase().replace(/_/g, '-');

export const normalizedName = (v: string): string => normalizeText(v.replace(/[\u2018\u2019]/g, "'"));

export const isBankSubject = (s: string): boolean =>
  (SUBJECTS as readonly string[]).includes(bankSubject(s));
