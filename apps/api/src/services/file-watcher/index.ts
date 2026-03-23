/**
 * FileWatcher — Watches the `.squad/` directory for changes and emits typed events.
 *
 * Uses chokidar for native FS watching with an optional polling fallback
 * controlled by the `WATCH_MODE` env var (`poll` | `native`).
 *
 * Events emitted:
 *   agent:updated   — An agent charter or history file changed
 *   task:created    — A new task file appeared in tasks/
 *   task:updated    — An existing task file changed
 *   decision:added  — decisions.md or a decision inbox file changed
 *   config:changed  — config.json changed
 *   team:updated    — team.md changed
 *
 * Debounces rapid changes (100ms by default) so downstream consumers get
 * one consolidated event per batch of edits.
 */

import { EventEmitter } from 'node:events';
import { relative, sep } from 'node:path';

import type { FSWatcher } from 'chokidar';

import type { SquadParser } from '../squad-parser/index.js';

// ── Event types ────────────────────────────────────────────────────

export type FileWatcherEventType =
  | 'agent:updated'
  | 'task:created'
  | 'task:updated'
  | 'decision:added'
  | 'config:changed'
  | 'team:updated';

export interface FileWatcherEvent {
  type: FileWatcherEventType;
  /** Relative path within .squad/ that triggered the event. */
  path: string;
  /** Timestamp of the event. */
  timestamp: string;
}

// ── Cache types ────────────────────────────────────────────────────

export interface SquadState {
  agents: Awaited<ReturnType<SquadParser['getAgents']>>;
  decisions: Awaited<ReturnType<SquadParser['getDecisions']>>;
  config: Awaited<ReturnType<SquadParser['getConfig']>>;
  overview: Awaited<ReturnType<SquadParser['getSquadOverview']>>;
}

// ── Options ────────────────────────────────────────────────────────

export interface FileWatcherOptions {
  /** Absolute path to the .squad/ directory. */
  squadDir: string;
  /** SquadParser instance to re-parse on changes. */
  parser: SquadParser;
  /** Debounce interval in milliseconds. Defaults to 100. */
  debounceMs?: number;
  /** Watch mode: 'native' (default) or 'poll'. Overridden by WATCH_MODE env. */
  watchMode?: 'native' | 'poll';
  /** Polling interval in ms when using poll mode. Defaults to 500. */
  pollIntervalMs?: number;
}

// ── FileWatcher class ──────────────────────────────────────────────

export class FileWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private readonly squadDir: string;
  private readonly parser: SquadParser;
  private readonly debounceMs: number;
  private readonly usePolling: boolean;
  private readonly pollInterval: number;
  private state: SquadState | null = null;

  /** Pending debounced events keyed by event type + path. */
  private pendingEvents = new Map<string, FileWatcherEvent>();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: FileWatcherOptions) {
    super();
    this.squadDir = opts.squadDir;
    this.parser = opts.parser;
    this.debounceMs = opts.debounceMs ?? 100;
    const envMode = process.env.WATCH_MODE;
    this.usePolling =
      (envMode === 'poll') ||
      (opts.watchMode === 'poll' && envMode !== 'native');
    this.pollInterval = opts.pollIntervalMs ?? 500;
  }

  /** Current cached squad state (populated after start()). */
  getState(): SquadState | null {
    return this.state;
  }

  /** Start watching. Performs an initial full parse to populate cache. */
  async start(): Promise<void> {
    await this.refreshState();

    // Lazy-import chokidar so tests can mock the FS layer.
    const { watch } = await import('chokidar');

    this.watcher = watch(this.squadDir, {
      ignoreInitial: true,
      usePolling: this.usePolling,
      interval: this.usePolling ? this.pollInterval : undefined,
      // Ignore hidden cache directory and node_modules
      ignored: [
        /(^|[\\/])\.cache([\\/]|$)/,
        /(^|[\\/])node_modules([\\/]|$)/,
      ],
      awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 25 },
    });

    this.watcher.on('add', (filePath: string) => this.handleChange(filePath, 'add'));
    this.watcher.on('change', (filePath: string) => this.handleChange(filePath, 'change'));
    this.watcher.on('unlink', (filePath: string) => this.handleChange(filePath, 'unlink'));
    this.watcher.on('error', (err: unknown) => this.emit('error', err));
  }

  /** Stop watching and clean up. */
  async stop(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }

  /** Force a full re-parse (useful for tests or recovery). */
  async refreshState(): Promise<SquadState> {
    const [agents, decisions, config, overview] = await Promise.all([
      this.parser.getAgents(),
      this.parser.getDecisions(),
      this.parser.getConfig(),
      this.parser.getSquadOverview(),
    ]);
    this.state = { agents, decisions, config, overview };
    return this.state;
  }

  // ── Private ────────────────────────────────────────────────────

  private handleChange(filePath: string, changeType: 'add' | 'change' | 'unlink'): void {
    const rel = relative(this.squadDir, filePath).split(sep).join('/');
    const event = this.classifyChange(rel, changeType);
    if (!event) return;

    // Dedupe by type + path within the debounce window
    const key = `${event.type}:${event.path}`;
    this.pendingEvents.set(key, event);

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.flushEvents(), this.debounceMs);
  }

  private async flushEvents(): Promise<void> {
    const events = [...this.pendingEvents.values()];
    this.pendingEvents.clear();
    this.debounceTimer = null;

    // Re-parse affected state
    try {
      await this.refreshState();
    } catch {
      // Best-effort: still emit events even if parse fails
    }

    for (const event of events) {
      this.emit(event.type, event);
      this.emit('change', event);
    }
  }

  /**
   * Classify a file path into its event type based on location in .squad/.
   */
  private classifyChange(
    relPath: string,
    changeType: 'add' | 'change' | 'unlink',
  ): FileWatcherEvent | null {
    const now = new Date().toISOString();

    // team.md
    if (relPath === 'team.md') {
      return { type: 'team:updated', path: relPath, timestamp: now };
    }

    // config.json
    if (relPath === 'config.json') {
      return { type: 'config:changed', path: relPath, timestamp: now };
    }

    // decisions.md or decisions/inbox/*
    if (relPath === 'decisions.md' || relPath.startsWith('decisions/')) {
      return { type: 'decision:added', path: relPath, timestamp: now };
    }

    // agents/* (charter.md, history.md)
    if (relPath.startsWith('agents/')) {
      return { type: 'agent:updated', path: relPath, timestamp: now };
    }

    // tasks/*
    if (relPath.startsWith('tasks/')) {
      const type: FileWatcherEventType = changeType === 'add' ? 'task:created' : 'task:updated';
      return { type, path: relPath, timestamp: now };
    }

    // Unknown file — ignore
    return null;
  }
}
