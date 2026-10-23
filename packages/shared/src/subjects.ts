import { z } from 'zod';

/** Subjects of the built-in question bank (also the Study Session / task subject picker). */
export const SUBJECTS = ['Math', 'Science', 'History', 'Language', 'Biology', 'Other'] as const;
export const subjectSchema = z.enum(SUBJECTS);
export type Subject = z.infer<typeof subjectSchema>;

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export const difficultySchema = z.enum(DIFFICULTIES);
export type Difficulty = z.infer<typeof difficultySchema>;

/**
 * Free-text subject for tasks, decks and cards (e.g. "Chemistry" from a CSV). Trimmed, 1-40 chars.
 * Question-bank lookups map unknown subjects to "Other" with `bankSubject`.
 */
export const subjectTextSchema = z
  .string()
  .transform((v) => v.normalize('NFC').trim().replace(/\s+/g, ' '))
  .pipe(z.string().min(1, 'Subject is required').max(40, 'Subject is too long'));

/** The question-bank subject for any subject text (case-insensitive match, otherwise "Other"). */
export function bankSubject(subject: string): Subject {
  const found = SUBJECTS.find((s) => s.toLowerCase() === subject.trim().toLowerCase());
  return found ?? 'Other';
}

/** Single-line text with no control characters (titles, names). React escapes output; this keeps data tidy. */
export const cleanLineSchema = (min: number, max: number, label: string) =>
  z
    .string()
    .transform((v) => v.normalize('NFC').trim().replace(/\s+/g, ' '))
    .pipe(
      z
        .string()
        .min(min, `${label} is required`)
        .max(max, `${label} is too long (max ${max})`)
        // eslint-disable-next-line no-control-regex
        .refine((v) => !/[\u0000-\u001f\u007f]/.test(v), `${label} contains invalid characters`),
    );

/** Multi-line text (flashcard questions): trims, keeps newlines, blocks other control characters. */
export const cleanTextSchema = (min: number, max: number, label: string) =>
  z
    .string()
    .transform((v) => v.normalize('NFC').replace(/\r\n?/g, '\n').trim())
    .pipe(
      z
        .string()
        .min(min, `${label} is required`)
        .max(max, `${label} is too long (max ${max})`)
        // eslint-disable-next-line no-control-regex
        .refine(
          (v) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v),
          `${label} contains invalid characters`,
        ),
    );

export const uuidSchema = z.string().uuid();
export const idParamSchema = z.object({ id: uuidSchema });
