/**
 * Terminal PTY WebSocket route.
 *
 * Provides a WebSocket endpoint at /api/terminal/ws that spawns a PTY process
 * and bridges it to the client over WebSocket messages.
 *
 * Client → Server messages:
 *   { type: "input",  data: string }          — write to PTY stdin
 *   { type: "resize", cols: number, rows: number } — resize PTY
 *
 * Server → Client messages:
 *   { type: "output", data: string }           — PTY stdout data
 *   { type: "error",  code: string, reason: string } — PTY error with actionable guidance
 */

import type { FastifyPluginAsync } from 'fastify';
import { WebSocket } from 'ws';

// ── PTY error codes ──────────────────────────────────────────────

export type PtyErrorCode = 'PTY_NOT_INSTALLED' | 'PTY_UNAVAILABLE' | 'PTY_SPAWN_FAILED';

export interface PtyError {
  code: PtyErrorCode;
  reason: string;
}

/**
 * Classify a PTY-related error into a specific error code with actionable guidance.
 */
export function classifyPtyError(err: unknown): PtyError {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  // Module not found / not built — node-pty isn't installed or native addon missing
  if (
    lower.includes('cannot find module') ||
    lower.includes('module_not_found') ||
    lower.includes('could not locate the bindings file') ||
    lower.includes('was compiled against a different node.js version') ||
    lower.includes('node_modules/node-pty')
  ) {
    return {
      code: 'PTY_NOT_INSTALLED',
      reason:
        'node-pty native module is not installed or not built for this platform. ' +
        'Run `pnpm rebuild node-pty` to compile native modules.',
    };
  }

  // Platform / OS-level PTY unavailability
  if (
    lower.includes('pty is not supported') ||
    lower.includes('not supported on this platform') ||
    lower.includes('openpty') ||
    lower.includes('forkpty') ||
    lower.includes('winpty') ||
    lower.includes('conpty')
  ) {
    return {
      code: 'PTY_UNAVAILABLE',
      reason:
        'This platform does not support pseudo-terminal (PTY) allocation. ' +
        'Terminal features require a POSIX-compatible OS or Windows with ConPTY support.',
    };
  }

  // Permission denied
  if (lower.includes('eacces') || lower.includes('permission denied')) {
    return {
      code: 'PTY_SPAWN_FAILED',
      reason:
        `Permission denied when spawning shell process. ` +
        `Ensure the shell binary is executable and the current user has PTY allocation rights.`,
    };
  }

  // Shell not found
  if (lower.includes('enoent') || lower.includes('no such file')) {
    const shell = process.env.SHELL || 'bash';
    return {
      code: 'PTY_SPAWN_FAILED',
      reason:
        `Shell "${shell}" was not found. ` +
        `Set the SHELL environment variable to a valid shell path (e.g., /bin/bash, /bin/zsh).`,
    };
  }

  // Generic spawn failure
  return {
    code: 'PTY_SPAWN_FAILED',
    reason: `PTY spawn failed: ${message}`,
  };
}

// ── Lazy PTY module loader ───────────────────────────────────────

type PtyModule = typeof import('node-pty');

let _ptyModule: PtyModule | null = null;
let _ptyLoadError: PtyError | null = null;
let _ptyChecked = false;

/**
 * Lazily load node-pty, caching the result. Returns the module or a classified error.
 */
export function loadPty(): { pty: PtyModule } | { error: PtyError } {
  if (_ptyChecked) {
    return _ptyModule ? { pty: _ptyModule } : { error: _ptyLoadError! };
  }
  _ptyChecked = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _ptyModule = require('node-pty') as PtyModule;
    return { pty: _ptyModule };
  } catch (err) {
    _ptyLoadError = classifyPtyError(err);
    return { error: _ptyLoadError };
  }
}

/** Reset cached state — only for testing. */
export function _resetPtyCache(): void {
  _ptyModule = null;
  _ptyLoadError = null;
  _ptyChecked = false;
}

// ── Message types ────────────────────────────────────────────────

interface InputMessage {
  type: 'input';
  data: string;
}

interface ResizeMessage {
  type: 'resize';
  cols: number;
  rows: number;
}

type ClientMessage = InputMessage | ResizeMessage;

function isValidMessage(msg: unknown): msg is ClientMessage {
  if (typeof msg !== 'object' || msg === null) return false;
  const obj = msg as Record<string, unknown>;
  if (obj.type === 'input') {
    return typeof obj.data === 'string';
  }
  if (obj.type === 'resize') {
    return typeof obj.cols === 'number' && typeof obj.rows === 'number';
  }
  return false;
}

