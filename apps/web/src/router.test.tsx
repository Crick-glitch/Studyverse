import { render, screen, cleanup } from '@testing-library/react';
import { RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { createTestRouter } from './router';

afterEach(cleanup);

const cases: [string, string][] = [
  ['/', 'Dashboard'],
  ['/quests', 'Quest Board'],
  ['/sessions', 'Study Sessions'],
  ['/lab', 'Lab'],
  ['/camp', 'Camp'],
  ['/dungeons', 'Dungeons'],
  ['/battle/abc', 'Battle'],
  ['/stats', 'Stats'],
  ['/leaderboard', 'Leaderboard'],
  ['/settings', 'Settings'],
  ['/login', 'Log in'],
];

describe('route shell', () => {
  it.each(cases)('%s renders an honest placeholder', (path, title) => {
    render(<RouterProvider router={createTestRouter(path)} />);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeTruthy();
    expect(screen.getByText(/Coming in a later phase/)).toBeTruthy();
  });

  it('battle route has no main navigation', () => {
    render(<RouterProvider router={createTestRouter('/battle/abc')} />);
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
  });
});
