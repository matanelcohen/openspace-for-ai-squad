import { describe, expect, it, vi } from 'vitest';

import { CustomToolProvider, extractPath, substituteParams } from '../custom-tool-provider.js';
import type { CustomToolDescriptor } from '../types.js';

// ── Helpers ────────────────────────────────────────────────────────

function makeCustomTool(overrides: Partial<CustomToolDescriptor> = {}): CustomToolDescriptor {
  return {
    id: 'my-custom-tool',
    name: 'My Custom Tool',
    description: 'A custom tool for testing',
    version: '1.0.0',
    category: 'custom',
    parameters: [],
    execution: {
      mode: 'cli-command',
      command: 'echo',
      args: ['hello'],
      parseOutput: 'text',
    },
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('CustomToolProvider', () => {
  describe('tool management', () => {
    it('starts with no tools', () => {
      const provider = new CustomToolProvider();
      expect(provider.getTools()).toHaveLength(0);
      expect(provider.getAllCustomTools()).toHaveLength(0);
    });

    it('adds a custom tool', () => {
      const provider = new CustomToolProvider();
      const tool = makeCustomTool();
      provider.addTool(tool);

      expect(provider.hasTool('my-custom-tool')).toBe(true);
      expect(provider.getCustomTool('my-custom-tool')).toEqual(tool);
      expect(provider.getTools()).toHaveLength(1);
    });

    it('removes a custom tool', () => {
      const provider = new CustomToolProvider();
      provider.addTool(makeCustomTool());

      const removed = provider.removeTool('my-custom-tool');
      expect(removed).toBe(true);
      expect(provider.hasTool('my-custom-tool')).toBe(false);
    });

    it('returns false when removing nonexistent tool', () => {
      const provider = new CustomToolProvider();
      expect(provider.removeTool('nonexistent')).toBe(false);
    });

    it('clears all tools', () => {
      const provider = new CustomToolProvider();
      provider.addTool(makeCustomTool({ id: 'tool-aa' }));
      provider.addTool(makeCustomTool({ id: 'tool-bb' }));

      provider.clear();
      expect(provider.getTools()).toHaveLength(0);
    });

    it('getCustomTool returns undefined for unknown tool', () => {
      const provider = new CustomToolProvider();
      expect(provider.getCustomTool('nope')).toBeUndefined();
    });

    it('getAllCustomTools returns all tools as an array', () => {
      const provider = new CustomToolProvider();
      provider.addTool(makeCustomTool({ id: 'tool-aa' }));
      provider.addTool(makeCustomTool({ id: 'tool-bb' }));

      const all = provider.getAllCustomTools();
      expect(all).toHaveLength(2);
      expect(all.map((t) => t.id)).toEqual(['tool-aa', 'tool-bb']);
    });

    it('has name "custom-tools"', () => {
      const provider = new CustomToolProvider();
      expect(provider.name).toBe('custom-tools');
    });

    it('overwrites a tool with same id', () => {
      const provider = new CustomToolProvider();
      provider.addTool(makeCustomTool({ id: 'tool-aa', name: 'V1' }));
      provider.addTool(makeCustomTool({ id: 'tool-aa', name: 'V2' }));

      expect(provider.getCustomTool('tool-aa')?.name).toBe('V2');
      expect(provider.getTools()).toHaveLength(1);
    });
  });

  describe('execute — error cases', () => {
    it('throws for unknown tool', async () => {
      const provider = new CustomToolProvider();
      await expect(provider.execute('nonexistent', {})).rejects.toThrow(
        'Custom tool "nonexistent" not found',
      );
    });

    it('throws for unknown execution mode', async () => {
      const provider = new CustomToolProvider();
      provider.addTool(
        makeCustomTool({
          execution: { mode: 'unknown-mode' as never } as never,
        }),
      );

      await expect(provider.execute('my-custom-tool', {})).rejects.toThrow(
        'Unknown execution mode',
      );
    });
  });

  describe('execute — cli-command mode', () => {
    it('runs a simple echo command', async () => {
      const provider = new CustomToolProvider();
      provider.addTool(
        makeCustomTool({
          execution: {
            mode: 'cli-command',
            command: 'echo',
            args: ['hello world'],
            parseOutput: 'text',
          },
        }),
      );

      const result = (await provider.execute('my-custom-tool', {})) as {
        exitCode: number;
        stdout: unknown;
      };
      expect(result.exitCode).toBe(0);
      expect((result.stdout as string).trim()).toBe('hello world');
    });

    it('substitutes params in args', async () => {
      const provider = new CustomToolProvider();
      provider.addTool(
        makeCustomTool({
          execution: {
            mode: 'cli-command',
            command: 'echo',
            args: ['{{message}}'],
            parseOutput: 'text',
          },
        }),
      );

      const result = (await provider.execute('my-custom-tool', { message: 'substituted' })) as {
        stdout: unknown;
      };
      expect((result.stdout as string).trim()).toBe('substituted');
    });

    it('parses JSON output', async () => {
      const { mkdtemp, writeFile: wf, rm: rmf } = await import('node:fs/promises');
      const { tmpdir: td } = await import('node:os');
      const { join: jn } = await import('node:path');
      const tmpDir = await mkdtemp(jn(td(), 'cp-json-'));
      const script = jn(tmpDir, 'json.sh');
      await wf(script, '#!/bin/sh\necho \'{"key":"value"}\'', { mode: 0o755 });

      try {
        const provider = new CustomToolProvider();
        provider.addTool(
          makeCustomTool({
            execution: {
              mode: 'cli-command',
              command: script,
              args: [],
              parseOutput: 'json',
            },
          }),
        );

        const result = (await provider.execute('my-custom-tool', {})) as {
          stdout: unknown;
        };
        expect(result.stdout).toEqual({ key: 'value' });
      } finally {
        await rmf(tmpDir, { recursive: true, force: true });
      }
    });

    it('falls back to text when JSON parse fails', async () => {
      const provider = new CustomToolProvider();
      provider.addTool(
        makeCustomTool({
          execution: {
            mode: 'cli-command',
            command: 'echo',
            args: ['not json'],
            parseOutput: 'json',
          },
        }),
      );

      const result = (await provider.execute('my-custom-tool', {})) as {
        stdout: unknown;
      };
      expect(typeof result.stdout).toBe('string');
    });

    it('parses lines output', async () => {
      const { mkdtemp, writeFile: wf, rm: rmf } = await import('node:fs/promises');
      const { tmpdir: td } = await import('node:os');
      const { join: jn } = await import('node:path');
      const tmpDir = await mkdtemp(jn(td(), 'cp-lines-'));
      const script = jn(tmpDir, 'lines.sh');
      await wf(script, '#!/bin/sh\nprintf "line1\\nline2\\nline3\\n"', { mode: 0o755 });

      try {
        const provider = new CustomToolProvider();
        provider.addTool(
          makeCustomTool({
            execution: {
              mode: 'cli-command',
              command: script,
              args: [],
              parseOutput: 'lines',
            },
          }),
        );

        const result = (await provider.execute('my-custom-tool', {})) as {
          stdout: unknown;
        };
        expect(Array.isArray(result.stdout)).toBe(true);
        expect((result.stdout as string[]).length).toBeGreaterThanOrEqual(2);
      } finally {
        await rmf(tmpDir, { recursive: true, force: true });
      }
    });

    it('rejects when command fails with no stdout', async () => {
      const provider = new CustomToolProvider();
      provider.addTool(
        makeCustomTool({
          execution: {
            mode: 'cli-command',
            command: 'ls',
            args: ['--totally-invalid-flag-xyz-999'],
            parseOutput: 'text',
          },
        }),
      );

      await expect(provider.execute('my-custom-tool', {})).rejects.toThrow(/Command failed/);
    });
  });

  describe('execute — rest-api mode', () => {
    it('makes a GET request using mocked fetch', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: 'hello' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new CustomToolProvider();
      provider.addTool(
        makeCustomTool({
          execution: {
            mode: 'rest-api',
            url: 'https://api.example.com/test',
            method: 'GET',
          },
        }),
      );

      const result = (await provider.execute('my-custom-tool', {})) as {
        status: number;
        body: unknown;
      };
      expect(result.status).toBe(200);
      expect(result.body).toEqual({ data: 'hello' });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({ method: 'GET' }),
      );

      vi.unstubAllGlobals();
    });

    it('uses body template with parameter substitution', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 201,
        statusText: 'Created',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ id: 42 }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new CustomToolProvider();
      provider.addTool(
        makeCustomTool({
          execution: {
            mode: 'rest-api',
            url: 'https://api.example.com/items',
            method: 'POST',
            bodyTemplate: '{"name":"{{itemName}}","count":{{itemCount}}}',
          },
        }),
      );

      await provider.execute('my-custom-tool', { itemName: 'widget', itemCount: 5 });

      const [, options] = mockFetch.mock.calls[0]!;
      expect(options.body).toBe('{"name":"widget","count":5}');
      expect(options.method).toBe('POST');

      vi.unstubAllGlobals();
    });

    it('uses params.url to override config url', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: async () => 'plain text response',
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new CustomToolProvider();
      provider.addTool(
        makeCustomTool({
          execution: {
            mode: 'rest-api',
            url: 'https://default.com',
            method: 'GET',
          },
        }),
      );

      await provider.execute('my-custom-tool', { url: 'https://override.com/path' });
      expect(mockFetch).toHaveBeenCalledWith('https://override.com/path', expect.any(Object));

      vi.unstubAllGlobals();
    });

    it('applies responseTransform', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: { results: [1, 2, 3] } }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new CustomToolProvider();
      provider.addTool(
        makeCustomTool({
          execution: {
            mode: 'rest-api',
            url: 'https://api.example.com',
            method: 'GET',
            responseTransform: 'data.results',
          },
        }),
      );

      const result = (await provider.execute('my-custom-tool', {})) as {
        body: unknown;
      };
      expect(result.body).toEqual([1, 2, 3]);

      vi.unstubAllGlobals();
    });

    it('reads text response when content-type is not JSON', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'text/html' }),
        text: async () => '<html>Hello</html>',
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new CustomToolProvider();
      provider.addTool(
        makeCustomTool({
          execution: {
            mode: 'rest-api',
            url: 'https://api.example.com',
            method: 'GET',
          },
        }),
      );

      const result = (await provider.execute('my-custom-tool', {})) as {
        body: unknown;
      };
      expect(result.body).toBe('<html>Hello</html>');

      vi.unstubAllGlobals();
    });

    it('uses params.body when no bodyTemplate', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new CustomToolProvider();
      provider.addTool(
        makeCustomTool({
          execution: {
            mode: 'rest-api',
            url: 'https://api.example.com',
            method: 'POST',
          },
        }),
      );

      await provider.execute('my-custom-tool', { body: { key: 'val' } });
      const [, options] = mockFetch.mock.calls[0]!;
      expect(options.body).toBe('{"key":"val"}');

      vi.unstubAllGlobals();
    });

    it('does not send body for GET even if bodyTemplate provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new CustomToolProvider();
      provider.addTool(
        makeCustomTool({
          execution: {
            mode: 'rest-api',
            url: 'https://api.example.com',
            method: 'GET',
            bodyTemplate: '{"ignored": true}',
          },
        }),
      );

      await provider.execute('my-custom-tool', {});
      const [, options] = mockFetch.mock.calls[0]!;
      expect(options.body).toBeUndefined();

      vi.unstubAllGlobals();
    });

    it('forwards custom headers', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new CustomToolProvider();
      provider.addTool(
        makeCustomTool({
          execution: {
            mode: 'rest-api',
            url: 'https://api.example.com',
            method: 'GET',
            headers: { Authorization: 'Bearer token123', 'X-Custom': 'value' },
          },
        }),
      );

      await provider.execute('my-custom-tool', {});
      const [, options] = mockFetch.mock.calls[0]!;
      expect(options.headers).toEqual(
        expect.objectContaining({
          Authorization: 'Bearer token123',
          'X-Custom': 'value',
        }),
      );

      vi.unstubAllGlobals();
    });
  });

  describe('execute — file-processor mode', () => {
    it('reads a file', async () => {
      const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
      const { tmpdir } = await import('node:os');
      const { join } = await import('node:path');

      const tmpDir = await mkdtemp(join(tmpdir(), 'cp-test-'));
      try {
        await writeFile(join(tmpDir, 'test.txt'), 'hello file content');

        const provider = new CustomToolProvider();
        provider.addTool(
          makeCustomTool({
            execution: {
              mode: 'file-processor',
              operation: 'read',
              basePath: tmpDir,
            },
          }),
        );

        const result = (await provider.execute('my-custom-tool', { path: 'test.txt' })) as {
          content: string;
          size: number;
        };
        expect(result.content).toBe('hello file content');
        expect(result.size).toBe(18);
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('writes a file', async () => {
      const { mkdtemp, readFile, rm } = await import('node:fs/promises');
      const { tmpdir } = await import('node:os');
      const { join } = await import('node:path');

      const tmpDir = await mkdtemp(join(tmpdir(), 'cp-test-'));
      try {
        const provider = new CustomToolProvider();
        provider.addTool(
          makeCustomTool({
            execution: {
              mode: 'file-processor',
              operation: 'write',
              basePath: tmpDir,
            },
          }),
        );

        const result = (await provider.execute('my-custom-tool', {
          path: 'output.txt',
          content: 'written content',
        })) as { written: boolean; size: number };

        expect(result.written).toBe(true);
        expect(result.size).toBe(15);

        const ondisk = await readFile(join(tmpDir, 'output.txt'), 'utf-8');
        expect(ondisk).toBe('written content');
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('transforms a file with inline JS', async () => {
      const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
      const { tmpdir } = await import('node:os');
      const { join } = await import('node:path');

      const tmpDir = await mkdtemp(join(tmpdir(), 'cp-test-'));
      try {
        await writeFile(join(tmpDir, 'src.txt'), 'hello world');

        const provider = new CustomToolProvider();
        provider.addTool(
          makeCustomTool({
            execution: {
              mode: 'file-processor',
              operation: 'transform',
              basePath: tmpDir,
              transformScript: 'return content.toUpperCase();',
            },
          }),
        );

        const result = (await provider.execute('my-custom-tool', { path: 'src.txt' })) as {
          original: string;
          transformed: string;
        };
        expect(result.original).toBe('hello world');
        expect(result.transformed).toBe('HELLO WORLD');
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('throws when read has no path param', async () => {
      const provider = new CustomToolProvider();
      provider.addTool(
        makeCustomTool({
          execution: {
            mode: 'file-processor',
            operation: 'read',
          },
        }),
      );

      await expect(provider.execute('my-custom-tool', {})).rejects.toThrow(
        'requires a "path" parameter',
      );
    });

    it('throws when write has no path param', async () => {
      const provider = new CustomToolProvider();
      provider.addTool(
        makeCustomTool({
          execution: {
            mode: 'file-processor',
            operation: 'write',
          },
        }),
      );

      await expect(provider.execute('my-custom-tool', {})).rejects.toThrow(
        'requires a "path" parameter',
      );
    });

    it('throws when write has no content param', async () => {
      const provider = new CustomToolProvider();
      provider.addTool(
        makeCustomTool({
          execution: {
            mode: 'file-processor',
            operation: 'write',
            basePath: '/tmp',
          },
        }),
      );

      await expect(provider.execute('my-custom-tool', { path: 'test.txt' })).rejects.toThrow(
        'requires a "content" parameter',
      );
    });

    it('throws when transform has no path', async () => {
      const provider = new CustomToolProvider();
      provider.addTool(
        makeCustomTool({
          execution: {
            mode: 'file-processor',
            operation: 'transform',
            transformScript: 'return content;',
          },
        }),
      );

      await expect(provider.execute('my-custom-tool', {})).rejects.toThrow(
        'requires a "path" parameter',
      );
    });

    it('throws when transform has no transformScript', async () => {
      const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
      const { tmpdir } = await import('node:os');
      const { join } = await import('node:path');

      const tmpDir = await mkdtemp(join(tmpdir(), 'cp-test-'));
      try {
        await writeFile(join(tmpDir, 'x.txt'), 'data');

        const provider = new CustomToolProvider();
        provider.addTool(
          makeCustomTool({
            execution: {
              mode: 'file-processor',
              operation: 'transform',
              basePath: tmpDir,
            },
          }),
        );

        await expect(provider.execute('my-custom-tool', { path: 'x.txt' })).rejects.toThrow(
          'requires a "transformScript"',
        );
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('throws for unknown file processor operation', async () => {
      const provider = new CustomToolProvider();
      provider.addTool(
        makeCustomTool({
          execution: {
            mode: 'file-processor',
            operation: 'delete' as never,
          },
        }),
      );

      await expect(provider.execute('my-custom-tool', { path: 'x.txt' })).rejects.toThrow(
        'Unknown file processor operation',
      );
    });
  });
});

// ── substituteParams ───────────────────────────────────────────────

describe('substituteParams', () => {
  it('replaces single placeholder', () => {
    expect(substituteParams('Hello {{name}}!', { name: 'World' })).toBe('Hello World!');
  });

  it('replaces multiple placeholders', () => {
    expect(substituteParams('{{a}} and {{b}}', { a: 'X', b: 'Y' })).toBe('X and Y');
  });

  it('replaces missing params with empty string', () => {
    expect(substituteParams('Hi {{name}}', {})).toBe('Hi ');
  });

  it('handles numeric values', () => {
    expect(substituteParams('count={{n}}', { n: 42 })).toBe('count=42');
  });

  it('handles boolean values', () => {
    expect(substituteParams('flag={{f}}', { f: true })).toBe('flag=true');
  });

  it('handles null/undefined values as empty string', () => {
    expect(substituteParams('val={{x}}', { x: null })).toBe('val=');
    expect(substituteParams('val={{x}}', { x: undefined })).toBe('val=');
  });

  it('preserves text without placeholders', () => {
    expect(substituteParams('no placeholders here', { a: 1 })).toBe('no placeholders here');
  });

  it('handles repeated same placeholder', () => {
    expect(substituteParams('{{x}}-{{x}}', { x: 'A' })).toBe('A-A');
  });
});

// ── extractPath ────────────────────────────────────────────────────

describe('extractPath', () => {
  it('extracts a top-level key', () => {
    expect(extractPath({ name: 'hello' }, 'name')).toBe('hello');
  });

  it('extracts nested values', () => {
    expect(extractPath({ data: { results: [1, 2, 3] } }, 'data.results')).toEqual([1, 2, 3]);
  });

  it('returns undefined for missing path', () => {
    expect(extractPath({ a: 1 }, 'b')).toBeUndefined();
  });

  it('returns undefined for deeply missing path', () => {
    expect(extractPath({ a: { b: 1 } }, 'a.c.d')).toBeUndefined();
  });

  it('returns undefined when traversing non-object', () => {
    expect(extractPath({ a: 'string' }, 'a.b')).toBeUndefined();
  });

  it('handles null at intermediate step', () => {
    expect(extractPath({ a: null }, 'a.b')).toBeUndefined();
  });

  it('handles arrays by numeric index string', () => {
    expect(extractPath({ items: ['a', 'b', 'c'] }, 'items.1')).toBe('b');
  });
});
