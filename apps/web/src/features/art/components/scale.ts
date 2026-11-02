const warned = new Set<string>();

/**
 * Pixel art is only ever drawn at whole-number scales (hard rule 10). A fractional or tiny scale is
 * rounded, and a warning names the offender in development so the call site gets fixed.
 */
export function integerScale(scale: number, label = 'art'): number {
  const rounded = Math.max(1, Math.round(Number.isFinite(scale) ? scale : 1));
  if (rounded !== scale && import.meta.env?.DEV) {
    const key = `${label}:${scale}`;
    if (!warned.has(key)) {
      warned.add(key);
      console.warn(`[art] ${label}: scale ${scale} is not a whole number; using ${rounded}.`);
    }
  }
  return rounded;
}

/** `monster.gearwork-golem` -> `gearwork golem`: a readable accessible name from a manifest key. */
export const labelFor = (id: string): string => (id.split('.').pop() ?? id).replace(/-/g, ' ');
