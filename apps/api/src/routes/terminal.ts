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
 */

import type { FastifyPluginAsync } from 'fastify';
import * as pty from 'node-pty';
import { WebSocket } from 'ws';

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

const terminalRoute: FastifyPluginAsync = async (app) => {
  app.get('/terminal/ws', { websocket: true }, (socket, _request) => {
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
      const msg = err instanceof Error ? err.message : String(err);
      app.log.warn(`PTY spawn failed: ${msg} — terminal feature unavailable`);
      socket.send(JSON.stringify({ type: 'error', data: `Terminal unavailable: ${msg}\r\n` }));
      socket.close();
      return;
    }

    let ptyAlive = true;

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

      if (msg.type === 'input') {
        term.write(msg.data);
      } else if (msg.type === 'resize') {
        term.resize(Math.max(1, msg.cols), Math.max(1, msg.rows));
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
      const forceKillTimer = setTimeout(() => {
        try {
          process.kill(pid, 0); // check if still alive
          app.log.warn({ pid }, 'PTY still alive after 2s, sending SIGKILL');
          process.kill(pid, 'SIGKILL');
        } catch {
          // process already gone — expected
        }
      }, 2000);
      forceKillTimer.unref(); // don't block Node shutdown
    });
  });
};

export default terminalRoute;
