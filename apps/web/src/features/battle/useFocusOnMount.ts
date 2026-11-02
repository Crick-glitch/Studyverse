import { useEffect, useRef } from 'react';

/**
 * Focus an element when it appears WITHOUT scrolling the page (`autoFocus` scrolls it into view, which would push the
 * battlefield and HP bars off the top of a short screen at exactly the moment the player wants to read them).
 */
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return ref;
}
