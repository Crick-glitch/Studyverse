import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useLocation } from 'react-router-dom';
import styles from './TravelWipe.module.css';

/**
 * The travel transition (05c section 8): a thin gold bar steps across the screen whenever the route changes. It sits on
 * top and ignores the pointer, so it never delays or hides content, and it is not drawn at all under reduced motion.
 * The step is a whole number of pixels, and eight steps carry the bar (and its edges) completely past the right edge;
 * the CSS does not hold the last frame, so nothing is left on screen afterwards.
 */
export function wipeStep(viewportWidth: number): number {
  // The bar starts 4 pixels left of the screen and its dark edge reaches 2 more: 6 pixels of at most 8 px each.
  return Math.max(8, Math.ceil((viewportWidth + 6 * 8) / 8));
}

export function TravelWipe() {
  const { pathname } = useLocation();
  // Compare with the path we last saw instead of a "first run" flag: React StrictMode runs effects twice in
  // development, which would have turned a "first" flag off and wiped on the page you start on.
  const seen = useRef(pathname);
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (seen.current === pathname) return;
    seen.current = pathname;
    setRun((n) => n + 1);
  }, [pathname]);
  if (run === 0) return null;
  const step = wipeStep(window.innerWidth);
  return <div key={run} aria-hidden="true" className={styles.wipe} data-testid="travel-wipe" style={{ '--step': `${step}px` } as CSSProperties} />;
}
