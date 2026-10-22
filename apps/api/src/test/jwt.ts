import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTVerifyGetKey } from 'jose';

export const TEST_SUPABASE_URL = 'https://example-project.supabase.co';
export const TEST_ISSUER = `${TEST_SUPABASE_URL}/auth/v1`;

export interface TestKeys {
  keys: JWTVerifyGetKey;
  sign: (claims?: SignOptions) => Promise<string>;
  /** Sign with a DIFFERENT private key that is not in the key set. */
  signWithForeignKey: (claims?: SignOptions) => Promise<string>;
}

export interface SignOptions {
  sub?: string;
  email?: string;
  role?: string;
  issuer?: string;
  audience?: string;
  /** jose time string ("1h", "-1h") or seconds-since-epoch. */
  expiresIn?: string | number;
}

/** A throwaway ES256 key pair plus a local JWKS, so tests never touch the network. */
export async function createTestKeys(): Promise<TestKeys> {
  const { publicKey, privateKey } = await generateKeyPair('ES256', { extractable: true });
  const foreign = await generateKeyPair('ES256', { extractable: true });
  const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'ES256', use: 'sig' };

  const make =
    (key: Parameters<SignJWT['sign']>[0]) =>
    async (o: SignOptions = {}) => {
      const jwt = new SignJWT({
        role: o.role ?? 'authenticated',
        email: o.email ?? 'player@example.com',
      })
        .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
        .setSubject(o.sub ?? crypto.randomUUID())
        .setIssuer(o.issuer ?? TEST_ISSUER)
        .setAudience(o.audience ?? 'authenticated')
        .setIssuedAt(Math.floor(Date.now() / 1000) - 7200);
      jwt.setExpirationTime(o.expiresIn ?? '1h');
      return jwt.sign(key);
    };

  return {
    keys: createLocalJWKSet({ keys: [jwk] }),
    sign: make(privateKey),
    signWithForeignKey: make(foreign.privateKey),
  };
}
