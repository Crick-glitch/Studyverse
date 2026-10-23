import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TasksPanel } from './TasksPanel';

const m = vi.hoisted(() => ({ list: vi.fn(), complete: vi.fn() }));
vi.mock('../../lib/api', () => ({
  errorMessage: (e: unknown) => (e instanceof Error ? e.message : 'error'),
  api: {
    tasks: {
      list: m.list,
      complete: m.complete,
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      reopen: vi.fn(),
    },
  },
}));

const open = {
  id: 't1',
  title: 'Read chapter 4',
  difficulty: 'medium',
  subject: 'History',
  status: 'open',
  rewardXp: 25,
  rewarded: false,
  completedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
  m.list.mockReset().mockResolvedValue([open]);
  m.complete.mockReset();
});
afterEach(cleanup);

const renderPanel = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TasksPanel />
    </QueryClientProvider>,
  );

describe('TasksPanel', () => {
  it('shows the reward before the task is completed', async () => {
    renderPanel();
    expect(await screen.findByText('Read chapter 4')).toBeTruthy();
    expect(screen.getByText('Reward: +25 XP')).toBeTruthy();
  });

  it('completing a task calls the API once, reports the XP and refetches from the server', async () => {
    m.complete.mockResolvedValue({
      task: { ...open, status: 'completed', rewarded: true },
      reward: { xp: 25, note: 'paid', levelsGained: 0, skillPointsAwarded: 0 },
      progress: {},
    });
    renderPanel();
    await screen.findByText('Read chapter 4');
    fireEvent.click(screen.getByRole('button', { name: 'Complete' }));
    expect(await screen.findByText(/Task complete: \+25 XP/)).toBeTruthy();
    expect(m.complete).toHaveBeenCalledTimes(1);
    expect(m.complete).toHaveBeenCalledWith('t1');
    await waitFor(() => expect(m.list.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it('says plainly when the daily cap paid nothing', async () => {
    m.complete.mockResolvedValue({
      task: { ...open, status: 'completed' },
      reward: { xp: 0, note: 'daily_cap_reached', levelsGained: 0, skillPointsAwarded: 0 },
      progress: {},
    });
    renderPanel();
    await screen.findByText('Read chapter 4');
    fireEvent.click(screen.getByRole('button', { name: 'Complete' }));
    expect(await screen.findByText(/No XP/)).toBeTruthy();
  });

  it('asks before deleting', async () => {
    renderPanel();
    await screen.findByText('Read chapter 4');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('dialog', { name: 'Delete this task?' })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
