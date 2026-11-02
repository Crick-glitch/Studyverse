import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

export const SUMMARY_KEY = ['summary'] as const;
/** Counts change slowly; ~30 s keeps the badges fresh without a request on every screen change. */
export const SUMMARY_STALE_MS = 30_000;

/**
 * The numbers behind the hotbar badges and the HUD session chip (GET /summary). While it is loading or if it
 * fails, `data` is undefined and the badges simply are not shown: nothing is guessed (hard rule 6).
 * Mutations invalidate this query from one place (the QueryClient's mutation cache, see main.tsx).
 */
export function useSummary() {
  return useQuery({ queryKey: SUMMARY_KEY, queryFn: () => api.summary(), staleTime: SUMMARY_STALE_MS });
}
