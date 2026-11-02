import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** Why sign-in is unavailable (shown on the login screen), or null when configured. */
export const supabaseConfigError: string | null =
  url && key
    ? null
    : 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in apps/web/.env (see apps/web/.env.example), then restart the dev server.';

/** null when not configured. Uses the publishable key only. */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
    : null;
