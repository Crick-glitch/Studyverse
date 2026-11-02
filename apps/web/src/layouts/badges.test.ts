import type { SummaryDto } from '@studyverse/shared';
import { describe, expect, it } from 'vitest';
import { BADGE_CAP, capped, slotBadge } from './badges';

const summary = (over: Partial<SummaryDto> = {}): SummaryDto => ({
  dueCards: 0,
  claimableQuests: 0,
  activeSession: null,
  energy: 0,
  unspentSkillPoints: 0,
  serverNow: '2026-10-26T10:00:00.000Z',
  ...over,
});
const RUNNING = { id: 's', status: 'running' as const, startedAt: '', pausedAt: null, plannedSeconds: 600, pausedTotalSec: 0, remainingSec: 300 };

describe('slotBadge', () => {
  it('shows nothing while the summary is missing (loading or failed)', () => {
    for (const id of ['home', 'quests', 'study', 'library', 'adventure'] as const) expect(slotBadge(id, undefined)).toBeNull();
  });

  it('shows nothing for zero', () => {
    for (const id of ['home', 'quests', 'study', 'library', 'adventure'] as const) expect(slotBadge(id, summary())).toBeNull();
  });

  it('counts claimable quests and due cards, with an exact text equivalent', () => {
    expect(slotBadge('quests', summary({ claimableQuests: 1 }))).toEqual({ kind: 'count', text: '1', sr: '1 quest ready to claim' });
    expect(slotBadge('quests', summary({ claimableQuests: 3 }))).toEqual({ kind: 'count', text: '3', sr: '3 quests ready to claim' });
    expect(slotBadge('library', summary({ dueCards: 1 }))).toEqual({ kind: 'count', text: '1', sr: '1 card due' });
    expect(slotBadge('library', summary({ dueCards: 12 }))).toEqual({ kind: 'count', text: '9+', sr: '12 cards due' });
  });

  it('caps what is drawn at 9+ but never what is read out', () => {
    expect(capped(BADGE_CAP)).toBe('9');
    expect(capped(BADGE_CAP + 1)).toBe('9+');
    expect(slotBadge('library', summary({ dueCards: 480 }))?.sr).toBe('480 cards due');
  });

  it('marks Study with Resume only while a session is active', () => {
    expect(slotBadge('study', summary({ activeSession: RUNNING }))).toEqual({ kind: 'resume', text: 'Resume', sr: 'session in progress, resume' });
    expect(slotBadge('study', summary({ activeSession: { ...RUNNING, status: 'paused' } }))?.kind).toBe('resume');
  });

  it('shows the Adventure pip from 3 energy (the raid cost) and not below', () => {
    expect(slotBadge('adventure', summary({ energy: 2 }))).toBeNull();
    expect(slotBadge('adventure', summary({ energy: 3 }))).toMatchObject({ kind: 'pip', text: null });
    expect(slotBadge('adventure', summary({ energy: 3 }))?.sr).toBe('3 energy, enough for a raid');
  });

  it('never gives Home a badge', () => {
    expect(slotBadge('home', summary({ dueCards: 5, claimableQuests: 5, energy: 9 }))).toBeNull();
  });
});
