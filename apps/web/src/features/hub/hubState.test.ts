import type { SummaryDto } from '@studyverse/shared';
import { describe, expect, it } from 'vitest';
import { HUB_PROPS } from '../art/sprites/hub-props';
import { hubProps, MIN_TARGET, targetRect } from './hubState';

const SCENE = { w: 320, h: 180 };
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
const byId = (views: ReturnType<typeof hubProps>) => Object.fromEntries(views.map((v) => [v.id, v]));

describe('hubProps', () => {
  it('has the six doors and the (non-link) campfire', () => {
    const views = hubProps({ summary: summary(), streak: 0 });
    expect(views.map((v) => v.id).sort()).toEqual(['campfire', 'gate', 'hero-tent', 'journal-desk', 'library-wagon', 'quest-board', 'study-tent']);
    expect(views.filter((v) => v.to === null).map((v) => v.id)).toEqual(['campfire']);
    expect(Object.fromEntries(views.filter((v) => v.to).map((v) => [v.id, v.to]))).toEqual({
      gate: '/dungeons',
      'study-tent': '/sessions',
      'hero-tent': '/camp',
      'quest-board': '/quests',
      'journal-desk': '/stats',
      'library-wagon': '/lab',
    });
  });

  it('stands quiet when there is nothing to show (or no summary at all)', () => {
    for (const s of [summary(), undefined]) {
      const v = byId(hubProps({ summary: s, streak: 0 }));
      expect([v.gate?.state, v['study-tent']?.state, v['hero-tent']?.state, v['quest-board']?.state, v['library-wagon']?.state]).toEqual(['open', 'idle', 'idle', 'idle', 'idle']);
      expect(v['library-wagon']?.name).toBe('Library wagon, Library');
    }
  });

  it('reflects real state in the sprite state and in the accessible name', () => {
    const v = byId(hubProps({ summary: summary({ dueCards: 12, claimableQuests: 2, energy: 3, unspentSkillPoints: 1, activeSession: RUNNING }), streak: 0 }));
    expect(v['library-wagon']).toMatchObject({ state: 'due', name: 'Library wagon, Library, 12 cards due' });
    expect(v['quest-board']).toMatchObject({ state: 'flags', name: 'Quest board, Quests, 2 quests ready to claim' });
    expect(v['study-tent']).toMatchObject({ state: 'active', name: 'Study tent, Study, session in progress, resume' });
    expect(v['hero-tent']).toMatchObject({ state: 'attention', name: 'Hero tent, Hero, 1 unspent skill point' });
    expect(v.gate).toMatchObject({ state: 'ready', name: 'Dungeon gate, Adventure, 3 energy, enough for a raid' });
  });

  it('the gate is ready from the raid energy cost, not below it', () => {
    expect(byId(hubProps({ summary: summary({ energy: 2 }), streak: 0 })).gate?.state).toBe('open');
    expect(byId(hubProps({ summary: summary({ energy: 3 }), streak: 0 })).gate?.state).toBe('ready');
  });

  it('the campfire flame level is the streak flame level (0 to 4)', () => {
    const level = (streak: number) => byId(hubProps({ summary: summary(), streak })).campfire?.state;
    expect(level(0)).toBe('l0');
    expect(['l0', 'l1', 'l2', 'l3', 'l4']).toContain(level(5));
    expect(level(400)).toBe('l4');
    for (const s of [0, 1, 3, 7, 14, 30, 100]) expect(HUB_PROPS.campfire.states).toContain(level(s));
  });

  it('every state it can produce exists on the sprite', () => {
    const all = [
      hubProps({ summary: summary(), streak: 0 }),
      hubProps({ summary: summary({ dueCards: 1, claimableQuests: 1, energy: 9, unspentSkillPoints: 1, activeSession: RUNNING }), streak: 99 }),
    ].flat();
    for (const v of all) expect(HUB_PROPS[v.id].states, `${v.id}:${v.state}`).toContain(v.state);
  });
});

describe('targetRect', () => {
  it('grows small art to at least 44 px each way and keeps it inside the scene', () => {
    for (const scale of [1, 2]) {
      for (const meta of Object.values(HUB_PROPS)) {
        if (!meta.hit) continue;
        const r = targetRect(meta.hit, scale, SCENE);
        expect(r.width).toBeGreaterThanOrEqual(MIN_TARGET);
        expect(r.height).toBeGreaterThanOrEqual(MIN_TARGET);
        expect(r.left).toBeGreaterThanOrEqual(0);
        expect(r.top).toBeGreaterThanOrEqual(0);
        expect(r.left + r.width).toBeLessThanOrEqual(SCENE.w * scale);
        expect(r.top + r.height).toBeLessThanOrEqual(SCENE.h * scale);
      }
    }
  });

  it('leaves big art at its own size and uses whole pixels', () => {
    expect(targetRect({ x: 2, y: 86, w: 56, h: 54 }, 2, SCENE)).toEqual({ left: 4, top: 172, width: 112, height: 108 });
    const r = targetRect({ x: 152, y: 118, w: 34, h: 24 }, 1, SCENE);
    for (const n of Object.values(r)) expect(Number.isInteger(n)).toBe(true);
  });
});

describe('prop boxes', () => {
  it('keep every hit area inside its sprite box and every box inside the scene', () => {
    for (const [id, m] of Object.entries(HUB_PROPS)) {
      expect(m.box.x >= 0 && m.box.y >= 0 && m.box.x + m.box.w <= SCENE.w && m.box.y + m.box.h <= SCENE.h, `${id} box in scene`).toBe(true);
      if (m.hit) expect(m.hit.x >= m.box.x && m.hit.y >= m.box.y && m.hit.x + m.hit.w <= m.box.x + m.box.w && m.hit.y + m.hit.h <= m.box.y + m.box.h, `${id} hit in box`).toBe(true);
    }
  });
});
