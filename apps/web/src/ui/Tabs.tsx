import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import styles from './Tabs.module.css';

export interface TabDef {
  id: string;
  label: string;
  panel: ReactNode;
}

/** WAI-ARIA tabs: arrow keys / Home / End move between tabs; only the selected panel is rendered. */
export function Tabs({ tabs, label }: { tabs: TabDef[]; label: string }) {
  const base = useId();
  const [selected, setSelected] = useState(tabs[0]?.id ?? '');
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const move = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1;
    const next =
      e.key === 'ArrowRight'
        ? (index + 1) % tabs.length
        : e.key === 'ArrowLeft'
          ? (index - 1 + tabs.length) % tabs.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : -1;
    const target = tabs[next];
    if (!target) return;
    e.preventDefault();
    setSelected(target.id);
    refs.current[target.id]?.focus();
  };

  const current = tabs.find((t) => t.id === selected) ?? tabs[0];
  return (
    <div>
      <div role="tablist" aria-label={label} className={styles.list}>
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            role="tab"
            type="button"
            id={`${base}-tab-${t.id}`}
            aria-selected={t.id === current?.id}
            aria-controls={`${base}-panel-${t.id}`}
            tabIndex={t.id === current?.id ? 0 : -1}
            className={`${styles.tab} ${t.id === current?.id ? styles.selected : ''}`}
            onClick={() => setSelected(t.id)}
            onKeyDown={(e) => move(e, i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {current && (
        <div
          role="tabpanel"
          id={`${base}-panel-${current.id}`}
          aria-labelledby={`${base}-tab-${current.id}`}
        >
          {current.panel}
        </div>
      )}
    </div>
  );
}
