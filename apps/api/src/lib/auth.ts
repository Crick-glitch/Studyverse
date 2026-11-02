import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { AppError } from './errors.js';

export interface AuthUser {
  /** Supabase auth.users.id (the JWT "sub" claim). */
  id: string;
  email: string | null;
}

export type TokenVerifier = (token: string) => Promise<AuthUser>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Verifies a Supabase access token against the project's public signing keys (JWKS) with `jose`:
 * signature, expiry, issuer (<SUPABASE_URL>/auth/v1) and audience ("authenticated").
 * Any failure becomes a generic 401; the reason is never sent to the client.
 *
 * `keys` can be injected (tests use a local key set instead of the network).
 */
export function createTokenVerifier(opts: {
  supabaseUrl: string;
  jwksUrl?: string;
  keys?: JWTVerifyGetKey;
}): TokenVerifier {
  const issuer = `${opts.supabaseUrl.replace(/\/$/, '')}/auth/v1`;
  const keys =
    opts.keys ?? createRemoteJWKSet(new URL(opts.jwksUrl ?? `${issuer}/.well-known/jwks.json`));

  return async (token) => {
    try {
      const { payload } = await jwtVerify(token, keys, {
        issuer,
        audience: 'authenticated',
        // Reject symmetric/"none" algorithms: Supabase signs with asymmetric keys.
        algorithms: ['ES256', 'RS256', 'EdDSA'],
        clockTolerance: 5,
      });
      const sub = payload.sub;
      if (!sub || !UUID_RE.test(sub) || payload['role'] !== 'authenticated') {
        throw new Error('token is not an authenticated user token');
      }
      const email = typeof payload['email'] === 'string' ? payload['email'] : null;
      return { id: sub.toLowerCase(), email };
    } catch {
      throw new AppError(401, 'UNAUTHENTICATED', 'Missing or invalid credentials');
    }
  };
}
