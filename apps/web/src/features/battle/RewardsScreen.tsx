import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EFFECT_TEXT, type BattleSummaryDto } from '@studyverse/shared';
import { ItemIcon } from '../art/components/ItemIcon';
import { useReducedMotion } from '../art/components/useReducedMotion';
import { PixelButton } from '../art/kit/PixelButton';
import { PixelPanel } from '../art/kit/PixelPanel';
import kit from '../art/kit/kit.module.css';
import { plural } from '../../lib/format';
import styles from './battle.module.css';

/** Counts a number up to `target` in whole steps (instantly when motion is reduced). */
export function useCountUp(target: number, ms = 700): number {
  const reduced = useReducedMotion();
  const [n, setN] = useState(reduced ? target : 0);
  useEffect(() => {
    if (reduced || target <= 0) {
      setN(target);
      return;
    }
    const steps = Math.min(target, 20);
    let i = 0;
    const timer = window.setInterval(() => {
      i += 1;
      setN(Math.round((target * i) / steps));
      if (i >= steps) window.clearInterval(timer);
    }, ms / steps);
    return () => window.clearInterval(timer);
  }, [target, reduced, ms]);
  return n;
}

const HEADLINE = { victory: 'Victory!', defeat: 'Defeat', retreated: 'You retreated' } as const;

function lead(s: BattleSummaryDto): string {
  if (s.outcome === 'victory') return `You defeated ${s.enemy.name}.`;
  if (s.outcome === 'defeat') return `${s.enemy.name} won this time. You still keep what you earned.`;
  return 'You left the fight. Nothing was lost except the energy you spent.';
}

export interface RewardsScreenProps {
  summary: BattleSummaryDto;
  /** Adds the missed questions as flashcards; resolves to the message to show. */
  onAddMissed: () => void;
  addedMessage: string | null;
  adding: boolean;
}

/** What the battle paid, what you missed and where to go next. All numbers come from the server's summary. */
export function RewardsScreen({ summary: s, onAddMissed, addedMessage, adding }: RewardsScreenProps) {
  const xp = useCountUp(s.xp.awarded);
  const pct = s.asked > 0 ? Math.round((s.correct / s.asked) * 100) : 0;
  const practice = s.mode === 'practice';
  const newCards = s.missed.filter((m) => !m.isCard);
  return (
    <PixelPanel tone="parchment" className={styles.rewards} aria-label="Battle rewards">
      <div className={styles.rewardsHead}>
        <h1 className={styles.outcome} data-outcome={s.outcome}>{HEADLINE[s.outcome]}</h1>
        <p className={styles.lead}>{lead(s)}{practice ? ' This was practice: smaller rewards, no loot.' : ''}</p>
      </div>

      <ul className={styles.tiles} aria-label="Rewards">
        <li className={styles.tile}>
          <span className={styles.tileLabel}>XP gained</span>
          <span className={styles.tileValue} aria-label={`${s.xp.awarded} XP`}>+{xp}</span>
          {s.xp.capped ? <span className={styles.tileNote}>Daily practice cap reached ({s.xp.dailyCap} XP). The battle still counted for your cards.</span> : null}
          {s.xp.requested !== s.xp.awarded && !s.xp.capped ? <span className={styles.tileNote}>{s.xp.requested} before limits</span> : null}
        </li>
        {s.levelsGained > 0 ? (
          <li className={styles.tile}>
            <span className={styles.tileLabel}>Level up</span>
            <span className={styles.tileValue}>Level {s.progress.level}</span>
            <span className={styles.tileNote}>+1 skill point per level</span>
          </li>
        ) : null}
        {!practice ? (
          <li className={styles.tile}>
            <span className={styles.tileLabel}>Energy</span>
            <span className={styles.tileValue}>{s.energy > 0 ? `+${s.energy}` : '0'}</span>
            <span className={styles.tileNote}>{s.energy > 0 ? `Now ${s.progress.studyEnergy}` : 'Victories return energy'}</span>
          </li>
        ) : null}
        <li className={styles.tile}>
          <span className={styles.tileLabel}>Accuracy</span>
          <span className={styles.tileValue}>{pct}%</span>
          <span className={styles.tileNote}>{s.correct} of {s.asked} correct</span>
        </li>
      </ul>

      {s.firstClear ? (
        <p className={styles.lead} data-testid="first-clear">
          {s.firstClear.awarded
            ? `First clear! You defeated this boss for the first time: +${s.firstClear.xp} bonus XP.`
            : 'You have cleared this boss before, so there is no first-clear bonus.'}
        </p>
      ) : null}

      {s.loot ? (
        <div className={styles.lootCard} data-testid="loot">
          <ItemIcon id={`${s.loot.slot}.${s.loot.slug}`} rarity={s.loot.rarity} scale={2} />
          <div>
            <div className={styles.lootName}>{s.loot.name} <span className={styles.rarity} data-rarity={s.loot.rarity}>({s.loot.rarity})</span></div>
            <div>{s.loot.slot === 'weapon' ? `+${s.loot.atk} ATK` : `+${s.loot.def} DEF`}{s.loot.effect ? ` · ${EFFECT_TEXT[s.loot.effect] ?? ''}` : ''}</div>
            <div className={styles.tileNote}>
              {s.loot.duplicate
                ? `You already own this, so it turned into +${s.loot.duplicateXp} bonus XP.`
                : s.loot.equipped
                  ? 'Equipped automatically (that slot was empty).'
                  : 'Added to your inventory. Equip it in Camp.'}
            </div>
          </div>
        </div>
      ) : null}

      {s.missed.length > 0 ? (
        <section aria-label="Questions you missed">
          <h2 className={styles.sectionTitle}>Questions to learn from</h2>
          <ul className={styles.missedList}>
            {s.missed.map((m) => (
              <li key={m.turnNumber} className={styles.missed}>
                <p className={styles.missedQ}>{m.text}</p>
                <p className={styles.missedA}><strong>Answer:</strong> {m.choices[m.correctIndex]}</p>
                {m.explanation ? <p className={styles.missedA}>{m.explanation}</p> : null}
              </li>
            ))}
          </ul>
          {s.weakSpot ? (
            <p className={styles.lead}>
              Weak spot: <strong>{s.weakSpot.subject}</strong> ({s.weakSpot.missed} missed). <Link to="/lab">Review those cards in the Library.</Link>
            </p>
          ) : null}
          <div className={styles.actions}>
            {newCards.length > 0 && !addedMessage ? (
              <PixelButton variant="secondary" disabled={adding} onClick={onAddMissed}>Add missed questions to my flashcards</PixelButton>
            ) : null}
          </div>
          {addedMessage ? <p className={styles.note} role="status">{addedMessage}</p> : newCards.length === 0 ? <p className={styles.note}>These are already your own flashcards.</p> : null}
        </section>
      ) : s.asked > 0 ? (
        <p className={styles.note}>No missed questions. {plural(s.correct, 'answer')} right.</p>
      ) : null}

      <div className={styles.actions}>
        <Link to="/dungeons" className={kit.button} data-variant="primary">{s.outcome === 'defeat' ? 'Prepare and retry' : practice ? 'Practice again' : 'Return to dungeon'}</Link>
        <Link to="/" className={kit.button}>Back to Camp</Link>
      </div>
    </PixelPanel>
  );
}
