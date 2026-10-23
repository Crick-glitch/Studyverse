import { legacyPayloadSchema, type LegacyPayload } from '@studyverse/shared';

/** The old single-page app stored everything under this key (docs/AUDIT.md). */
export const LEGACY_KEY = 'studyverse-data';
export const BACKUP_PREFIX = 'studyverse-data-backup-';
const DONE_PREFIX = 'studyverse-import-done:';
const SKIP_PREFIX = 'studyverse-import-skip:';

/** Storage can throw (private mode, quota, disabled); every access is guarded. */
function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** The raw old save, or null when there is none (or storage is unavailable). */
export const readLegacyRaw = (): string | null => safe(() => localStorage.getItem(LEGACY_KEY), null);

export type ParseResult = { ok: true; payload: LegacyPayload } | { ok: false; error: string };

/** Parses and validates the old save in the browser; the server validates it again. */
export function parseLegacy(raw: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'The old save is not valid JSON, so it cannot be imported.' };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data))
    return { ok: false, error: 'The old save does not look like StudyVerse progress.' };
  const parsed = legacyPayloadSchema.safeParse(data);
  return parsed.success
    ? { ok: true, payload: parsed.data }
    : { ok: false, error: 'The old save has unexpected contents and was not imported.' };
}

/**
 * Writes the backup copy BEFORE any import. Returns the backup key, or null when the browser refused
 * (in which case the import must not go ahead).
 */
export function writeBackup(raw: string, now: Date = new Date()): string | null {
  const key = `${BACKUP_PREFIX}${now.toISOString().replace(/[:.]/g, '-')}`;
  return safe(() => {
    localStorage.setItem(key, raw);
    return localStorage.getItem(key) === raw ? key : null;
  }, null);
}

export const removeBackup = (key: string): void => safe(() => localStorage.removeItem(key), undefined);

/** Removes the old save and every backup this app made (only after the player confirms). */
export function removeLegacyData(): void {
  safe(() => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k === LEGACY_KEY || k.startsWith(BACKUP_PREFIX))) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  }, undefined);
}

export const isImportDone = (userId: string): boolean =>
  safe(() => localStorage.getItem(DONE_PREFIX + userId) === '1', false);
export const markImportDone = (userId: string): void =>
  safe(() => localStorage.setItem(DONE_PREFIX + userId, '1'), undefined);

/** "Not now" lasts for this browser session only; the offer comes back next visit. */
export const isSkipped = (userId: string): boolean =>
  safe(() => sessionStorage.getItem(SKIP_PREFIX + userId) === '1', false);
export const markSkipped = (userId: string): void =>
  safe(() => sessionStorage.setItem(SKIP_PREFIX + userId, '1'), undefined);
