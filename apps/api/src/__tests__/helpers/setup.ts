/**
 * Test setup — Builds a Fastify app instance pointed at the fixture directory.
 *
 * Provides `buildTestApp()` which creates an app with SQUAD_DIR set to the
 * integration test fixtures, plus helpers for common test patterns.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import { expect } from 'vitest';

import { buildApp } from '../../app.js';

/** Absolute path to the static fixture .squad/ directory used by read-only tests. */
export const FIXTURE_SQUAD_DIR = path.join(
  import.meta.dirname,
  '..',
  'fixtures',
  'squad',
);

/** Absolute path to an empty temporary directory for empty-state tests. */
let _emptyDir: string | null = null;

export async function getEmptySquadDir(): Promise<string> {
  if (!_emptyDir) {
    _emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'squad-empty-'));
  }
  return _emptyDir;
}

/**
 * Create a temporary copy of the fixture directory for tests that need to write.
 * Returns the path to the temp directory.
 */
export async function createTempSquadDir(): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'squad-test-'));
  await copyDir(FIXTURE_SQUAD_DIR, tmpDir);
  return tmpDir;
}

/** Recursively copy a directory. */
async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Build a Fastify test app pointed at a specific .squad/ directory.
 * Uses the `squadDir` option on `buildApp()` which passes it directly
 * to the SquadParser constructor.
 *
 * The app is returned ready (not yet listening — use app.inject() for tests).
 */
export async function buildTestApp(
  squadDir: string = FIXTURE_SQUAD_DIR,
): Promise<FastifyInstance> {
  const app = buildApp({ logger: false, squadDir });
  await app.ready();
  return app;
}

/**
 * Inject a request and parse the JSON response.
 * A convenience wrapper around Fastify's inject().
 */
export async function injectJSON<T = unknown>(
  app: FastifyInstance,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  payload?: unknown,
): Promise<{ statusCode: number; body: T; headers: Record<string, string | string[] | number | undefined> }> {
  const request: InjectOptions = {
    method,
    url,
  };

  if (payload !== undefined) {
    request.payload = payload as Exclude<InjectOptions['payload'], undefined>;
  }

  const response: LightMyRequestResponse = await app.inject(request);

  let body: T;
  try {
    body = response.json() as T;
  } catch {
    body = response.body as unknown as T;
  }

  return {
    statusCode: response.statusCode,
    body,
    headers: response.headers,
  };
}

/**
 * Assert that a response has a JSON content type.
 */
export function expectJSON(headers: Record<string, string | string[] | number | undefined>): void {
  const ct = headers['content-type'];
  const contentType = Array.isArray(ct) ? ct[0] : ct;
  expect(contentType).toMatch(/application\/json/);
}

/**
 * Assert that a response is a valid error shape.
 */
export function expectError(
  body: unknown,
  expectedMessage?: string | RegExp,
): void {
  expect(body).toHaveProperty('error');
  if (expectedMessage) {
    const errorBody = body as { error: string; message?: string };
    const msg = errorBody.message ?? errorBody.error;
    if (typeof expectedMessage === 'string') {
      expect(msg).toContain(expectedMessage);
    } else {
      expect(msg).toMatch(expectedMessage);
    }
  }
}
