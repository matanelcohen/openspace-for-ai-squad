import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiAdapter } from '../adapters/api-adapter.js';
import { FileOpsAdapter } from '../adapters/file-ops-adapter.js';
import { GitAdapter } from '../adapters/git-adapter.js';
import { SearchAdapter } from '../adapters/search-adapter.js';

// ── GitAdapter ─────────────────────────────────────────────────────

describe('GitAdapter', () => {
  const adapter = new GitAdapter();

  it('exposes 4 git tools', () => {
    const tools = adapter.getTools();
    expect(tools).toHaveLength(4);
    const ids = tools.map((t) => t.id);
    expect(ids).toContain('git-status');
    expect(ids).toContain('git-log');
    expect(ids).toContain('git-diff');
    expect(ids).toContain('git-blame');
  });

  it('has provider name "git"', () => {
    expect(adapter.name).toBe('git');
  });

  it('all tools have category "git"', () => {
    for (const tool of adapter.getTools()) {
      expect(tool.category).toBe('git');
    }
  });

  it('executes git-status in the repo', async () => {
    // We're in a git repo, so this should work
    const result = await adapter.execute('git-status', { cwd: process.cwd() });
    expect(typeof result).toBe('string');
  });

  it('executes git-log with limit', async () => {
    const result = (await adapter.execute('git-log', { limit: 3 })) as string;
    expect(typeof result).toBe('string');
  });

  it('executes git-diff', async () => {
    const result = await adapter.execute('git-diff', {});
    expect(typeof result).toBe('string');
  });

  it('executes git-diff with staged flag', async () => {
    const result = await adapter.execute('git-diff', { staged: true });
    expect(typeof result).toBe('string');
  });

  it('executes git-diff with path', async () => {
    const result = await adapter.execute('git-diff', { path: 'README.md' });
    expect(typeof result).toBe('string');
  });

  it('throws for unknown git tool', async () => {
    await expect(adapter.execute('git-unknown', {})).rejects.toThrow('does not own tool');
  });
});

// ── FileOpsAdapter ────────────────────────────────────────────────

describe('FileOpsAdapter', () => {
  let tmpDir: string;
  let adapter: FileOpsAdapter;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'fileops-test-'));
    adapter = new FileOpsAdapter(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('exposes 5 file tools', () => {
    const tools = adapter.getTools();
    expect(tools).toHaveLength(5);
    const ids = tools.map((t) => t.id);
    expect(ids).toEqual(
      expect.arrayContaining(['file-read', 'file-write', 'file-list', 'file-delete', 'file-stat']),
    );
  });

  it('writes and reads a file', async () => {
    await adapter.execute('file-write', { path: 'hello.txt', content: 'Hello World' });
    const content = await adapter.execute('file-read', { path: 'hello.txt' });
    expect(content).toBe('Hello World');
  });

  it('lists directory contents', async () => {
    await adapter.execute('file-write', { path: 'a.txt', content: '' });
    const entries = (await adapter.execute('file-list', { path: '.' })) as Array<{
      name: string;
      type: string;
    }>;
    expect(entries.some((e) => e.name === 'a.txt')).toBe(true);
  });

  it('gets file stat', async () => {
    await adapter.execute('file-write', { path: 'stat.txt', content: 'x' });
    const info = (await adapter.execute('file-stat', { path: 'stat.txt' })) as {
      size: number;
      isFile: boolean;
    };
    expect(info.isFile).toBe(true);
    expect(info.size).toBeGreaterThan(0);
  });

  it('deletes a file', async () => {
    await adapter.execute('file-write', { path: 'del.txt', content: 'bye' });
    await adapter.execute('file-delete', { path: 'del.txt' });

    await expect(adapter.execute('file-read', { path: 'del.txt' })).rejects.toThrow();
  });

  it('prevents path traversal', async () => {
    await expect(adapter.execute('file-read', { path: '../../../etc/passwd' })).rejects.toThrow(
      'Path traversal not allowed',
    );
  });

  it('throws for unknown file-ops tool', async () => {
    await expect(adapter.execute('file-unknown', {})).rejects.toThrow('does not own tool');
  });
});

// ── SearchAdapter ─────────────────────────────────────────────────

