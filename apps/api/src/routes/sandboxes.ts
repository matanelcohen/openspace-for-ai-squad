/**
 * Sandboxes API
 *
 * POST   /api/sandboxes              — Create a sandbox container
 * GET    /api/sandboxes              — List all sandboxes (supports ?status=, ?runtime=)
 * GET    /api/sandboxes/:id          — Get sandbox status
 * POST   /api/sandboxes/:id/exec     — Execute command in sandbox
 * POST   /api/sandboxes/:id/stop     — Stop a running sandbox
 * POST   /api/sandboxes/:id/restart  — Restart a stopped sandbox
 * GET    /api/sandboxes/:id/files/*  — Retrieve file from sandbox (tar)
 * DELETE /api/sandboxes/:id          — Destroy sandbox
 * GET    /api/sandboxes/:id/stream   — WebSocket: real-time stdout/stderr
 */

import type { FastifyPluginAsync } from 'fastify';

import { ErrorCodes, sendError } from '../lib/api-errors.js';
import {
  type ExecRequest,
  SANDBOX_RUNTIMES,
  SandboxNotFoundError,
  SandboxNotStoppedError,
  type SandboxRuntime,
  SandboxStoppedError,
  type StreamChunk,
  type StreamEnd,
} from '../services/sandbox/index.js';

function isValidRuntime(v: unknown): v is SandboxRuntime {
  return typeof v === 'string' && (SANDBOX_RUNTIMES as readonly string[]).includes(v);
}

// ── Route plugin ──────────────────────────────────────────────────

