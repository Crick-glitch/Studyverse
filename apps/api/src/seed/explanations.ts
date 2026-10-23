import type { PrismaClient } from '../lib/prisma.js';
import { analyzeQuestions } from './questionBank.js';

/** One row of the review file the owner fills in. `explanation` starts EMPTY: nothing is invented here. */
export interface ExplanationDraftEntry {
  legacyId: string;
  subject: string;
  difficulty: string;
  text: string;
  choices: string[];
  correctAnswer: string;
  needsReview: boolean;
  reviewFlags: string[];
  /** Write (or paste, e.g. from an AI assistant) one or two sentences, then set approved to true. */
  explanation: string;
  approved: boolean;
}

/** Builds the review file from the question bank. Pure: no database, no file writes. */
export function buildExplanationDraft(raw: readonly unknown[]): ExplanationDraftEntry[] {
  const out: ExplanationDraftEntry[] = [];
  for (const a of analyzeQuestions(raw)) {
    const q = a.question;
    if (!a.usable || !q) continue;
    out.push({
      legacyId: q.id,
      subject: q.subject,
      difficulty: q.difficulty,
      text: q.text,
      choices: q.choices,
      correctAnswer: q.choices[q.correctIndex] ?? '',
      needsReview: a.flags.length > 0,
      reviewFlags: a.flags,
      explanation: '',
      approved: false,
    });
  }
  return out;
}

export interface ApplyReport {
  applied: number;
  skippedNotApproved: number;
  skippedEmpty: number;
  unknownIds: string[];
}

/**
 * Stores explanations the owner approved. Only `explanation` is written (never text, choices or the
 * answer); entries that are not approved, are empty, or name an unknown question are skipped.
 */
export async function applyExplanations(
  prisma: PrismaClient,
  entries: readonly Pick<ExplanationDraftEntry, 'legacyId' | 'explanation' | 'approved'>[],
): Promise<ApplyReport> {
  const report: ApplyReport = { applied: 0, skippedNotApproved: 0, skippedEmpty: 0, unknownIds: [] };
  for (const e of entries) {
    if (e.approved !== true) {
      report.skippedNotApproved += 1;
      continue;
    }
    const explanation = (e.explanation ?? '').trim();
    if (!explanation) {
      report.skippedEmpty += 1;
      continue;
    }
    const res = await prisma.question.updateMany({
      where: { legacyId: e.legacyId },
      data: { explanation: explanation.slice(0, 1000) },
    });
    if (res.count === 0) report.unknownIds.push(e.legacyId);
    else report.applied += res.count;
  }
  return report;
}
