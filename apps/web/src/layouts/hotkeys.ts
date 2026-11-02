import { useCallback, useEffect, useState } from 'react';
import { HERO_HOTKEY, HERO_ROUTE, HOTBAR, MENU_HOTKEY } from './nav';

export const HOTKEYS_STORAGE_KEY = 'studyverse.hotkeys';

export type HotkeyAction = { kind: 'go'; to: string } | { kind: 'menu' };

/** The parts of a keyboard event the decision needs (so tests can pass plain objects). */
export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  repeat?: boolean;
  isComposing?: boolean;
  defaultPrevented?: boolean;
  target: EventTarget | null;
}

const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'image', 'file', 'color', 'range']);

/** True while the player is typing: a text-like input, textarea, select or contenteditable element has focus. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const editable = target.closest('[contenteditable]');
  if (editable && editable.getAttribute('contenteditable') !== 'false') return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') return !NON_TEXT_INPUTS.has((target as HTMLInputElement).type);
  const role = target.getAttribute('role');
  return role === 'textbox' || role === 'searchbox' || role === 'combobox';
}

/**
 * Which action, if any, a key press means (05c section 2, WCAG 2.1.4): 1-5 go to the hotbar slots, M opens the
 * Menu, H opens the Hero screen. Ignored while typing and whenever Ctrl, Alt or Meta is held (browser and
 * screen-reader shortcuts). Whether shortcuts are switched on is the caller's decision (see `useHotkeysSetting`).
 */
export function actionForKey(e: KeyLike): HotkeyAction | null {
  if (e.defaultPrevented || e.repeat || e.isComposing) return null;
  if (e.ctrlKey || e.altKey || e.metaKey) return null;
  if (isTypingTarget(e.target)) return null;
  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  const slot = HOTBAR.find((s) => s.hotkey === key);
  if (slot) return { kind: 'go', to: slot.to };
  if (key === MENU_HOTKEY) return { kind: 'menu' };
  if (key === HERO_HOTKEY) return { kind: 'go', to: HERO_ROUTE };
  return null;
}

function readEnabled(): boolean {
  try {
    return window.localStorage.getItem(HOTKEYS_STORAGE_KEY) !== '0';
  } catch {
    return true; // storage blocked: the default (on) applies
  }
}

/** The shortcut switch (on by default). Remembered in localStorage inside try/catch; session 07 mirrors it in Settings. */
export function useHotkeysSetting(): { enabled: boolean; setEnabled: (on: boolean) => void } {
  const [enabled, set] = useState<boolean>(readEnabled);
  const setEnabled = useCallback((on: boolean) => {
    set(on);
    try {
      window.localStorage.setItem(HOTKEYS_STORAGE_KEY, on ? '1' : '0');
    } catch {
      /* not remembered; nothing else depends on it */
    }
  }, []);
  return { enabled, setEnabled };
}

/**
 * Listens for the shortcuts while `active`. It stays quiet while a modal dialog is open (the dialog owns the
 * keyboard) and while the Menu is open (pass `active=false`).
 */
export function useHotkeys(active: boolean, onAction: (a: HotkeyAction) => void): void {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('[aria-modal="true"]')) return;
      const action = actionForKey(e);
      if (!action) return;
      e.preventDefault();
      onAction(action);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, onAction]);
}
