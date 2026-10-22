/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  /** Publishable key only. The secret / service_role key must never be used in the browser. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}
