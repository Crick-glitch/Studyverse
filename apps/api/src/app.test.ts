import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { loadConfig } from './config.js';
import { buildTestApp, noDb } from './test/app.js';
import type { TestKeys } from './test/jwt.js';

let app: Express;
let keys: TestKeys;
beforeAll(async () => {
  ({ app, keys } = await buildTestApp(noDb));
});

describe('GET /api/v1/health', () => {
  it('is public and returns ok', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.headers['x-request-id']).toBeTruthy();
  });
});

describe('error handling', () => {
  it('uses the single error shape for unknown routes (authenticated)', async () => {
    const token = await keys.sign();
    const res = await request(app).get('/api/v1/nope').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
  });

  it('does not leak stack traces on malformed JSON', async () => {
    const res = await request(app)
      .post('/api/v1/health')
      .set('content-type', 'application/json')
      .send('{bad');
    expect(res.status).toBeLessThan(500);
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.(ts|js)/);
    expect(res.body.error.code).toBeTruthy();
  });
});

describe('CORS allowlist', () => {
  it('allows a configured origin', async () => {
    const res = await request(app).get('/api/v1/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
  it('rejects an unknown origin', async () => {
    const res = await request(app).get('/api/v1/health').set('Origin', 'https://evil.example');
    expect(res.status).toBe(403);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('rate limiting', () => {
  it('returns 429 in the standard error shape once the limit is exceeded', async () => {
    const { app: limited } = await buildTestApp(noDb, { RATE_LIMIT_GENERAL_MAX: 3 });
    const statuses: number[] = [];
    let last: request.Response | undefined;
    for (let i = 0; i < 5; i++) {
      last = await request(limited).get('/api/v1/health');
      statuses.push(last.status);
    }
    expect(statuses).toEqual([200, 200, 200, 429, 429]);
    expect(last?.body).toEqual({ error: { code: 'RATE_LIMITED', message: expect.any(String) } });
  });
  it('has a stricter bucket for auth-adjacent routes', async () => {
    const { app: limited, keys: k } = await buildTestApp(noDb, { RATE_LIMIT_AUTH_MAX: 2 });
    const bad = { Authorization: 'Bearer nope' };
    const codes: number[] = [];
    for (let i = 0; i < 4; i++)
      codes.push((await request(limited).get('/api/v1/me').set(bad)).status);
    expect(codes).toEqual([401, 401, 429, 429]);
    void k;
  });
});

describe('loadConfig', () => {
  const ok = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    SUPABASE_URL: 'https://x.supabase.co',
  };
  it('applies defaults and derives the JWKS url', () => {
    const c = loadConfig({ ...ok } as NodeJS.ProcessEnv);
    expect(c.PORT).toBe(4000);
    expect(c.CORS_ORIGINS).toEqual(['http://localhost:5173']);
    expect(c.SUPABASE_JWKS_URL).toBe('https://x.supabase.co/auth/v1/.well-known/jwks.json');
  });
  it('reports every invalid variable at once', () => {
    expect(() =>
      loadConfig({ ...ok, PORT: 'abc', CORS_ORIGINS: 'not a url' } as NodeJS.ProcessEnv),
    ).toThrow(/PORT[\s\S]*CORS_ORIGINS/);
  });
  it('requires the database and Supabase URLs outside tests', () => {
    expect(() => loadConfig({} as NodeJS.ProcessEnv)).toThrow(/DATABASE_URL[\s\S]*SUPABASE_URL/);
  });
  it('does not require database variables in the test environment', () => {
    expect(loadConfig({ NODE_ENV: 'test' } as NodeJS.ProcessEnv).NODE_ENV).toBe('test');
  });
});
