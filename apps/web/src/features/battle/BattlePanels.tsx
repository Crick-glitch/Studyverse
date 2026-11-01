import type { AnswerResultDto, BattleDto, BattleQuestionDto, Move } from '@studyverse/shared';
import { BATTLE, MOVE_TEXT, MOVES } from '@studyverse/shared';
import { PixelButton } from '../art/kit/PixelButton';
import { useFocusOnMount } from './useFocusOnMount';
import styles from './battle.module.css';

const MOVE_KEY: Record<Move, string> = { steady: 'Q', brace: 'W', bold: 'E' };

/** The three tactical moves, chosen BEFORE the question is shown. A click sends the move; Q/W/E highlight and Enter confirms. */
export function MovePanel({ selected, busy, autoSteady, onChoose, onSelect }: { selected: Move; busy: boolean; autoSteady: boolean; onChoose: (m: Move) => void; onSelect: (m: Move) => void }) {
  if (autoSteady) {
    return <p className={styles.autoNote} role="status">{busy ? 'Choosing Steady…' : 'Auto-Steady is on: Steady is chosen for you each turn. Turn it off in the top bar to pick moves.'}</p>;
  }
  return (
    <div className={styles.moves} role="group" aria-label="Choose your move">
      {MOVES.map((m) => (
        <PixelButton
          key={m}
          className={styles.move}
          variant={m === 'bold' ? 'danger' : 'secondary'}
          aria-pressed={selected === m}
          disabled={busy}
          onClick={() => onChoose(m)}
          onFocus={() => onSelect(m)}
          onMouseEnter={() => onSelect(m)}
        >
          <span className={styles.moveName}>{MOVE_TEXT[m].label}<span className={styles.key} aria-hidden="true">{MOVE_KEY[m]}</span></span>
          <span className={styles.moveText}>{MOVE_TEXT[m].effect}</span>
        </PixelButton>
      ))}
    </div>
  );
}

/** The class ability (Cleave / Bulwark / Insight): Focus pips, why it is unavailable, and what it does. Never shows an answer. */
export function AbilityBar({ battle, busy, onUse }: { battle: BattleDto; busy: boolean; onUse: () => void }) {
  const ability = battle.abilities[0];
  if (!ability) return <span className={styles.abilityNote}>Pick a class in Camp to unlock a class ability.</span>;
  return (
    <div className={styles.abilities}>
      <PixelButton variant="secondary" disabled={busy || !ability.available} aria-pressed={ability.armed} onClick={onUse} title={ability.reason ?? ability.effect}>
        {ability.label} <span className={styles.key} aria-hidden="true">A</span>
      </PixelButton>
      <span className={styles.abilityNote}>
        {ability.armed ? `${ability.label} is armed. ` : ''}{ability.effect} Costs {ability.cost} Focus
        {!ability.available && ability.reason ? ` · ${ability.reason}` : ''}
      </span>
    </div>
  );
}

const comboText = (combo: number): string => (combo >= 2 ? `Combo ${combo} (×${BATTLE.combo[Math.min(combo, BATTLE.combo.length - 1)]})` : combo === 1 ? 'Combo 1' : 'No combo yet');

export function QuestionPanel({ question, removedIndex, picked, resolving, combo, move, onAnswer }: { question: BattleQuestionDto; removedIndex: number | null; picked: number | null; resolving: boolean; combo: number; move: Move | null; onAnswer: (i: number) => void }) {
  return (
    <div>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Answer to strike</h2>
        <span className={styles.panelNote}>{move ? `${MOVE_TEXT[move].label} · ` : ''}{comboText(combo)}</span>
      </div>
      <p className={styles.question} data-testid="question">{question.text}</p>
      <ol className={styles.choices}>
        {question.choices.map((c, i) => {
          const removed = removedIndex === i;
          return (
            <li key={i}>
              <PixelButton
                className={styles.choice}
                disabled={resolving || removed}
                data-state={removed ? 'removed' : picked === i ? 'picked' : undefined}
                onClick={() => onAnswer(i)}
              >
                <span className={styles.key} aria-hidden="true">{i + 1}</span>
                <span>{c}{removed ? <span className={styles.srOnly}> (removed by Insight)</span> : null}</span>
              </PixelButton>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function FeedbackPanel({ result, question, ended, onContinue }: { result: AnswerResultDto; question: BattleQuestionDto | null; ended: boolean; onContinue: () => void }) {
  const focus = useFocusOnMount<HTMLButtonElement>();
  const dealt = result.damageDealt > 0 ? `You deal ${result.damageDealt} damage.` : '';
  const taken = result.damageTaken > 0 ? `You take ${result.damageTaken} damage.` : result.correct ? '' : 'The hit was blocked.';
  return (
    <div>
      <div className={styles.verdictRow}>
        <p className={styles.verdict} data-ok={result.correct ? 'true' : 'false'} role="status">
          <span>{result.correct ? 'Correct!' : 'Not quite.'}</span>
          <span>{[dealt, taken].filter(Boolean).join(' ')}</span>
        </p>
        <PixelButton ref={focus} variant="primary" onClick={onContinue}>{ended ? 'See rewards' : 'Continue'} <span className={styles.key} aria-hidden="true">Enter</span></PixelButton>
      </div>
      {question ? (
        <ol className={styles.choices} aria-label="Answers">
          {question.choices.map((c, i) => (
            <li key={i}>
              <div className={`${styles.choice} ${styles.choiceStatic}`} data-state={i === result.correctIndex ? 'correct' : i === result.selectedIndex ? 'wrong' : undefined}>
                <span className={styles.key} aria-hidden="true">{i + 1}</span>
                <span>
                  {c}
                  {i === result.correctIndex ? <span className={styles.srOnly}> (correct answer)</span> : i === result.selectedIndex ? <span className={styles.srOnly}> (your answer)</span> : null}
                </span>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
      <p className={`${styles.explain} ${result.explanation ? '' : styles.explainEmpty}`} data-testid="explanation">
        {result.explanation ?? 'No explanation yet for this question.'}
      </p>
    </div>
  );
}

export function BattleLog({ log }: { log: string[] }) {
  return (
    <ol className={styles.log} aria-live="polite" aria-label="Battle log">
      {log.slice(-4).map((l, i) => <li key={`${i}-${l}`}>{l}</li>)}
    </ol>
  );
}
