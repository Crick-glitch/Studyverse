import { MutationObserver } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { SUMMARY_KEY } from '../features/summary/useSummary';
import { createQueryClient } from './queryClient';

describe('createQueryClient', () => {
  it('refreshes the summary after any successful mutation', async () => {
    const client = createQueryClient();
    client.setQueryData(SUMMARY_KEY, { dueCards: 1 });
    client.setQueryData(['me'], { name: 'x' });
    expect(client.getQueryState(SUMMARY_KEY)?.isInvalidated).toBe(false);
    await new MutationObserver(client, { mutationFn: async () => 'ok' }).mutate();
    expect(client.getQueryState(SUMMARY_KEY)?.isInvalidated).toBe(true);
    expect(client.getQueryState(['me'])?.isInvalidated).toBe(false); // nothing else is touched
  });

  it('leaves the summary alone when a mutation fails', async () => {
    const client = createQueryClient();
    client.setQueryData(SUMMARY_KEY, { dueCards: 1 });
    await new MutationObserver(client, {
      mutationFn: async () => {
        throw new Error('nope');
      },
    })
      .mutate()
      .catch(() => undefined);
    expect(client.getQueryState(SUMMARY_KEY)?.isInvalidated).toBe(false);
  });
});
