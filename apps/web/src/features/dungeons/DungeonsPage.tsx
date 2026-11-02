import { useMutation, useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BATTLE_SUBJECTS, type BattleCreate, type DungeonStatusDto, type DungeonsDto } from '@studyverse/shared';
import { api, ApiError } from '../../lib/api';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { ErrorState, Skeleton } from '../../ui/StateViews';
import { PageHeader } from '../../ui/PageHeader';
import { BattleBackground } from '../art/components/BattleBackground';
import { Sprite } from '../art/components/Sprite';
import { PixelButton } from '../art/kit/PixelButton';
import { PixelPanel } from '../art/kit/PixelPanel';
import kit from '../art/kit/kit.module.css';
import styles from './dungeons.module.css';

export const DUNGEONS_KEY = ['dungeons'] as const;

/** Where each region sits on the 320x180 map art (centre of its building), as percentages of the map. */
const NODE_AT: Record<number, { x: number; y: number }> = { 1: { x: 131, y: 78 }, 2: { x: 207, y: 112 }, 3: { x: 276, y: 46 } };
const MAP_W = 320;
const MAP_H = 180;

type NodeState = 'locked' | 'available' | 'cleared';
export const nodeState = (d: DungeonStatusDto): NodeState => (!d.open ? 'locked' : d.bossDefeated ? 'cleared' : 'available');
const STATE_TEXT: Record<NodeState, string> = { locked: 'Locked', available: 'Open', cleared: 'Cleared' };

const message = (e: unknown): string => (e instanceof ApiError || e instanceof Error ? e.message : 'Something went wrong. Please try again.');

/** One fight the player can start from a region. */
interface Launch {
  mode: 'raid' | 'practice';
  boss: boolean;
}

function RegionBody({ d, data, subject, busy, onStart }: { d: DungeonStatusDto; data: DungeonsDto; subject: string; busy: boolean; onStart: (l: Launch) => void }) {
  const resume = data.activeBattleId !== null;
  const enough = data.energy >= data.energyCost;
  const raidWhy = !d.open ? d.lockedReason : resume ? 'Finish or retreat your current battle first.' : !enough ? `Needs ${data.energyCost} energy (you have ${data.energy}). Study sessions earn energy.` : null;
  const practiceWhy = !d.open ? d.lockedReason : resume ? 'Finish or retreat your current battle first.' : null;
  const bossWhy = !d.open ? d.lockedReason : !d.bossOpen ? d.bossLockedReason : resume ? 'Finish or retreat your current battle first.' : !enough ? `Needs ${data.energyCost} energy (you have ${data.energy}).` : null;
  return (
    <div className={styles.body}>
      {!d.open ? <p className={styles.why} data-testid={`locked-${d.tier}`}>{d.lockedReason}</p> : null}
      <div className={styles.actions}>
        <PixelButton variant="primary" disabled={busy || raidWhy !== null} onClick={() => onStart({ mode: 'raid', boss: false })}>
          Start raid ({data.energyCost} energy)
        </PixelButton>
        <PixelButton disabled={busy || practiceWhy !== null} onClick={() => onStart({ mode: 'practice', boss: false })}>
          Practice (free)
        </PixelButton>
      </div>
      {raidWhy && d.open ? <p className={styles.why}>{raidWhy}</p> : null}
      <p className={styles.fine}>Raid: full XP, loot and progress toward the boss. Practice: 25% XP up to a daily cap, no loot, and it never counts toward a boss.</p>

      <div className={styles.boss} data-state={d.bossDefeated ? 'cleared' : d.bossOpen ? 'ready' : 'locked'}>
        <Sprite id={`monster.${d.bossSlug}`} state="idle" scale={1} decorative />
        <div className={styles.bossText}>
          <h3 className={styles.bossName}>{d.bossName}</h3>
          <p className={styles.fine} data-testid={`boss-status-${d.tier}`}>
            {d.bossDefeated ? 'Defeated. You can fight it again for loot (the first-clear bonus is paid once).' : !d.open ? 'Open this region first.' : d.bossOpen ? 'The gate is open.' : d.bossLockedReason}
          </p>
          <p className={styles.fine}>Raid wins here: {Math.min(d.raidWins, d.raidWinsNeeded)} of {d.raidWinsNeeded}</p>
          <PixelButton variant="danger" disabled={busy || bossWhy !== null} onClick={() => onStart({ mode: 'raid', boss: true })}>
            Boss raid ({data.energyCost} energy)
          </PixelButton>
          {bossWhy && d.bossOpen ? <p className={styles.why}>{bossWhy}</p> : null}
        </div>
      </div>
      <Prep data={data} subject={subject} />
    </div>
  );
}

/** Advisory only: what is due in the chosen subject. It never blocks entering (06). Readiness comes with mastery (session 07). */
function Prep({ data, subject }: { data: DungeonsDto; subject: string }) {
  const due = subject === 'Any' ? Object.values(data.dueBySubject).reduce((a, b) => a + b, 0) : (data.dueBySubject[subject] ?? 0);
  const label = subject === 'Any' ? 'any subject' : subject;
  return (
    <aside className={styles.prep} aria-label="Boss prep">
      <h3 className={styles.prepTitle}>Prepare</h3>
      <p data-testid="prep-due">
        {due > 0 ? `${due} ${due === 1 ? 'card is' : 'cards are'} due in ${label}.` : `No cards are due in ${label}.`}{' '}
        {due > 0 ? <Link to="/lab">Review these cards first</Link> : <Link to="/lab">Add or review cards in the Library</Link>}
      </p>
      <p className={styles.fine}>Advice only: you can enter any open dungeon without preparing.</p>
    </aside>
  );
}

