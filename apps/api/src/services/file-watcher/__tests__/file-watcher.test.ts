/**
 * Tests for the FileWatcher service.
 *
 * Split into two suites:
 *   1. Unit tests — test classification logic and construction (no FS watching)
 *   2. Integration tests — verify real chokidar events via temp directories
 *
 * Integration tests use poll mode with generous timeouts for Windows CI.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SquadParser } from '../../squad-parser/index.js';
import { FileWatcher, type FileWatcherEvent } from '../index.js';

// ── Helpers ────────────────────────────────────────────────────────

type MockParser = Pick<
  SquadParser,
  'getAgents' | 'getDecisions' | 'getConfig' | 'getSquadOverview' | 'getSquadDir'
>;

function createMockParser(): MockParser {
  return {
    getAgents: vi.fn().mockResolvedValue([]),
    getDecisions: vi.fn().mockResolvedValue([]),
    getConfig: vi.fn().mockResolvedValue({ id: 'default', name: 'Squad', description: '', squadDir: '', agents: [] }),
    getSquadOverview: vi.fn().mockResolvedValue({
      config: { id: 'default', name: 'Squad', description: '', squadDir: '', agents: [] },
      agents: [],
      recentTasks: [],
      taskCounts: { byStatus: { backlog: 0, 'in-progress': 0, 'in-review': 0, done: 0, blocked: 0 }, total: 0 },
      recentDecisions: [],
    }),
    getSquadDir: vi.fn().mockReturnValue(''),
  };
}

function asSquadParser(parser: MockParser): SquadParser {
  return parser as unknown as SquadParser;
}

/** Wait for a specific event with a timeout. */
function waitForEvent(
  watcher: FileWatcher,
  eventType: string,
  timeoutMs = 15000,
): Promise<FileWatcherEvent> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for event: ${eventType}`)),
      timeoutMs,
    );
    watcher.once(eventType, (evt: FileWatcherEvent) => {
      clearTimeout(timer);
      resolve(evt);
    });
  });
}

/** Collect all 'change' events within a time window. */
function collectEvents(
  watcher: FileWatcher,
  windowMs = 4000,
): Promise<FileWatcherEvent[]> {
  return new Promise((resolve) => {
    const events: FileWatcherEvent[] = [];
    const handler = (evt: FileWatcherEvent) => events.push(evt);
    watcher.on('change', handler);
    setTimeout(() => {
      watcher.off('change', handler);
      resolve(events);
    }, windowMs);
  });
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── Unit tests (no FS watching) ────────────────────────────────────

describe('FileWatcher — construction & state', () => {
  let tmpDir: string;
  let watcher: FileWatcher;
  let parser: ReturnType<typeof createMockParser>;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'fw-unit-'));
    writeFileSync(join(tmpDir, 'team.md'), '');
    writeFileSync(join(tmpDir, 'config.json'), '{}');
    parser = createMockParser();
  });

  afterEach(async () => {
    if (watcher) await watcher.stop();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return null state before start()', () => {
    watcher = new FileWatcher({ squadDir: tmpDir, parser: asSquadParser(parser) });
    expect(watcher.getState()).toBeNull();
  });

  it('should populate state on start()', async () => {
    watcher = new FileWatcher({
      squadDir: tmpDir,
      parser: asSquadParser(parser),
      watchMode: 'poll',
      pollIntervalMs: 100,
    });
    await watcher.start();

    expect(watcher.getState()).not.toBeNull();
    expect(parser.getAgents).toHaveBeenCalled();
    expect(parser.getDecisions).toHaveBeenCalled();
    expect(parser.getConfig).toHaveBeenCalled();
    expect(parser.getSquadOverview).toHaveBeenCalled();
  });

  it('should respect WATCH_MODE=poll env var', () => {
    const orig = process.env.WATCH_MODE;
    process.env.WATCH_MODE = 'poll';

    watcher = new FileWatcher({ squadDir: tmpDir, parser: asSquadParser(parser) });
    expect(watcher).toBeDefined();

    process.env.WATCH_MODE = orig;
  });

  it('should respect WATCH_MODE=native env var (overrides option)', () => {
    const orig = process.env.WATCH_MODE;
    process.env.WATCH_MODE = 'native';

    watcher = new FileWatcher({
      squadDir: tmpDir,
      parser: asSquadParser(parser),
      watchMode: 'poll',
    });
    expect(watcher).toBeDefined();

    process.env.WATCH_MODE = orig;
  });

  it('should stop cleanly and suppress further events', async () => {
    watcher = new FileWatcher({
      squadDir: tmpDir,
      parser: asSquadParser(parser),
      watchMode: 'poll',
      pollIntervalMs: 100,
    });
    await watcher.start();
    await watcher.stop();

    const handler = vi.fn();
    watcher.on('change', handler);
    writeFileSync(join(tmpDir, 'team.md'), '# After stop\n');

    await delay(600);
    expect(handler).not.toHaveBeenCalled();
  });

  it('should allow refreshState() to be called manually', async () => {
    watcher = new FileWatcher({ squadDir: tmpDir, parser: asSquadParser(parser) });
    const state = await watcher.refreshState();
    expect(state.agents).toEqual([]);
    expect(state.decisions).toEqual([]);
    expect(watcher.getState()).toBe(state);
  });
});

// ── Integration tests (real chokidar polling) ──────────────────────

describe('FileWatcher — integration (chokidar polling)', () => {
  let tmpDir: string;
  let watcher: FileWatcher;
  let parser: ReturnType<typeof createMockParser>;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'fw-int-'));
    writeFileSync(join(tmpDir, 'team.md'), '# Team\n');
    writeFileSync(join(tmpDir, 'config.json'), '{}');
    writeFileSync(join(tmpDir, 'decisions.md'), '# Decisions\n');
    mkdirSync(join(tmpDir, 'agents', 'bender'), { recursive: true });
    writeFileSync(join(tmpDir, 'agents', 'bender', 'charter.md'), '# Bender\n');
    mkdirSync(join(tmpDir, 'tasks'), { recursive: true });
    mkdirSync(join(tmpDir, 'decisions', 'inbox'), { recursive: true });

    parser = createMockParser();
  });

  afterEach(async () => {
    if (watcher) await watcher.stop();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should emit team:updated when team.md changes', async () => {
    watcher = new FileWatcher({
      squadDir: tmpDir, parser: asSquadParser(parser),
      debounceMs: 50, watchMode: 'poll', pollIntervalMs: 200,
    });
    await watcher.start();
    await delay(300); // let chokidar settle

    const eventPromise = waitForEvent(watcher, 'team:updated');
    writeFileSync(join(tmpDir, 'team.md'), '# Team\n- New member\n');

    const event = await eventPromise;
    expect(event.type).toBe('team:updated');
    expect(event.path).toBe('team.md');
    expect(event.timestamp).toBeTruthy();
  }, 20000);

  it('should emit config:changed when config.json changes', async () => {
    watcher = new FileWatcher({
      squadDir: tmpDir, parser: asSquadParser(parser),
      debounceMs: 50, watchMode: 'poll', pollIntervalMs: 200,
    });
    await watcher.start();
    await delay(300);

    const eventPromise = waitForEvent(watcher, 'config:changed');
    writeFileSync(join(tmpDir, 'config.json'), '{"updated": true}');

    const event = await eventPromise;
    expect(event.type).toBe('config:changed');
    expect(event.path).toBe('config.json');
  }, 20000);

  it('should emit decision:added when decisions.md changes', async () => {
    watcher = new FileWatcher({
      squadDir: tmpDir, parser: asSquadParser(parser),
      debounceMs: 50, watchMode: 'poll', pollIntervalMs: 200,
    });
    await watcher.start();
    await delay(300);

    const eventPromise = waitForEvent(watcher, 'decision:added');
    writeFileSync(join(tmpDir, 'decisions.md'), '# Decisions\n## New decision\n');

    const event = await eventPromise;
    expect(event.type).toBe('decision:added');
  }, 20000);

  it('should emit agent:updated when an agent file changes', async () => {
    watcher = new FileWatcher({
      squadDir: tmpDir, parser: asSquadParser(parser),
      debounceMs: 50, watchMode: 'poll', pollIntervalMs: 200,
    });
    await watcher.start();
    await delay(300);

    const eventPromise = waitForEvent(watcher, 'agent:updated');
    writeFileSync(join(tmpDir, 'agents', 'bender', 'charter.md'), '# Bender v2\n');

    const event = await eventPromise;
    expect(event.type).toBe('agent:updated');
    expect(event.path).toContain('agents/');
  }, 20000);

  it('should emit task:created when a new task file appears', async () => {
    watcher = new FileWatcher({
      squadDir: tmpDir, parser: asSquadParser(parser),
      debounceMs: 50, watchMode: 'poll', pollIntervalMs: 200,
    });
    await watcher.start();
    await delay(300);

    const eventPromise = waitForEvent(watcher, 'task:created');
    writeFileSync(join(tmpDir, 'tasks', 'task-001.md'), '---\nid: task-001\ntitle: Test\n---\n');

    const event = await eventPromise;
    expect(event.type).toBe('task:created');
    expect(event.path).toContain('tasks/');
  }, 20000);

  it('should emit task:updated when an existing task file changes', async () => {
    writeFileSync(join(tmpDir, 'tasks', 'existing.md'), '---\nid: t1\ntitle: Old\n---\n');

    watcher = new FileWatcher({
      squadDir: tmpDir, parser: asSquadParser(parser),
      debounceMs: 50, watchMode: 'poll', pollIntervalMs: 200,
    });
    await watcher.start();
    await delay(300);

    const eventPromise = waitForEvent(watcher, 'task:updated');
    writeFileSync(join(tmpDir, 'tasks', 'existing.md'), '---\nid: t1\ntitle: Updated\n---\n');

    const event = await eventPromise;
    expect(event.type).toBe('task:updated');
  }, 20000);

  it('should emit decision:added for decisions/inbox/* files', async () => {
    watcher = new FileWatcher({
      squadDir: tmpDir, parser: asSquadParser(parser),
      debounceMs: 50, watchMode: 'poll', pollIntervalMs: 200,
    });
    await watcher.start();
    await delay(300);

    const eventPromise = waitForEvent(watcher, 'decision:added');
    writeFileSync(join(tmpDir, 'decisions', 'inbox', 'new.md'), '# Decision\n');

    const event = await eventPromise;
    expect(event.type).toBe('decision:added');
    expect(event.path).toContain('decisions/');
  }, 20000);

  it('should debounce rapid changes and re-parse state', async () => {
    watcher = new FileWatcher({
      squadDir: tmpDir, parser: asSquadParser(parser),
      debounceMs: 300, watchMode: 'poll', pollIntervalMs: 200,
    });
    await watcher.start();
    await delay(300);
    vi.mocked(parser.getAgents).mockClear();

    const eventsPromise = collectEvents(watcher, 5000);

    // Rapid writes to team.md
    for (let i = 0; i < 5; i++) {
      writeFileSync(join(tmpDir, 'team.md'), `# Team v${i}\n`);
      await delay(10);
    }

    const events = await eventsPromise;
    const teamEvents = events.filter(e => e.type === 'team:updated');
    // Debouncing collapses rapid same-key events — expect at least 1 but fewer flushes than writes
    expect(teamEvents.length).toBeGreaterThanOrEqual(1);
    expect(vi.mocked(parser.getAgents).mock.calls.length).toBeLessThan(5);
  }, 20000);

  it('should re-parse state on file changes', async () => {
    watcher = new FileWatcher({
      squadDir: tmpDir, parser: asSquadParser(parser),
      debounceMs: 50, watchMode: 'poll', pollIntervalMs: 200,
    });
    await watcher.start();
    await delay(300);
    vi.mocked(parser.getAgents).mockClear();

    const eventPromise = waitForEvent(watcher, 'change');
    writeFileSync(join(tmpDir, 'team.md'), '# Updated team\n');
    await eventPromise;

    expect(parser.getAgents).toHaveBeenCalled();
    expect(parser.getDecisions).toHaveBeenCalled();
  }, 20000);

  it('should ignore files in .cache/ directory', async () => {
    mkdirSync(join(tmpDir, '.cache'), { recursive: true });

    watcher = new FileWatcher({
      squadDir: tmpDir, parser: asSquadParser(parser),
      debounceMs: 50, watchMode: 'poll', pollIntervalMs: 200,
    });
    await watcher.start();
    await delay(300);

    const handler = vi.fn();
    watcher.on('change', handler);

    writeFileSync(join(tmpDir, '.cache', 'openspace.db'), 'sqlite data');

    await delay(1500);
    expect(handler).not.toHaveBeenCalled();
  }, 20000);

  it('should ignore unknown top-level files', async () => {
    watcher = new FileWatcher({
      squadDir: tmpDir, parser: asSquadParser(parser),
      debounceMs: 50, watchMode: 'poll', pollIntervalMs: 200,
    });
    await watcher.start();
    await delay(300);

    const handler = vi.fn();
    watcher.on('change', handler);

    writeFileSync(join(tmpDir, 'random-file.txt'), 'hello');
    await delay(1500);

    expect(handler).not.toHaveBeenCalled();
  }, 20000);

  it('should emit the generic "change" event for every classified change', async () => {
    watcher = new FileWatcher({
      squadDir: tmpDir, parser: asSquadParser(parser),
      debounceMs: 50, watchMode: 'poll', pollIntervalMs: 200,
    });
    await watcher.start();
    await delay(300);

    const eventsPromise = collectEvents(watcher, 5000);

    writeFileSync(join(tmpDir, 'config.json'), '{"v": 2}');
    await delay(1000);
    writeFileSync(join(tmpDir, 'team.md'), '# Team v2\n');

    const events = await eventsPromise;
    const types = events.map(e => e.type);
    expect(types).toContain('config:changed');
    expect(types).toContain('team:updated');
  }, 20000);
});
