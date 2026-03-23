import type { FastifyReply } from 'fastify';

export interface ApiErrorResponse {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}

export const ErrorCodes = {
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  CONFLICT: 'CONFLICT',
} as const;

export function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): void {
  reply.status(statusCode).send({
    error: message,
    code,
    ...(details ? { details } : {}),
  });
}
