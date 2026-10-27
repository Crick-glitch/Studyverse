import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { TravelWipe } from './TravelWipe';

let go: (to: string) => void = () => undefined;
function Go() {
  const navigate = useNavigate();
  go = navigate;
  return null;
}
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
});
