import { z } from 'zod';
import { BALANCE } from '../balance.js';
import { RATINGS } from '../srs.js';
import {
  cleanLineSchema,
  cleanTextSchema,
  difficultySchema,
  subjectTextSchema,
  uuidSchema,
  type Difficulty,
} from '../subjects.js';

const F = BALANCE.flashcards;

export const deckCreateSchema = z
  .object({
    name: cleanLineSchema(1, 80, 'Deck name'),
    subject: subjectTextSchema.default('Other'),
  })
  .strict();
export const deckPatchSchema = z
  .object({
    name: cleanLineSchema(1, 80, 'Deck name').optional(),
    subject: subjectTextSchema.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update' });

const answerText = cleanTextSchema(1, F.answerMaxLength, 'Answer');
const distractorList = z
  .array(cleanTextSchema(0, F.answerMaxLength, 'Wrong answer'))
  .max(F.maxDistractors);

export const cardInputSchema = z
  .object({
    question: cleanTextSchema(1, F.questionMaxLength, 'Question'),
    answer: answerText,
    subject: subjectTextSchema.optional(),
    difficulty: difficultySchema.default('medium'),
    distractors: distractorList.default([]),
  })
  .strict();
export type CardInput = z.infer<typeof cardInputSchema>;

/** One card or a batch of up to 50 (each row is its own INSERT; nothing is ever replaced). */
export const cardsCreateSchema = z
  .object({ cards: z.array(cardInputSchema).min(1).max(F.batchMax) })
  .strict();
export type CardsCreate = z.infer<typeof cardsCreateSchema>;

export const cardPatchSchema = z
  .object({
    question: cleanTextSchema(1, F.questionMaxLength, 'Question').optional(),
    answer: answerText.optional(),
    subject: subjectTextSchema.optional(),
    difficulty: difficultySchema.optional(),
    distractors: distractorList.optional(),
    /** Move the card to another deck the player owns. */
    deckId: uuidSchema.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update' });
export type CardPatch = z.infer<typeof cardPatchSchema>;

export const dueQuerySchema = z.object({
  deckId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(F.reviewQueueMax).default(20),
});

/**
 * Review submit. `dueAtSeen` is the card's dueAt the client was shown: the server applies the review only
 * if the card is still at that schedule, so a double-click or a retry never schedules it twice.
 */
export const reviewSubmitSchema = z.discriminatedUnion('mode', [
  z
    .object({
      mode: z.literal('choice'),
      chosenAnswer: z.string().max(F.answerMaxLength),
      dueAtSeen: z.string().datetime(),
    })
    .strict(),
  z
    .object({
      mode: z.literal('rate'),
      rating: z.enum(RATINGS as [string, ...string[]]),
      dueAtSeen: z.string().datetime(),
    })
    .strict(),
]);
export type ReviewSubmit = z.infer<typeof reviewSubmitSchema>;

export const csvBodySchema = z
  .object({ csv: z.string().min(1).max(BALANCE.csv.maxBytes) })
  .strict();
export const csvExportQuerySchema = z.object({
  includeReview: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export interface DeckDto {
  id: string;
  name: string;
  subject: string;
  cardCount: number;
  dueCount: number;
  createdAt: string;
}
export interface CardDto {
  id: string;
  deckId: string;
  question: string;
  answer: string;
  distractors: string[];
  subject: string;
  difficulty: Difficulty;
  ease: number;
  intervalDays: number;
  repetitions: number;
  dueAt: string;
}
/** A card in the review queue. In `choice` mode the answer is NOT included; in `reveal` mode it is the player's own text. */
export interface ReviewItemDto {
  id: string;
  deckId: string;
  question: string;
  subject: string;
  dueAt: string;
  mode: 'choice' | 'reveal';
  choices?: string[];
  answer?: string;
}
export interface ReviewResultDto {
  card: CardDto;
  correct: boolean | null;
  /** The right answer, revealed after a multiple-choice answer. */
  correctAnswer: string | null;
  intervalDays: number;
  /** false when this exact review had already been applied (nothing changed). */
  applied: boolean;
}
export interface CsvPreviewDto {
  totalRows: number;
  valid: number;
  duplicates: number;
  errors: { row: number; message: string }[];
  fatal: string | null;
  sample: { row: number; question: string; answer: string; distractors: string[] }[];
}
export interface CsvImportResultDto extends CsvPreviewDto {
  imported: number;
}
