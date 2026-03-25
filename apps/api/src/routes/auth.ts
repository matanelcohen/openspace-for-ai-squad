/**
 * Auth API — JWT authentication endpoints
 *
 * POST   /api/auth/login     — authenticate and receive tokens
 * POST   /api/auth/logout    — revoke refresh token
 * POST   /api/auth/refresh   — exchange refresh token for new token pair
 * POST   /api/auth/register  — create a new user account
 */

import type { FastifyPluginAsync } from 'fastify';

import { ErrorCodes, sendError } from '../lib/api-errors.js';
import type { AuthService } from '../services/auth/index.js';
import { AuthError } from '../services/auth/index.js';

const authRoute: FastifyPluginAsync = async (app) => {
  const authService = app.authService;

  // POST /api/auth/register
  app.post<{
    Body: { email: string; password: string; name: string; role?: string };
  }>('/auth/register', async (request, reply) => {
    const { email, password, name, role } = request.body ?? {};

    if (!email || !password || !name) {
      return sendError(
        reply,
        400,
        ErrorCodes.VALIDATION_ERROR,
        'email, password, and name are required',
      );
    }

    try {
      const user = await authService.registerUser({ email, password, name, role });
      return reply.status(201).send({ user });
    } catch (err) {
      if (err instanceof AuthError && err.code === 'EMAIL_TAKEN') {
        return sendError(reply, 409, ErrorCodes.CONFLICT, err.message);
      }
      throw err;
    }
  });

  // POST /api/auth/login
  app.post<{
    Body: { email: string; password: string };
  }>('/auth/login', async (request, reply) => {
    const { email, password } = request.body ?? {};

    if (!email || !password) {
      return sendError(reply, 400, ErrorCodes.VALIDATION_ERROR, 'email and password are required');
    }

    try {
      const result = await authService.login(email, password);
      return reply.send(result);
    } catch (err) {
      if (err instanceof AuthError && err.code === 'INVALID_CREDENTIALS') {
        return sendError(reply, 401, 'UNAUTHORIZED', err.message);
      }
      throw err;
    }
  });

  // POST /api/auth/logout
  app.post<{
    Body: { refreshToken: string };
  }>('/auth/logout', async (request, reply) => {
    const { refreshToken } = request.body ?? {};

    if (!refreshToken) {
      return sendError(reply, 400, ErrorCodes.VALIDATION_ERROR, 'refreshToken is required');
    }

    authService.logout(refreshToken);
    return reply.status(204).send();
  });

  // POST /api/auth/refresh
  app.post<{
    Body: { refreshToken: string };
  }>('/auth/refresh', async (request, reply) => {
    const { refreshToken } = request.body ?? {};

    if (!refreshToken) {
      return sendError(reply, 400, ErrorCodes.VALIDATION_ERROR, 'refreshToken is required');
    }

    try {
      const result = await authService.refresh(refreshToken);
      return reply.send(result);
    } catch (err) {
      if (err instanceof AuthError) {
        const status = err.code === 'TOKEN_EXPIRED' || err.code === 'TOKEN_REVOKED' ? 401 : 401;
        return sendError(reply, status, 'UNAUTHORIZED', err.message);
      }
      throw err;
    }
  });
};

export default authRoute;

// ── Fastify type augmentation ────────────────────────────────────

declare module 'fastify' {
  interface FastifyInstance {
    authService: AuthService;
  }
}
