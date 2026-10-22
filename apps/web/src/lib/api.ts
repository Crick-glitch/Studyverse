import type { MeDto, ProfileDto, ProfilePatch, ProgressDto } from '@studyverse/shared';
import { supabase } from './supabase';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

/** Calls the API with the current Supabase access token. Errors use the API's single error shape. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Is the API running?');
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const e = (body as { error?: { code?: string; message?: string; details?: unknown } } | null)
      ?.error;
    throw new ApiError(
      res.status,
      e?.code ?? 'UNKNOWN',
      e?.message ?? `Request failed (${res.status})`,
      e?.details,
    );
  }
  return body as T;
}

export const api = {
  me: () => apiFetch<MeDto>('/me'),
  progress: () => apiFetch<{ progress: ProgressDto }>('/progress'),
  patchProfile: (patch: ProfilePatch) =>
    apiFetch<{ profile: ProfileDto }>('/profile', { method: 'PATCH', body: JSON.stringify(patch) }),
};
