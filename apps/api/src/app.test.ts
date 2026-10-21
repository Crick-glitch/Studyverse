import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

const app = createApp({ CORS_ORIGINS: ['http://localhost:5173'] });

describe('GET /api/v1/health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.headers['x-request-id']).toBeTruthy();
  });
});

describe('error handling', () => {
  it('uses the single error shape for unknown routes', async () => {
    const res = await request(app).get('/api/v1/nope');
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

describe('loadConfig', () => {
  it('applies defaults', () => {
    const c = loadConfig({} as NodeJS.ProcessEnv);
    expect(c.PORT).toBe(4000);
    expect(c.CORS_ORIGINS).toEqual(['http://localhost:5173']);
  });
  it('reports every invalid variable', () => {
    expect(() =>
      loadConfig({ PORT: 'abc', CORS_ORIGINS: 'not a url' } as NodeJS.ProcessEnv),
    ).toThrow(/PORT[\s\S]*CORS_ORIGINS/);
  });
});
