import request from 'supertest';
import type { Express } from 'express';
import type { TestKeys } from './jwt.js';

/** A tiny authenticated HTTP client for one test player. */
export function client(app: Express, keys: TestKeys, userId: string) {
  const auth = async () => `Bearer ${await keys.sign({ sub: userId })}`;
  const call = async (
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    body?: unknown,
  ) => {
    const agent = request(app);
    const req = agent[method](`/api/v1${path}`).set('Authorization', await auth());
    return body === undefined ? req : req.send(body as object);
  };
  return {
    get: (p: string) => call('get', p),
    post: (p: string, b: unknown = {}) => call('post', p, b),
    patch: (p: string, b: unknown) => call('patch', p, b),
    del: (p: string) => call('delete', p),
  };
}
