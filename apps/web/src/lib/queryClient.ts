import { MutationCache, QueryClient } from '@tanstack/react-query';
import { SUMMARY_KEY } from '../features/summary/useSummary';

/**
 * The app's QueryClient. Any successful write (completing a quest, finishing a session, reviewing or editing a card,
 * importing) can change a number on the hotbar or HUD, so each one refreshes the summary. This is the one place that
 * knows it, so new screens need no extra wiring. The summary is tiny and cached (stale after ~30 s), so over-refreshing
 * costs one small request.
 */
export function createQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    mutationCache: new MutationCache({
      onSuccess: () => {
        void client.invalidateQueries({ queryKey: SUMMARY_KEY });
      },
    }),
  });
  return client;
}
