import { SignJWT } from 'jose';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { createTokenVerifier } from './lib/auth.js';
import { buildTestApp, noDb } from './test/app.js';
import { createTestKeys, TEST_ISSUER, TEST_SUPABASE_URL, type TestKeys } from './test/jwt.js';

let app: Express;
let keys: TestKeys;
beforeAll(async () => {
  ({ app, keys } = await buildTestApp(noDb));
});

const get = (token?: string) => {
  const r = request(app).get('/api/v1/me');
  return token === undefined ? r : r.set('Authorization', token);
};
const unauth = { error: { code: 'UNAUTHENTICATED', message: expect.any(String) } };

describe('protected routes reject bad credentials with 401 (before any database access)', () => {
  it('no Authorization header', async () => {
    const res = await get();
    expect(res.status).toBe(401);
    expect(res.body).toEqual(unauth);
  });
  it('not a bearer token', async () => {
    expect((await get('Basic abc')).status).toBe(401);
  });
  it('garbage token', async () => {
    expect((await get('Bearer not.a.jwt')).status).toBe(401);
  });
  it('expired token', async () => {
    const token = await keys.sign({ expiresIn: Math.floor(Date.now() / 1000) - 3600 });
    const res = await get(`Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual(unauth);
  });
  it('tampered payload (signature no longer matches)', async () => {
    const token = await keys.sign();
    const [h, , s] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({
        sub: crypto.randomUUID(),
        role: 'authenticated',
        aud: 'authenticated',
        iss: TEST_ISSUER,
        exp: 9999999999,
      }),
    ).toString('base64url');
    expect((await get(`Bearer ${h}.${forged}.${s}`)).status).toBe(401);
  });
  it('signed by a key that is not in the project key set', async () => {
    expect((await get(`Bearer ${await keys.signWithForeignKey()}`)).status).toBe(401);
  });
  it('symmetric (HS256) token is refused', async () => {
    const token = await new SignJWT({ role: 'authenticated' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(crypto.randomUUID())
      .setIssuer(TEST_ISSUER)
      .setAudience('authenticated')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('shared-secret-shared-secret-1234567'));
    expect((await get(`Bearer ${token}`)).status).toBe(401);
  });
  it('wrong issuer, wrong audience, anon role, non-UUID subject', async () => {
    for (const o of [
      { issuer: 'https://evil.example/auth/v1' },
      { audience: 'anon' },
      { role: 'anon' },
      { sub: 'admin' },
    ]) {
      expect((await get(`Bearer ${await keys.sign(o)}`)).status, JSON.stringify(o)).toBe(401);
    }
  });
});

describe('createTokenVerifier', () => {
  it('returns the id and email from a valid token', async () => {
    const k = await createTestKeys();
    const verify = createTokenVerifier({ supabaseUrl: TEST_SUPABASE_URL, keys: k.keys });
    const sub = crypto.randomUUID();
    expect(await verify(await k.sign({ sub, email: 'a@b.co' }))).toEqual({
      id: sub,
      email: 'a@b.co',
    });
  });
});
