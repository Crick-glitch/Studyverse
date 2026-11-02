import { useCallback, useState } from 'react';

/**
 * Two small per-device preferences the battle screen needs before the Settings screen exists (session 07 mirrors them
 * there): sound on/off, and "Auto-Steady" (skip tactics: the client sends Steady every turn). Stored in localStorage
 * inside try/catch, default off for Auto-Steady and on for sound.
 */
export const SOUND_KEY = 'studyverse.sound';
export const AUTO_STEADY_KEY = 'studyverse.skipTactics';

const read = (key: string, fallback: boolean): boolean => {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : v === 'on';
  } catch {
    return fallback;
  }
};
const write = (key: string, on: boolean): void => {
  try {
    window.localStorage.setItem(key, on ? 'on' : 'off');
  } catch {
    /* private mode or blocked storage: the choice just lasts for this visit */
  }
};

export function useStoredToggle(key: string, fallback: boolean): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState<boolean>(() => read(key, fallback));
  const set = useCallback((v: boolean) => {
    setOn(v);
    write(key, v);
  }, [key]);
  return [on, set];
}
