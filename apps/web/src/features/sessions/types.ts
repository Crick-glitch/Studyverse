import type {
  ClaimQuestionDto,
  ClaimResultDto,
  IneligibleReason,
  SessionDto,
} from '@studyverse/shared';

/** What the page shows after a session ends (kept in page state so a refetch cannot wipe it). */
export type Outcome =
  | { kind: 'ineligible'; session: SessionDto; reason: IneligibleReason | null }
  | { kind: 'claimed'; result: ClaimResultDto; quiz: ClaimQuestionDto[] };

export const INELIGIBLE_TEXT: Record<IneligibleReason, string> = {
  not_enough_time:
    'You finished before 80% of the planned time, so this session paid no reward. Try a shorter session next time.',
  not_enough_focus:
    'You were away from this tab for more than half of the session, so it paid no reward.',
};
