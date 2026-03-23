/**
 * Tests for Activity Feed route — P3-3
 */

import type { ActivityEvent } from '@openspace/shared';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ActivityFeed } from '../services/activity/index.js';
import activityRoute from './activity.js';

// ── Test helpers ──────────────────────────────────────────────────

function makeEvent(id: string, i: number): ActivityEvent {
  return {
    id,
    type: 'started',
    agentId: 'bender',
    description: `Event ${i}`,
    timestamp: `2026-01-01T00:00:${String(i).padStart(2, '0')}Z`,
    relatedEntityId: null,
  };
}

// ── Tests ─────────────────────────────────────────────────────────

describe('GET /api/activity', () => {
  let app: FastifyInstance;
  let feed: ActivityFeed;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    feed = new ActivityFeed();
    app.decorate('activityFeed', feed);
    app.register(activityRoute, { prefix: '/api' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return empty list when no events', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/activity' });
    const body = res.json();

    expect(res.statusCode).toBe(200);
    expect(body.events).toEqual([]);
    expect(body.total).toBe(0);
  });

  it('should return events with default pagination', async () => {
    for (let i = 0; i < 5; i++) {
      feed.push(makeEvent(`evt-${i}`, i));
    }

    const res = await app.inject({ method: 'GET', url: '/api/activity' });
    const body = res.json();

    expect(res.statusCode).toBe(200);
    expect(body.events).toHaveLength(5);
    expect(body.total).toBe(5);
    expect(body.limit).toBe(50);
    expect(body.offset).toBe(0);
  });

  it('should paginate with limit and offset', async () => {
    for (let i = 0; i < 10; i++) {
      feed.push(makeEvent(`evt-${i}`, i));
    }

    const res = await app.inject({
      method: 'GET',
      url: '/api/activity?limit=3&offset=2',
    });
    const body = res.json();

    expect(body.events).toHaveLength(3);
    expect(body.limit).toBe(3);
    expect(body.offset).toBe(2);
  });

  it('should clamp limit to max 200', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/activity?limit=500',
    });
    const body = res.json();

    expect(body.limit).toBe(200);
  });
});
