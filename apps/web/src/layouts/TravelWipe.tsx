import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useLocation } from 'react-router-dom';
import styles from './TravelWipe.module.css';

/**
 * The travel transition (05c section 8): a thin gold bar steps across the screen whenever the route changes. It sits on
 * top and ignores the pointer, so it never delays or hides content, and it is not drawn at all under reduced motion.
 * The step is a whole number of pixels (a rounded eighth of the width), so the bar never lands between pixels.
 */
export function TravelWipe() {
  const { pathname } = useLocation();
  const first = useRef(true);
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (first.current) {
      first.current = false; // no wipe for the page you start on
      return;
    }
    setRun((n) => n + 1);
  }, [pathname]);
  if (run === 0) return null;
  const step = Math.max(8, Math.round(window.innerWidth / 8));
  return <div key={run} aria-hidden="true" className={styles.wipe} data-testid="travel-wipe" style={{ '--step': `${step}px` } as CSSProperties} />;
}
