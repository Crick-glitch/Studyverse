/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WEB_SRC } from './test-paths';

/**
 * Hard rule 5: game art is pixel art from the manifest, never emoji or symbol glyphs. This scans every
 * source and stylesheet under src/ (test files excluded). The legacy emoji avatar presets are mapped with
 * \u escapes in avatars.ts, so no emoji character appears in the file text. Plain arrows and bullets are fine.
 */
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{231A}\u{231B}\u{23E9}-\u{23FF}\u{25A0}-\u{25FF}]|\u{FE0F}|\u{200D}|\u{20E3}/u;

const SRC = WEB_SRC + '/';
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.(ts|tsx|css)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
  });
const files = walk(SRC);

describe('no emoji in game code', () => {
  it('detects emoji and ignores plain arrows (self-check)', () => {
    expect(EMOJI.test('x \u{1F525} y')).toBe(true);
    expect(EMOJI.test('\u2713')).toBe(true);
    expect(EMOJI.test('Next \u2192')).toBe(false);
    expect(EMOJI.test('plain ascii')).toBe(false);
  });

  it('scanned a realistic number of files', () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it('finds no emoji or symbol glyphs in any source file', () => {
    const offenders: string[] = [];
    for (const path of files) {
      readFileSync(path, 'utf8').split('\n').forEach((line, i) => {
        if (EMOJI.test(line)) offenders.push(`${path.slice(SRC.length)}:${i + 1}  ${line.trim().slice(0, 60)}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
