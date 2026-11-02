import type { ReactNode } from 'react';
import styles from './kit.module.css';

export type SkillNodeState = 'locked' | 'available' | 'unlocked';

export interface SkillNodeProps {
  state: SkillNodeState;
  label: string;
  cost: number;
  /** Effect text shown to assistive tech and as a tooltip. */
  description?: string;
  icon?: ReactNode;
  onClick?: () => void;
}

const STATE_TEXT: Record<SkillNodeState, string> = { locked: 'locked', available: 'available to unlock', unlocked: 'unlocked' };

/**
 * One node of the skill graph. Locked and unlocked nodes stay focusable (so the effect can be read) but do
 * nothing when pressed: only an `available` node calls `onClick`.
 */
export function SkillNode({ state, label, cost, description, icon, onClick }: SkillNodeProps) {
  return (
    <button
      type="button"
      className={styles.node}
      data-state={state}
      aria-disabled={state !== 'available'}
      aria-label={`${label}, ${STATE_TEXT[state]}, costs ${cost} skill ${cost === 1 ? 'point' : 'points'}${description ? `. ${description}` : ''}`}
      title={description}
      onClick={state === 'available' ? onClick : undefined}
    >
      {icon}
      <span className={styles.nodeName}>{label}</span>
      <span className={styles.cost} aria-hidden="true">{state === 'unlocked' ? 'OK' : cost}</span>
    </button>
  );
}
