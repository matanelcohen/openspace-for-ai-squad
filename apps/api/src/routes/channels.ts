/**
 * Channels API — CRUD endpoints
 *
 * GET    /api/channels          — list all channels
 * GET    /api/channels/:id      — get a single channel
 * POST   /api/channels          — create a channel
 * PUT    /api/channels/:id      — update a channel (full replace)
 * PATCH  /api/channels/:id      — update a channel (partial)
 * DELETE /api/channels/:id      — delete a channel
 *
 * Request validation is handled by Fastify JSON-Schema (via Typebox).
 * See channels.schemas.ts for the schema definitions.
 *
 * TODO: Auth/Authz — Channel endpoints are currently unauthenticated.
 *       Wire up JWT verification (preHandler hook) once the auth middleware
 *       is extracted from the auth routes into a shared Fastify plugin.
 *       See routes/auth.ts for the existing auth service.
 */

import Ajv from 'ajv';
import type { FastifyError, FastifyPluginAsync } from 'fastify';

import { ErrorCodes, sendError } from '../lib/api-errors.js';
import { ChannelValidationError } from '../services/chat/index.js';
import {
  type CreateChannelBody,
  createChannelSchema,
  type DeleteChannelParams,
  deleteChannelSchema,
  type GetChannelParams,
  getChannelSchema,
  type ListChannelsQuery,
  listChannelsSchema,
  type UpdateChannelBody,
  type UpdateChannelParams,
  updateChannelSchema,
} from './channels.schemas.js';

/** Map ChannelValidationError codes to HTTP status + error code. */
function mapValidationError(err: ChannelValidationError): { status: number; code: string } {
  if (err.code === 'DUPLICATE_NAME') {
    return { status: 409, code: ErrorCodes.CONFLICT };
  }
  return { status: 400, code: ErrorCodes.VALIDATION_ERROR };
}

/** Strict Ajv instance — no type coercion, no silent property removal (for body/params). */
const strictAjv = new Ajv({
  coerceTypes: false,
  removeAdditional: false,
  allErrors: true,
});

/** Lenient Ajv — coerces query-string values (always strings from HTTP) to declared types. */
const queryAjv = new Ajv({
  coerceTypes: true,
  removeAdditional: false,
  allErrors: true,
});

const channelsRoute: FastifyPluginAsync = async (app) => {
  // Strict validation for body/params; coerce query-string values (always strings from HTTP)
  app.setValidatorCompiler(({ schema, httpPart }) => {
    const compiler = httpPart === 'querystring' ? queryAjv : strictAjv;
    return compiler.compile(schema);
  });

  // Consistent error shape for all channel errors
  app.setErrorHandler((error: FastifyError, request, reply) => {
    // Schema validation errors → 400
    if (error.validation) {
      const firstError = error.validation[0];
      const field = firstError?.instancePath?.replace(/^\//, '') || firstError?.params?.missingProperty || 'unknown';
      return sendError(reply, 400, ErrorCodes.VALIDATION_ERROR, error.message, { field });
    }

    // ChannelValidationError from service layer
    if (error instanceof ChannelValidationError) {
      const mapped = mapValidationError(error);
      return sendError(reply, mapped.status, mapped.code, error.message);
    }

    // Unexpected errors → 500
    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) {
      request.log.error(error, 'Unexpected channel error');
    }
    const code = statusCode >= 500 ? ErrorCodes.INTERNAL_ERROR : ErrorCodes.VALIDATION_ERROR;
    return sendError(reply, statusCode, code, error.message || 'Internal Server Error');
  });

  // GET /api/channels — list all custom channels
  // TODO: Move pagination to ChatService.listChannels({ limit, offset }) for DB-level efficiency.
  //       Currently applied in-memory since channel counts are small.
  // TODO: Return a paginated envelope { data, total, limit, offset } instead of a bare array
  //       so clients can build pagination UIs. Requires updating web consumers first.
  app.get<{ Querystring: ListChannelsQuery }>(
    '/channels',
    { schema: listChannelsSchema },
    async (request, reply) => {
      const all = app.chatService.listChannels();
      const offset = request.query.offset ?? 0;
      const limit = request.query.limit ?? 50;
      const channels = all.slice(offset, offset + limit);
      return reply.send(channels);
    },
  );

  // GET /api/channels/:id — get a single channel
  app.get<{ Params: GetChannelParams }>(
    '/channels/:id',
    { schema: getChannelSchema },
    async (request, reply) => {
      const channel = app.chatService.getChannel(request.params.id);
      if (!channel) {
        return sendError(reply, 404, ErrorCodes.NOT_FOUND, 'Channel not found');
      }
      return reply.send(channel);
    },
  );

  // POST /api/channels — create a channel
  app.post<{ Body: CreateChannelBody }>(
    '/channels',
    { schema: createChannelSchema },
    async (request, reply) => {
      const body = request.body;

      try {
        const channel = app.chatService.createChannel({
          name: body.name.trim(),
          description: body.description?.trim(),
          memberAgentIds: body.memberAgentIds,
        });

        return reply
          .status(201)
          .header('location', `/api/channels/${channel.id}`)
          .send(channel);
      } catch (err) {
        if (err instanceof ChannelValidationError) {
          const mapped = mapValidationError(err);
          return sendError(reply, mapped.status, mapped.code, err.message);
        }
        throw err;
      }
    },
  );

  // PUT/PATCH /api/channels/:id — update a channel
  //
  // NOTE: Both PUT and PATCH currently accept partial bodies (all fields optional).
  // Strict REST semantics say PUT should require a full replacement body while
  // PATCH allows partial updates.  We intentionally keep them identical for now
  // because every client is already sending partial payloads via PUT.
  // TODO: If/when we add response-schema enforcement, revisit whether PUT
  //       should require the full resource shape.
  const updateHandler = async (
    request: { params: UpdateChannelParams; body: UpdateChannelBody },
    reply: import('fastify').FastifyReply,
  ) => {
    const body = request.body;

    try {
      const channel = app.chatService.updateChannel(request.params.id, {
        name: body.name?.trim(),
        description: body.description?.trim(),
        memberAgentIds: body.memberAgentIds,
      });

      if (!channel) {
        return sendError(reply, 404, ErrorCodes.NOT_FOUND, 'Channel not found');
      }

      return reply.send(channel);
    } catch (err) {
      if (err instanceof ChannelValidationError) {
        const mapped = mapValidationError(err);
        return sendError(reply, mapped.status, mapped.code, err.message);
      }
      throw err;
    }
  };

  app.put<{ Params: UpdateChannelParams; Body: UpdateChannelBody }>(
    '/channels/:id',
    { schema: updateChannelSchema },
    updateHandler,
  );

  app.patch<{ Params: UpdateChannelParams; Body: UpdateChannelBody }>(
    '/channels/:id',
    { schema: updateChannelSchema },
    updateHandler,
  );

  // DELETE /api/channels/:id — delete a channel
  app.delete<{ Params: DeleteChannelParams }>(
    '/channels/:id',
    { schema: deleteChannelSchema },
    async (request, reply) => {
      const result = app.chatService.deleteChannel(request.params.id);
      if (!result.deleted) {
        return sendError(reply, 404, ErrorCodes.NOT_FOUND, 'Channel not found');
      }
      return reply.status(204).send();
    },
  );
};

export default channelsRoute;
