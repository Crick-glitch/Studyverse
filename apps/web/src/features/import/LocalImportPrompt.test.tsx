import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalImportPrompt } from './LocalImportPrompt';
import { BACKUP_PREFIX, LEGACY_KEY } from './legacy';

const m = vi.hoisted(() => ({ preflight: vi.fn(), run: vi.fn() }));
vi.mock('../../lib/api', () => ({
  errorMessage: (e: unknown) => (e instanceof Error ? e.message : 'error'),
  api: { import: { preflight: m.preflight, run: m.run } },
}));

const OLD_SAVE = JSON.stringify({ level: 3, totalXP: 260, tasks: [], sessions: [], flashcards: [] });
const progress = {
  level: 3, totalXp: 260, currentLevelXp: 10, xpForNextLevel: 200, streak: 0,
  studyEnergy: 0, skillPoints: 2, raidWins: 0, raidLosses: 0,
};
const report = {
  alreadyImported: false,
  imported: { xp: 260, tasks: 0, sessions: 0, flashcards: 0, skills: 0, items: 0, profileFields: [] },
  skipped: [],
  notImported: [],
  notes: [],
  progress,
};
const backupKeys = () =>
  Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter((k) =>
    k?.startsWith(BACKUP_PREFIX),
  );

const renderPrompt = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <LocalImportPrompt userId="u1" />
    </QueryClientProvider>,
  );
const importButton = () => screen.getByRole('button', { name: 'Import' }) as HTMLButtonElement;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  m.preflight.mockReset().mockResolvedValue({
    hasProgress: false,
    existing: { totalXp: 0, tasks: 0, sessions: 0, flashcards: 0 },
  });
  m.run.mockReset().mockResolvedValue(report);
});
afterEach(cleanup);

describe('LocalImportPrompt', () => {
  it('shows nothing when there is no old save', () => {
    renderPrompt();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(m.preflight).not.toHaveBeenCalled();
  });

  it('never imports on its own', async () => {
    localStorage.setItem(LEGACY_KEY, OLD_SAVE);
    renderPrompt();
    await screen.findByRole('dialog', { name: /Import your old StudyVerse progress/ });
    expect(m.run).not.toHaveBeenCalled();
  });

  it('writes a backup copy BEFORE calling the import API', async () => {
    localStorage.setItem(LEGACY_KEY, OLD_SAVE);
    let backupsWhenCalled = -1;
    m.run.mockImplementation(() => {
      backupsWhenCalled = backupKeys().length;
      return Promise.resolve(report);
    });
    renderPrompt();
    await waitFor(() => expect(importButton().disabled).toBe(false));
    fireEvent.click(importButton());
    await screen.findByRole('dialog', { name: 'Old progress imported' });
    expect(backupsWhenCalled).toBe(1);
    expect(localStorage.getItem(backupKeys()[0] as string)).toBe(OLD_SAVE);
  });

  it('requires an explicit merge when the account already has progress', async () => {
    localStorage.setItem(LEGACY_KEY, OLD_SAVE);
    m.preflight.mockResolvedValue({
      hasProgress: true,
      existing: { totalXp: 500, tasks: 2, sessions: 1, flashcards: 4 },
    });
    renderPrompt();
    await screen.findByText(/already has progress/);
    expect(importButton().disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(importButton().disabled).toBe(false);
    fireEvent.click(importButton());
    await waitFor(() => expect(m.run).toHaveBeenCalledTimes(1));
    expect(m.run.mock.calls[0]?.[0]).toMatchObject({ onExistingProgress: 'merge' });
  });

  it('"Not now" closes the dialog and touches nothing', async () => {
    localStorage.setItem(LEGACY_KEY, OLD_SAVE);
    renderPrompt();
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(m.run).not.toHaveBeenCalled();
    expect(localStorage.getItem(LEGACY_KEY)).toBe(OLD_SAVE);
    expect(backupKeys()).toHaveLength(0);
  });

  it('refuses to import an unreadable save but still allows a backup download', async () => {
    localStorage.setItem(LEGACY_KEY, '{not json');
    renderPrompt();
    await screen.findByText(/not valid JSON/);
    expect(importButton().disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Download backup' })).toBeTruthy();
  });
});
