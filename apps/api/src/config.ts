import { z } from 'zod';

const origins = z
  .string()
  .default('http://localhost:5173')
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )
  .refine((list) => list.every((o) => URL.canParse(o)), {
    message: 'must be a comma-separated list of absolute origins',
  });

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    CORS_ORIGINS: origins,
    /** Pooled connection (app traffic). Supabase: transaction pooler string. */
    DATABASE_URL: z.string().url().optional(),
    /** Direct connection (migrations only; read by prisma.config.ts, not by the running API). */
    DIRECT_URL: z.string().url().optional(),
    SUPABASE_URL: z.string().url().optional(),
    /** Defaults to <SUPABASE_URL>/auth/v1/.well-known/jwks.json */
    SUPABASE_JWKS_URL: z.string().url().optional(),
    /** Number of reverse-proxy hops in front of the API (so rate limits see real client IPs). */
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60_000),
    RATE_LIMIT_GENERAL_MAX: z.coerce.number().int().min(1).default(300),
    RATE_LIMIT_AUTH_MAX: z.coerce.number().int().min(1).default(60),
    RATE_LIMIT_BATTLE_ANSWER_MAX: z.coerce.number().int().min(1).default(60),
    RATE_LIMIT_IMPORT_MAX: z.coerce.number().int().min(1).default(5),
  })
  .superRefine((env, ctx) => {
    // The server needs these; unit tests inject their own dependencies instead.
    if (env.NODE_ENV === 'test') return;
    for (const key of ['DATABASE_URL', 'SUPABASE_URL'] as const) {
      if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: 'is required' });
    }
  })
  .transform((env) => ({
    ...env,
    SUPABASE_JWKS_URL:
      env.SUPABASE_JWKS_URL ??
      (env.SUPABASE_URL
        ? `${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`
        : undefined),
  }));

export type Config = z.infer<typeof envSchema>;

/** Validates env vars once; throws a readable error listing every bad variable. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.') || 'env'}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return parsed.data;
}
