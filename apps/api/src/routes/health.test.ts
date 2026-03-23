import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../app.js';

describe('GET /health', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 with status ok and a timestamp', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
    // Verify timestamp is a valid ISO string
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it('returns valid JSON content type', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.headers['content-type']).toMatch(/application\/json/);
  });

  it('returns a recent timestamp', async () => {
    const before = new Date();
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });
    const after = new Date();

    const body = response.json();
    const timestamp = new Date(body.timestamp);

    expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
