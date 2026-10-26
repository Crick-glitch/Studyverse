import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';
const read = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches;

/** True when the visitor asked the system for less motion. Pixel art then shows static poses. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(read);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(QUERY);
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}
