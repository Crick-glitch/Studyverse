import { BALANCE, type SummaryDto } from '@studyverse/shared';
import { plural } from '../lib/format';
import type { HotbarId } from './nav';

/** `count`: a number; `resume`: the "Resume" pill with a ring on the icon; `pip`: a gold pip; `dot`: a plain dot. */
export type BadgeKind = 'count' | 'resume' | 'pip' | 'dot';
export interface Badge {
  kind: BadgeKind;
  /** What is drawn (never read out: `sr` is). */
  text: string | null;
  /** The visually hidden equivalent, appended to the slot's name: "Library, 12 cards due". */
  sr: string;
}

/** Counts above this show as "9+" (the exact number is still read out). */
export const BADGE_CAP = 9;
export const capped = (n: number): string => (n > BADGE_CAP ? `${BADGE_CAP}+` : String(n));

/**
 * Calm badges (05c section 6): numbers and dots only, none for zero, never red, nothing about streaks at risk.
 * Everything comes from GET /summary; without it (loading or failed) there are no badges.
 */
export function slotBadge(id: HotbarId, s: SummaryDto | undefined): Badge | null {
  if (!s) return null;
  switch (id) {
    case 'quests':
      return s.claimableQuests > 0
        ? { kind: 'count', text: capped(s.claimableQuests), sr: `${plural(s.claimableQuests, 'quest')} ready to claim` }
        : null;
    case 'study':
      return s.activeSession ? { kind: 'resume', text: 'Resume', sr: 'session in progress, resume' } : null;
    case 'library':
      return s.dueCards > 0
        ? { kind: 'count', text: capped(s.dueCards), sr: `${plural(s.dueCards, 'card')} due` }
        : null;
    case 'adventure':
      return s.energy >= BALANCE.raid.energyCost ? { kind: 'pip', text: null, sr: `${s.energy} energy, enough for a raid` } : null;
    default:
      return null;
  }
}