// ── Route ────────────────────────────────────────────────────────

const terminalRoute: FastifyPluginAsync = async (app) => {
  // ── Health-check endpoint ────────────────────────────────────
  app.get('/terminal/health', async (_request, reply) => {
    const result = loadPty();
    if ('error' in result) {
      return reply.status(503).send({
        status: 'unavailable',
        code: result.error.code,
        reason: result.error.reason,
      });
    }
    return reply.status(200).send({ status: 'ok' });
  });

  // ── WebSocket terminal endpoint ──────────────────────────────
  app.get('/terminal/ws', { websocket: true }, (socket, _request) => {
    const ptyResult = loadPty();
    if ('error' in ptyResult) {
      app.log.warn(`PTY unavailable: [${ptyResult.error.code}] ${ptyResult.error.reason}`);
      socket.send(JSON.stringify({
        type: 'error',
        code: ptyResult.error.code,
        reason: ptyResult.error.reason,
      }));
      socket.close();
      return;
    }

    const pty = ptyResult.pty;
    const shell = process.env.SHELL || 'bash';
    let term;
    try {
      term = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: process.cwd(),
        env: process.env as Record<string, string>,
      });
    } catch (err) {
      const classified = classifyPtyError(err);
      app.log.warn(`PTY spawn failed: [${classified.code}] ${classified.reason}`);
      socket.send(JSON.stringify({
        type: 'error',
        code: classified.code,
        reason: classified.reason,
      }));
      socket.close();
      return;
    }

    let ptyAlive = true;
    let forceKillTimer: ReturnType<typeof setTimeout> | null = null;

    app.log.info({ pid: term.pid }, 'PTY spawned');

    // PTY stdout → WebSocket
    term.onData((data: string) => {
      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(JSON.stringify({ type: 'output', data }));
        } catch (err) {
          app.log.debug({ pid: term.pid }, 'PTY data send failed (socket closing)');
        }
      }
    });

    term.onExit(({ exitCode, signal }) => {
      ptyAlive = false;
      if (forceKillTimer) {
        clearTimeout(forceKillTimer);
        forceKillTimer = null;
      }
      app.log.info({ pid: term.pid, exitCode, signal }, 'PTY exited');
      if (socket.readyState === WebSocket.OPEN) {
        socket.close(1000, 'PTY process exited');
      }
    });

    // WebSocket → PTY
    socket.on('message', (raw: Buffer | string) => {
      if (!ptyAlive) return;

      let msg: unknown;
      try {
        msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf-8'));
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'unknown error';
        socket.send(JSON.stringify({ type: 'error', code: 'INVALID_JSON', message: `Message parse failed: ${detail}` }));
        return;
      }

      if (!isValidMessage(msg)) {
        socket.send(JSON.stringify({ type: 'error', code: 'INVALID_MESSAGE', message: 'Message must be { type: "input", data: string } or { type: "resize", cols: number, rows: number }' }));
        return;
      }

      try {
        if (msg.type === 'input') {
          term.write(msg.data);
        } else if (msg.type === 'resize') {
          term.resize(Math.max(1, msg.cols), Math.max(1, msg.rows));
        }
      } catch (err) {
        ptyAlive = false;
        const detail = err instanceof Error ? err.message : String(err);
        app.log.warn({ pid: term.pid, err: detail }, 'PTY write/resize failed — process likely dead');
      }
    });

    socket.on('error', (err) => {
      app.log.warn({ pid: term.pid, err: err.message }, 'WebSocket error');
    });

    // Cleanup on WebSocket close
    socket.on('close', () => {
      app.log.info({ pid: term.pid }, 'WebSocket closed, killing PTY');
      if (!ptyAlive) return;
      ptyAlive = false;
      try {
        term.kill();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        app.log.warn({ pid: term.pid, err: msg }, 'PTY kill failed');
      }
      // Force-kill after 2s if process hasn't exited (prevents zombies)
      const pid = term.pid;
      forceKillTimer = setTimeout(() => {
        try {
          process.kill(pid, 0); // check if still alive
          app.log.warn({ pid }, 'PTY still alive after 2s, sending SIGKILL');
          process.kill(pid, 'SIGKILL');
        } catch (err: unknown) {
          const code = (err as NodeJS.ErrnoException).code;
          if (code === 'ESRCH') {
            // process already gone — expected, nothing to do
          } else {
            app.log.error({ pid, err: (err as Error).message, code }, 'Force-kill failed — possible zombie PTY');
          }
        }
      }, 2000);
      forceKillTimer.unref(); // don't block Node shutdown
    });
  });
};

export default terminalRoute;
