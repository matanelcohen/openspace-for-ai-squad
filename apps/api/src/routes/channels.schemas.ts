/**
 * Fastify JSON-Schema validation for channel endpoints.
 *
 * Uses @sinclair/typebox so the schemas double as TypeScript types.
 */

import { type Static,Type } from '@sinclair/typebox';

// ── Reusable fragments ──────────────────────────────────────────

const ChannelName = Type.String({
  minLength: 1,
  maxLength: 100,
  pattern: '\\S',
  description: 'Human-readable channel name',
});

const ChannelDescription = Type.String({
  maxLength: 500,
  description: 'Optional channel description',
});

const MemberAgentIds = Type.Array(Type.String({ minLength: 1 }), {
  description: 'IDs of agents that belong to this channel',
});

const ChannelIdParam = Type.Object({
  id: Type.String({
    minLength: 1,
    description: 'Channel identifier',
  }),
});

// ── Per-route schemas ───────────────────────────────────────────

/** POST /api/channels — create a channel */
export const createChannelSchema = {
  body: Type.Object(
    {
      name: ChannelName,
      description: Type.Optional(ChannelDescription),
      memberAgentIds: Type.Optional(MemberAgentIds),
    },
    { additionalProperties: false },
  ),
} as const;

/** PUT /api/channels/:id — update a channel */
export const updateChannelSchema = {
  params: ChannelIdParam,
  body: Type.Object(
    {
      name: Type.Optional(ChannelName),
      description: Type.Optional(ChannelDescription),
      memberAgentIds: Type.Optional(MemberAgentIds),
    },
    { additionalProperties: false },
  ),
} as const;

/** GET /api/channels/:id */
export const getChannelSchema = {
  params: ChannelIdParam,
} as const;

/** DELETE /api/channels/:id */
export const deleteChannelSchema = {
  params: ChannelIdParam,
} as const;

/** GET /api/channels (list) — query params for future filtering */
export const listChannelsSchema = {
  querystring: Type.Object(
    {
      limit: Type.Optional(
        Type.Integer({ minimum: 1, maximum: 200, description: 'Max items to return' }),
      ),
      offset: Type.Optional(
        Type.Integer({ minimum: 0, description: 'Number of items to skip' }),
      ),
    },
    { additionalProperties: false },
  ),
} as const;

// ── Derived TypeScript types ────────────────────────────────────

export type CreateChannelBody = Static<typeof createChannelSchema.body>;
export type UpdateChannelBody = Static<typeof updateChannelSchema.body>;
export type UpdateChannelParams = Static<typeof updateChannelSchema.params>;
export type GetChannelParams = Static<typeof getChannelSchema.params>;
export type DeleteChannelParams = Static<typeof deleteChannelSchema.params>;
export type ListChannelsQuery = Static<typeof listChannelsSchema.querystring>;