const sandboxesRoute: FastifyPluginAsync = async (app) => {
  // POST /api/sandboxes — create sandbox
  app.post<{
    Body: {
      runtime: string;
      limits?: { cpuShares?: number; memoryBytes?: number; timeoutMs?: number };
      env?: Record<string, string>;
    };
  }>('/sandboxes', async (request, reply) => {
    const { runtime, limits, env } = request.body ?? {};

    if (!isValidRuntime(runtime)) {
      return sendError(
        reply,
        400,
        ErrorCodes.VALIDATION_ERROR,
        `Invalid runtime: ${runtime}. Must be one of: ${SANDBOX_RUNTIMES.join(', ')}`,
      );
    }

    try {
      const info = await app.sandboxService.create({ runtime, limits, env });
      return reply.status(201).send(info);
    } catch (err) {
      const error = err as Error & { code?: string };
      if (error.code === 'POOL_CAPACITY_EXCEEDED') {
        return sendError(reply, 429, error.code, error.message);
      }
      request.log.error(err, 'Failed to create sandbox');
      return sendError(reply, 500, ErrorCodes.INTERNAL_ERROR, 'Failed to create sandbox');
    }
  });

  // GET /api/sandboxes — list all (supports ?status= and ?runtime= filters)
  app.get<{ Querystring: { status?: string; runtime?: string } }>(
    '/sandboxes',
    async (request, reply) => {
      const { status, runtime } = request.query;
      const filters =
        status || runtime ? { status: status || undefined, runtime: runtime || undefined } : undefined;
      const sandboxes = app.sandboxService.list(filters);
      return reply.send(sandboxes);
    },
  );

  // GET /api/sandboxes/:id — status
  app.get<{ Params: { id: string } }>('/sandboxes/:id', async (request, reply) => {
    const info = app.sandboxService.get(request.params.id);
    if (!info) {
      return sendError(reply, 404, ErrorCodes.NOT_FOUND, `Sandbox not found: ${request.params.id}`);
    }
    return reply.send(info);
  });

  // POST /api/sandboxes/:id/exec — execute command
  app.post<{
    Params: { id: string };
    Body: ExecRequest;
  }>('/sandboxes/:id/exec', async (request, reply) => {
    const { command, workdir, env, timeoutMs } = request.body ?? {};

    if (!command || typeof command !== 'string') {
      return sendError(
        reply,
        400,
        ErrorCodes.VALIDATION_ERROR,
        'Field "command" is required and must be a non-empty string',
      );
    }

    try {
      const result = await app.sandboxService.exec(request.params.id, {
        command,
        workdir,
        env,
        timeoutMs,
      });
      return reply.send(result);
    } catch (err) {
      if (err instanceof SandboxNotFoundError) {
        return sendError(reply, 404, ErrorCodes.NOT_FOUND, err.message);
      }
      const error = err as Error & { code?: string };
      if (error.code === 'SANDBOX_DESTROYED') {
        return sendError(reply, 410, error.code, error.message);
      }
      request.log.error(err, 'Failed to execute command');
      return sendError(reply, 500, ErrorCodes.INTERNAL_ERROR, 'Failed to execute command');
    }
  });

  // GET /api/sandboxes/:id/files/* — retrieve file as tar
  app.get<{ Params: { id: string; '*': string } }>(
    '/sandboxes/:id/files/*',
    async (request, reply) => {
      const filePath = request.params['*'];
      if (!filePath) {
        return sendError(
          reply,
          400,
          ErrorCodes.VALIDATION_ERROR,
          'File path is required after /files/',
        );
      }

      const containerPath = filePath.startsWith('/') ? filePath : `/workspace/${filePath}`;

      try {
        const tarBuffer = await app.sandboxService.copyFrom(request.params.id, containerPath);
        return reply.type('application/x-tar').send(tarBuffer);
      } catch (err) {
        if (err instanceof SandboxNotFoundError) {
          return sendError(reply, 404, ErrorCodes.NOT_FOUND, err.message);
        }
        request.log.error(err, 'Failed to copy file from sandbox');
        return sendError(reply, 500, ErrorCodes.INTERNAL_ERROR, 'Failed to retrieve file');
      }
    },
  );

  // POST /api/sandboxes/:id/stop — stop a running sandbox
  app.post<{ Params: { id: string } }>('/sandboxes/:id/stop', async (request, reply) => {
    try {
      await app.sandboxService.stop(request.params.id);
      const info = app.sandboxService.get(request.params.id);
      return reply.send(info);
    } catch (err) {
      if (err instanceof SandboxNotFoundError) {
        return sendError(reply, 404, ErrorCodes.NOT_FOUND, err.message);
      }
      if (err instanceof SandboxStoppedError) {
        return sendError(reply, 409, err.code, err.message);
      }
      request.log.error(err, 'Failed to stop sandbox');
      return sendError(reply, 500, ErrorCodes.INTERNAL_ERROR, 'Failed to stop sandbox');
    }
  });

  // POST /api/sandboxes/:id/restart — restart a stopped sandbox
  app.post<{ Params: { id: string } }>('/sandboxes/:id/restart', async (request, reply) => {
    try {
      await app.sandboxService.restart(request.params.id);
      const info = app.sandboxService.get(request.params.id);
      return reply.send(info);
    } catch (err) {
      if (err instanceof SandboxNotFoundError) {
        return sendError(reply, 404, ErrorCodes.NOT_FOUND, err.message);
      }
      if (err instanceof SandboxNotStoppedError) {
        return sendError(reply, 409, err.code, err.message);
      }
      request.log.error(err, 'Failed to restart sandbox');
      return sendError(reply, 500, ErrorCodes.INTERNAL_ERROR, 'Failed to restart sandbox');
    }
  });

  // DELETE /api/sandboxes/:id — destroy
  app.delete<{ Params: { id: string } }>('/sandboxes/:id', async (request, reply) => {
    const info = app.sandboxService.get(request.params.id);
    if (!info) {
      return sendError(reply, 404, ErrorCodes.NOT_FOUND, `Sandbox not found: ${request.params.id}`);
    }

    await app.sandboxService.destroy(request.params.id);
    return reply.status(204).send();
  });

  // GET /api/sandboxes/:id/stream — WebSocket for real-time exec output
  app.get<{ Params: { id: string } }>(
    '/sandboxes/:id/stream',
    { websocket: true },
    (socket, request) => {
      const sandboxId = request.params.id;
      const info = app.sandboxService.get(sandboxId);

      if (!info) {
        socket.send(
          JSON.stringify({
            type: 'error',
            code: 'SANDBOX_NOT_FOUND',
            message: `Sandbox not found: ${sandboxId}`,
          }),
        );
        socket.close(4004, 'Sandbox not found');
        return;
      }

      // Stream exec output to this WebSocket
      const onData = (chunk: StreamChunk) => {
        if (socket.readyState === 1 /* OPEN */) {
          try {
            socket.send(JSON.stringify({ type: 'stream:data', ...chunk }));
          } catch {
            // best-effort
          }
        }
      };

      const onEnd = (end: StreamEnd) => {
        if (socket.readyState === 1 /* OPEN */) {
          try {
            socket.send(JSON.stringify({ type: 'stream:end', ...end }));
          } catch {
            // best-effort
          }
        }
      };

      app.sandboxService.onStreamData(onData);
      app.sandboxService.onStreamEnd(onEnd);

      // Handle client messages (e.g., exec requests over WebSocket)
      socket.on('message', async (raw: Buffer | string) => {
        let msg: { action: string } & ExecRequest;
        try {
          msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf-8')) as {
            action: string;
          } & ExecRequest;
        } catch (err) {
          const detail = err instanceof Error ? err.message : 'unknown error';
          socket.send(
            JSON.stringify({
              type: 'error',
              code: 'INVALID_JSON',
              message: `Message parse failed: ${detail}`,
            }),
          );
          return;
        }

        if (msg.action === 'exec') {
          if (!msg.command || typeof msg.command !== 'string') {
            socket.send(
              JSON.stringify({
                type: 'error',
                code: 'VALIDATION_ERROR',
                message: 'Field "command" is required and must be a non-empty string',
              }),
            );
            return;
          }

          try {
            const result = await app.sandboxService.exec(sandboxId, {
              command: msg.command,
              workdir: msg.workdir,
              env: msg.env,
              timeoutMs: msg.timeoutMs,
            });
            socket.send(JSON.stringify({ type: 'exec:result', ...result }));
          } catch (err) {
            const error = err as Error & { code?: string };
            socket.send(
              JSON.stringify({
                type: 'error',
                code: error.code ?? 'EXEC_FAILED',
                message: error.message,
              }),
            );
          }
        } else {
          socket.send(
            JSON.stringify({
              type: 'error',
              code: 'UNKNOWN_ACTION',
              message: `Unknown action: ${msg.action ?? '<missing>'}`,
            }),
          );
        }
      });

      // Cleanup on close
      socket.on('close', () => {
        app.sandboxService.offStreamData(onData);
        app.sandboxService.offStreamEnd(onEnd);
      });
    },
  );
};

export default sandboxesRoute;
