import { useEffect, useState } from 'react';

const supported = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function';

/** Live result of a CSS media query. Where `matchMedia` does not exist (jsdom) the answer is always `false`. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => supported() && window.matchMedia(query).matches);
  useEffect(() => {
    if (!supported()) return;
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
