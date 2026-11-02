import { BALANCE } from './balance.js';
import { shuffled, seededRng } from './random.js';

/** Lower-case, collapsed-whitespace form used to compare answers and dedupe questions. */
export const normalizeText = (s: string): string =>
  s.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Placeholder wrong answers the old app stored ("N/A", empty strings). They must never reach a quiz
 * (docs/AUDIT.md defect 2): "", "n/a", "na", "none", "null", "undefined", "-", "?", "...".
 */
export function isPlaceholderAnswer(s: string): boolean {
  const n = normalizeText(s);
  return n === '' || /^(n\/?a|n\.a\.?|none|null|undefined|nil|-+|\?+|\.{1,}|—+)$/.test(n);
}

/** Trimmed, de-duplicated wrong answers: no placeholders, nothing equal to the correct answer. */
export function cleanDistractors(correct: string, list: readonly string[]): string[] {
  const seen = new Set<string>([normalizeText(correct)]);
  const out: string[] = [];
  for (const raw of list) {
    const v = raw.normalize('NFC').trim();
    if (isPlaceholderAnswer(v)) continue;
    const key = normalizeText(v);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= BALANCE.flashcards.maxDistractors) break;
  }
  return out;
}

export interface CardChoiceInput {
  correct: string;
  /** The card's own wrong answers (already user-entered). Used first. */
  own: readonly string[];
  /**
   * Answers of other cards to borrow from when `own` is short, best tier first
   * (e.g. [same deck, same subject]). Within a tier the pick order is seeded-random.
   */
  borrowFrom?: readonly (readonly string[])[];
  seed: number;
}

/**
 * Builds the 3 choices (1 correct + 2 wrong) for multiple-choice use of a flashcard, or returns null
 * when there are not enough plausible wrong answers (the card then stays usable in Lab reveal-and-rate
 * review but is skipped for quizzes and battles; 03-core-modules section 4).
 */
export function buildCardChoices(input: CardChoiceInput): string[] | null {
  const wanted = BALANCE.flashcards.choiceCount - 1;
  const rng = seededRng(input.seed);
  const wrong: string[] = cleanDistractors(input.correct, input.own).slice(0, wanted);
  for (const tier of input.borrowFrom ?? []) {
    if (wrong.length >= wanted) break;
    const candidates = cleanDistractors(input.correct, [...wrong, ...tier]).filter(
      (c) => !wrong.some((w) => normalizeText(w) === normalizeText(c)),
    );
    for (const c of shuffled(candidates, rng)) {
      wrong.push(c);
      if (wrong.length >= wanted) break;
    }
  }
  if (wrong.length < wanted) return null;
  return shuffled([input.correct.trim(), ...wrong], rng);
}
