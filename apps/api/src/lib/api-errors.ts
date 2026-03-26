import type { FastifyReply } from 'fastify';

export interface ApiErrorResponse {
  error: string;
  code: string;
  statusCode: number;
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
  const body: ApiErrorResponse = {
    error: message,
    code,
    statusCode,
    ...(details ? { details } : {}),
  };
  reply.status(statusCode).send(body);
}