export function DungeonsPage() {
  const navigate = useNavigate();
  const wide = useMediaQuery('(min-width: 700px)');
  const q = useQuery({ queryKey: DUNGEONS_KEY, queryFn: api.battles.dungeons });
  const [subject, setSubject] = useState<string>('Any');
  const [picked, setPicked] = useState<number | null>(null);
  const [error, setError] = useState<{ text: string; battleId: string | null } | null>(null);
  // One Idempotency-Key per distinct fight, kept until it succeeds: a double click (or a retry after a dropped connection) starts ONE battle.
  const keys = useRef(new Map<string, string>());

  const start = useMutation({
    mutationFn: (v: { body: BattleCreate; key: string }) => api.battles.start(v.body, v.key),
    onSuccess: (r) => {
      keys.current.clear();
      navigate(`/battle/${r.battle.id}`);
    },
    onError: (e) => {
      const id = e instanceof ApiError && e.code === 'BATTLE_IN_PROGRESS' ? ((e.details as { battleId?: string } | undefined)?.battleId ?? null) : null;
      setError({ text: message(e), battleId: id });
    },
  });

  if (q.isLoading) return <Skeleton lines={6} label="Loading the region map" />;
  if (q.isError || !q.data) return <ErrorState message={message(q.error)} onRetry={() => void q.refetch()} />;
  const data = q.data;
  const open = data.dungeons.filter((d) => d.open);
  const selected = data.dungeons.find((d) => d.tier === picked) ?? open[open.length - 1] ?? data.dungeons[0]!;

  const launch = (d: DungeonStatusDto, l: Launch) => {
    setError(null);
    const body: BattleCreate = { mode: l.mode, subject: subject as BattleCreate['subject'], tier: d.tier, ...(l.boss ? { boss: true } : {}) };
    const id = `${body.mode}|${body.subject}|${body.tier}|${l.boss}`;
    if (!keys.current.has(id)) keys.current.set(id, crypto.randomUUID());
    start.mutate({ body, key: keys.current.get(id)! });
  };

  return (
    <PixelPanel tone="parchment" className={styles.page} aria-labelledby="page-title">
      <PageHeader id="page-title" icon="dungeons">Adventure</PageHeader>

      {data.activeBattleId ? (
        <p className={styles.resume} role="status">
          You have an unfinished battle. <Link to={`/battle/${data.activeBattleId}`}>Resume it</Link>
        </p>
      ) : null}

      <div className={styles.controls}>
        <label className={styles.field}>
          <span>Subject</span>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} className={styles.select}>
            {BATTLE_SUBJECTS.map((s) => <option key={s} value={s}>{s === 'Any' ? 'Any subject (mixed)' : s}</option>)}
          </select>
        </label>
        <p className={styles.energy} data-testid="energy">
          Energy: <strong>{data.energy}</strong> · a raid costs {data.energyCost}. Study sessions and victories earn energy.
        </p>
        <p className={styles.fine}>Your level: {data.level}. You choose the subject; the world never forces one.</p>
      </div>

      {wide ? (
        <section className={styles.mapWrap} aria-label="Region map">
          <div className={styles.map} style={{ width: MAP_W * 2, height: MAP_H * 2 }}>
            <BattleBackground id="scene.map" scale={2} label="" />
            {data.dungeons.map((d) => {
              const at = NODE_AT[d.tier]!;
              const st = nodeState(d);
              return (
                <button
                  key={d.tier}
                  type="button"
                  className={styles.node}
                  data-state={st}
                  aria-pressed={selected.tier === d.tier}
                  style={{ left: `${(at.x / MAP_W) * 100}%`, top: `${(at.y / MAP_H) * 100}%` }}
                  onClick={() => setPicked(d.tier)}
                >
                  <span className={styles.nodeName}>{d.name}</span>
                  <span className={styles.nodeState}>{STATE_TEXT[st]}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className={styles.list}>
        {data.dungeons.map((d) => {
          const st = nodeState(d);
          const isSel = selected.tier === d.tier;
          return (
            <section key={d.tier} className={styles.region} data-state={st} data-selected={isSel ? 'true' : undefined} aria-label={d.name}>
              <h2 className={styles.regionTitle}>
                <button type="button" className={styles.regionButton} aria-expanded={isSel} onClick={() => setPicked(d.tier)}>
                  <span>Tier {d.tier} · {d.name}</span>
                  <span className={styles.badge} data-state={st}>{STATE_TEXT[st]}</span>
                </button>
              </h2>
              {isSel ? <RegionBody d={d} data={data} subject={subject} busy={start.isPending} onStart={(l) => launch(d, l)} /> : !d.open ? <p className={styles.why}>{d.lockedReason}</p> : null}
            </section>
          );
        })}
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error.text} {error.battleId ? <Link to={`/battle/${error.battleId}`}>Resume that battle</Link> : null}
        </p>
      ) : null}
      <div className={styles.footer}><Link to="/" className={kit.button}>Back to Camp</Link></div>
    </PixelPanel>
  );
}
