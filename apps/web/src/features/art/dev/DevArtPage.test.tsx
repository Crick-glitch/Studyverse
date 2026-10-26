import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MANIFEST } from '../manifest';
import DevArtPage from './DevArtPage';

afterEach(cleanup);

describe('/dev/art review page', () => {
  it('shows every manifest asset and only the two deliberate fallbacks are missing', () => {
    const { container } = render(<DevArtPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Art review' })).toBeTruthy();
    expect(screen.getByText(new RegExp(`${Object.keys(MANIFEST).length} manifest assets`))).toBeTruthy();
    const shown = new Set([...container.querySelectorAll('[data-asset]')].map((n) => n.getAttribute('data-asset')));
    const missingKeys = Object.keys(MANIFEST).filter((k) => !shown.has(k));
    expect(missingKeys).toEqual([]);
    expect([...container.querySelectorAll('[data-missing]')].map((n) => n.getAttribute('data-missing')).sort()).toEqual(['hero.warrior:no-such-state', 'monster.does-not-exist']);
  }, 30000);
});
