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

import * as pty from 'node-pty';
import type { FastifyPluginAsync } from 'fastify';

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

    app.log.info({ pid: term.pid }, 'PTY spawned');

    // PTY stdout → WebSocket
    term.onData((data: string) => {
      if (socket.readyState === 1 /* WebSocket.OPEN */) {
        socket.send(JSON.stringify({ type: 'output', data }));
      }
    });

    term.onExit(({ exitCode, signal }) => {
      app.log.info({ exitCode, signal }, 'PTY exited');
      if (socket.readyState === 1) {
        socket.close(1000, 'PTY process exited');
      }
    });

    // WebSocket → PTY
    socket.on('message', (raw: Buffer | string) => {
      let msg: unknown;
      try {
        msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf-8'));
      } catch {
        return; // ignore malformed messages
      }

      if (!isValidMessage(msg)) return;

      if (msg.type === 'input') {
        term.write(msg.data);
      } else if (msg.type === 'resize') {
        term.resize(Math.max(1, msg.cols), Math.max(1, msg.rows));
      }
    });

    // Cleanup on WebSocket close
    socket.on('close', () => {
      app.log.info({ pid: term.pid }, 'WebSocket closed, killing PTY');
      try {
        term.kill();
      } catch {
        // already dead
      }
    });
  });
};

export default terminalRoute;
