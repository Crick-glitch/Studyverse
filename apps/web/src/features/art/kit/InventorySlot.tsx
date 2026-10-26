import type { ReactNode } from 'react';
import type { Rarity } from '../sprites/items';
import styles from './kit.module.css';

export interface InventorySlotProps {
  /** Accessible name, e.g. "Quillblade, rare weapon" or "Empty weapon slot". */
  label: string;
  rarity?: Rarity;
  selected?: boolean;
  empty?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}

/** An item slot. A button when it can be chosen, a plain group when it is only for display. */
export function InventorySlot({ label, rarity, selected, empty, onClick, children }: InventorySlotProps) {
  if (onClick) {
    return (
      <button type="button" className={styles.slot} data-rarity={rarity} data-empty={empty ? 'true' : undefined} aria-pressed={!!selected} aria-label={label} onClick={onClick}>
        {children}
      </button>
    );
  }
  return (
    <div className={styles.slot} role="group" aria-label={label} data-rarity={rarity} data-empty={empty ? 'true' : undefined}>
      {children}
    </div>
  );
}
