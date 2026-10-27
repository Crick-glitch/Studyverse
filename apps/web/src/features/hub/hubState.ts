import { BALANCE, ROUTES, type SummaryDto } from '@studyverse/shared';
import { flameLevelForStreak } from '../art/kit';
import type { HubPropId } from '../art/sprites/hub-props';
import { slotBadge } from '../../layouts/badges';
import { plural } from '../../lib/format';

export interface HubPropView {
  id: HubPropId;
  /** The sprite state, taken from real data. */
  state: string;
  /** Where it goes; `null` for the campfire, which is not a link. */
  to: string | null;
  /** Accessible name: "Library wagon, Library, 12 cards due". */
  name: string;
}

const withBadge = (base: string, sr: string | undefined) => (sr ? `${base}, ${sr}` : base);

/**
 * What each prop of the Home scene shows and where it leads (05c section 7). Every state comes from GET /summary or
 * GET /me; without them the props simply stand in their quiet state. The same destinations are always on the hotbar.
 */
export function hubProps(input: { summary: SummaryDto | undefined; streak: number }): HubPropView[] {
  const { summary: s, streak } = input;
  const sr = (id: 'quests' | 'study' | 'library' | 'adventure') => slotBadge(id, s)?.sr;
  const skillPoints = s?.unspentSkillPoints ?? 0;
  return [
    {
      id: 'gate',
      // `locked` is drawn but unused until the unlock rules arrive with the battle screens (session 06).
      state: s && s.energy >= BALANCE.raid.energyCost ? 'ready' : 'open',
      to: ROUTES.dungeons,
      name: withBadge('Dungeon gate, Adventure', sr('adventure')),
    },
    {
      id: 'study-tent',
      state: s?.activeSession ? 'active' : 'idle',
      to: ROUTES.sessions,
      name: withBadge('Study tent, Study', sr('study')),
    },
    {
      id: 'hero-tent',
      state: skillPoints > 0 ? 'attention' : 'idle',
      to: ROUTES.camp,
      name: withBadge('Hero tent, Hero', skillPoints > 0 ? plural(skillPoints, 'unspent skill point') : undefined),
    },
    {
      id: 'quest-board',
      state: s && s.claimableQuests > 0 ? 'flags' : 'idle',
      to: ROUTES.quests,
      name: withBadge('Quest board, Quests', sr('quests')),
    },
    { id: 'journal-desk', state: 'idle', to: ROUTES.stats, name: 'Journal desk, Progress' },
    { id: 'campfire', state: `l${flameLevelForStreak(streak)}`, to: null, name: `Campfire, ${plural(streak, 'day')} streak` },
    {
      id: 'library-wagon',
      state: s && s.dueCards > 0 ? 'due' : 'idle',
      to: ROUTES.lab,
      name: withBadge('Library wagon, Library', sr('library')),
    },
  ];
}

export const MIN_TARGET = 44;
export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}
/** A hit area in screen pixels: the art's hit box at `scale`, grown to at least 44 px each way, kept inside the scene. */
export function targetRect(hit: { x: number; y: number; w: number; h: number }, scale: number, scene: { w: number; h: number }): Rect {
  const grow = (pos: number, len: number, max: number) => {
    const size = Math.max(len, MIN_TARGET);
    const start = Math.min(Math.max(0, pos - Math.floor((size - len) / 2)), Math.max(0, max - size));
    return [start, size] as const;
  };
  const [left, width] = grow(hit.x * scale, hit.w * scale, scene.w * scale);
  const [top, height] = grow(hit.y * scale, hit.h * scale, scene.h * scale);
  return { left, top, width, height };
}
