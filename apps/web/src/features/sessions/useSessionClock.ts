import type { SessionDto } from '@studyverse/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Seconds left, counted from the SERVER's remainingSec at the moment the response arrived.
 * The browser's own wall clock is never used (performance.now() only measures time since that response),
 * so changing the computer's date cannot change the timer, and a refetch re-syncs it.
 */
export function useCountdown(s: Pick<SessionDto, 'status' | 'remainingSec' | 'serverNow'>): number {
  const [, setTick] = useState(0);
  const anchor = useMemo(
    () => ({ at: performance.now(), remaining: s.remainingSec, running: s.status === 'running' }),
    // serverNow is not read inside the memo on purpose: it changes on every server response, which is
    // exactly when the timer anchor (performance.now()) must be reset, even if status/remainingSec repeat.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional reset trigger, see comment above
    [s.serverNow, s.status, s.remainingSec],
  );
  useEffect(() => {
    if (!anchor.running) return;
    const id = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [anchor]);
  const spent = anchor.running ? (performance.now() - anchor.at) / 1000 : 0;
  return Math.max(0, Math.ceil(anchor.remaining - spent));
}

const isAway = () => document.hidden || !document.hasFocus();
/** Less observed time than this and no focus ratio is reported at all. */
export const MIN_OBSERVED_MS = 10_000;

/**
 * Advisory focus tracking (03-core-modules section 3): measures how long this tab was hidden or
 * unfocused while the timer was running. The server clamps and only treats it as a hint.
 * Returns a function that gives the ratio (0..1) or undefined when too little was observed.
 */
export function useFocusTracker(running: boolean): () => number | undefined {
  const st = useRef({ active: false, since: 0, hiddenSince: 0, observedMs: 0, hiddenMs: 0 });

  useEffect(() => {
    if (!running) return;
    const s = st.current;
    const t0 = performance.now();
    s.active = true;
    s.since = t0;
    s.hiddenSince = isAway() ? t0 : 0;
    const onChange = () => {
      const t = performance.now();
      if (isAway()) {
        if (!s.hiddenSince) s.hiddenSince = t;
      } else if (s.hiddenSince) {
        s.hiddenMs += t - s.hiddenSince;
        s.hiddenSince = 0;
      }
    };
    document.addEventListener('visibilitychange', onChange);
    window.addEventListener('blur', onChange);
    window.addEventListener('focus', onChange);
    return () => {
      const t = performance.now();
      s.observedMs += t - s.since;
      if (s.hiddenSince) s.hiddenMs += t - s.hiddenSince;
      s.hiddenSince = 0;
      s.active = false;
      document.removeEventListener('visibilitychange', onChange);
      window.removeEventListener('blur', onChange);
      window.removeEventListener('focus', onChange);
    };
  }, [running]);

  return useCallback(() => {
    const s = st.current;
    const t = performance.now();
    const observed = s.observedMs + (s.active ? t - s.since : 0);
    const hidden = s.hiddenMs + (s.active && s.hiddenSince ? t - s.hiddenSince : 0);
    if (observed < MIN_OBSERVED_MS) return undefined;
    return Math.max(0, Math.min(1, 1 - hidden / observed));
  }, []);
}
