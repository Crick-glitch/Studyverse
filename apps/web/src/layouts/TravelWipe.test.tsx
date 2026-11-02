/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { StrictMode } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { TravelWipe, wipeStep } from './TravelWipe';
import { WEB_SRC } from '../features/art/test-paths';

let go: (to: string) => void = () => undefined;
function Go() {
  const navigate = useNavigate();
  go = navigate;
  return null;
}
const wipeCss = readFileSync(join(WEB_SRC, 'layouts', 'TravelWipe.module.css'), 'utf8');
const renderWipe = () =>
  render(
    <MemoryRouter initialEntries={['/a']}>
      <Go />
      <TravelWipe />
    </MemoryRouter>,
  );
afterEach(cleanup);

describe('TravelWipe', () => {
  it('does not run for the page you start on', () => {
    renderWipe();
    expect(screen.queryByTestId('travel-wipe')).toBeNull();
  });

  it('runs on a route change, is hidden from assistive tech, and moves in whole pixels', () => {
    renderWipe();
    act(() => go('/b'));
    const wipe = screen.getByTestId('travel-wipe');
    expect(wipe.getAttribute('aria-hidden')).toBe('true');
    expect(Number.isInteger(parseFloat(wipe.style.getPropertyValue('--step')))).toBe(true);
  });

  it('starts again on the next change', () => {
    renderWipe();
    act(() => go('/b'));
    const first = screen.getByTestId('travel-wipe');
    act(() => go('/c'));
    expect(screen.getByTestId('travel-wipe')).not.toBe(first); // re-keyed, so the animation restarts
  });

  it('does not run for the first page even under React StrictMode (effects run twice in dev)', () => {
    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/a']}>
          <Go />
          <TravelWipe />
        </MemoryRouter>
      </StrictMode>,
    );
    expect(screen.queryByTestId('travel-wipe')).toBeNull();
  });

  it('wipeStep is a whole number of pixels and carries the bar completely past the right edge', () => {
    for (const width of [320, 390, 768, 1280, 1920]) {
      const step = wipeStep(width);
      expect(Number.isInteger(step)).toBe(true);
      // the bar starts 4 pixels left of the screen and its dark edge reaches 2 more: 6 pixels of at most 8 px each
      expect(8 * step).toBeGreaterThanOrEqual(width + 6 * 8);
    }
  });

  it('does not hold its last frame: a bar parked at the right edge looked like a permanent gold strip', () => {
    // jsdom runs no CSS animations, so this guards the source; the browser check lives in scripts/route-shots.mjs.
    expect(wipeCss).not.toMatch(/animation:[^;]*\b(both|forwards)\b/);
    expect(wipeCss).not.toMatch(/animation-fill-mode\s*:\s*(both|forwards)/);
  });
});
