/**
 * GET /api/v1/summary: the counts behind the hotbar badges and the HUD session chip (05c-game-navigation.md).
 * Counts only: no card text, no task titles, no quest names, nothing another player could use.
 */

/** A running or paused study session, with the server's own clock so the HUD never trusts the browser's. */
export interface ActiveSessionSummaryDto {
  id: string;
  status: 'running' | 'paused';
  startedAt: string;
  /** Set while paused (the countdown is frozen at that moment). */
  pausedAt: string | null;
  plannedSeconds: number;
  pausedTotalSec: number;
  /** Seconds left, computed by the server at `SummaryDto.serverNow` from the timestamps above. */
  remainingSec: number;
}

export interface SummaryDto {
  /** Flashcards whose review is due now (all decks). */
  dueCards: number;
  /** Quests for the current day/week that are complete and not yet claimed. */
  claimableQuests: number;
  activeSession: ActiveSessionSummaryDto | null;
  /** Study energy; the Adventure badge appears at `BALANCE.raid.energyCost` or more. */
  energy: number;
  /** Unspent skill points (the "!" on the HUD portrait). */
  unspentSkillPoints: number;
  serverNow: string;
}