describe('SearchAdapter', () => {
  let tmpDir: string;
  let adapter: SearchAdapter;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'search-test-'));
    adapter = new SearchAdapter(tmpDir);
    // Create test files
    await writeFile(join(tmpDir, 'hello.ts'), 'export function hello() { return "world"; }');
    await writeFile(join(tmpDir, 'goodbye.js'), 'module.exports = { goodbye: true };');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('exposes 2 search tools', () => {
    expect(adapter.getTools()).toHaveLength(2);
  });

  it('greps for a pattern', async () => {
    const result = (await adapter.execute('search-grep', { pattern: 'hello' })) as string;
    expect(result).toContain('hello');
  });

  it('greps with glob filter', async () => {
    const result = (await adapter.execute('search-grep', {
      pattern: 'export',
      glob: '*.ts',
    })) as string;
    expect(result).toContain('hello.ts');
  });

  it('grep returns empty for no matches', async () => {
    const result = await adapter.execute('search-grep', { pattern: 'zzz_nomatch_zzz' });
    expect(result).toBe('');
  });

  it('finds files by name', async () => {
    const result = (await adapter.execute('search-find', { name: '*.ts' })) as string;
    expect(result).toContain('hello.ts');
  });

  it('finds files by type', async () => {
    const result = (await adapter.execute('search-find', { type: 'file' })) as string;
    expect(result).toContain('hello.ts');
  });

  it('finds directories by type', async () => {
    const result = (await adapter.execute('search-find', {
      type: 'directory',
      path: '.',
    })) as string;
    expect(typeof result).toBe('string');
  });

  it('finds files with maxDepth', async () => {
    const result = (await adapter.execute('search-find', { maxDepth: 1 })) as string;
    expect(typeof result).toBe('string');
  });

  it('grep with ignoreCase', async () => {
    const result = (await adapter.execute('search-grep', {
      pattern: 'HELLO',
      ignoreCase: true,
    })) as string;
    expect(result).toContain('hello');
  });

  it('throws for unknown search tool', async () => {
    await expect(adapter.execute('search-unknown', {})).rejects.toThrow('does not own tool');
  });
});

// ── ApiAdapter ────────────────────────────────────────────────────

describe('ApiAdapter', () => {
  const adapter = new ApiAdapter();

  it('exposes 1 api tool', () => {
    expect(adapter.getTools()).toHaveLength(1);
    expect(adapter.getTools()[0]!.id).toBe('api-http-request');
  });

  it('has provider name "api"', () => {
    expect(adapter.name).toBe('api');
  });

  it('tool has all expected parameters', () => {
    const tool = adapter.getTools()[0]!;
    const paramNames = tool.parameters.map((p) => p.name);
    expect(paramNames).toEqual(
      expect.arrayContaining(['url', 'method', 'headers', 'body', 'timeout']),
    );
  });

  it('throws for unknown api tool', async () => {
    await expect(adapter.execute('api-unknown', {})).rejects.toThrow('does not own tool');
  });

  it('makes a GET request returning JSON', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: true }),
      text: async () => '{"success":true}',
    });
    vi.stubGlobal('fetch', mockFetch);

    try {
      const result = (await adapter.execute('api-http-request', {
        url: 'https://api.example.com/data',
      })) as { status: number; body: unknown; headers: Record<string, string> };

      expect(result.status).toBe(200);
      expect(result.body).toEqual({ success: true });
      expect(result.headers).toBeDefined();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({ method: 'GET' }),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('makes a POST request with body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 201,
      statusText: 'Created',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ id: 1 }),
    });
    vi.stubGlobal('fetch', mockFetch);

    try {
      const result = (await adapter.execute('api-http-request', {
        url: 'https://api.example.com/items',
        method: 'post',
        body: { name: 'test' },
      })) as { status: number; body: unknown };

      expect(result.status).toBe(201);
      const [, options] = mockFetch.mock.calls[0]!;
      expect(options.method).toBe('POST');
      expect(options.body).toBe('{"name":"test"}');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('reads text response for non-JSON content type', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/plain' }),
      text: async () => 'plain text response',
    });
    vi.stubGlobal('fetch', mockFetch);

    try {
      const result = (await adapter.execute('api-http-request', {
        url: 'https://api.example.com/text',
      })) as { body: unknown };

      expect(result.body).toBe('plain text response');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('forwards custom headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', mockFetch);

    try {
      await adapter.execute('api-http-request', {
        url: 'https://api.example.com',
        headers: { Authorization: 'Bearer token' },
      });

      const [, options] = mockFetch.mock.calls[0]!;
      expect(options.headers).toEqual(expect.objectContaining({ Authorization: 'Bearer token' }));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('does not send body when body is null', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', mockFetch);

    try {
      await adapter.execute('api-http-request', {
        url: 'https://api.example.com',
        method: 'GET',
      });

      const [, options] = mockFetch.mock.calls[0]!;
      expect(options.body).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
