/**
 * Channel writer — CRUD operations for `.squad/channels/*.md` files.
 *
 * Each channel is stored as a YAML frontmatter + markdown body file.
 * The `.squad/` directory is the source of truth.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import type { ChatChannel } from '@matanelcohen/openspace-shared';
import matter from 'gray-matter';
import { nanoid } from 'nanoid';

import { parseAllChannels, parseChannelFile } from '../squad-parser/channel-parser.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateChannelInput {
  name: string;
  description?: string;
  memberAgentIds?: string[];
}

export type UpdateChannelInput = Partial<Omit<ChatChannel, 'id' | 'createdAt'>>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function channelToFrontmatter(channel: ChatChannel): Record<string, unknown> {
  return {
    id: channel.id,
    name: channel.name,
    memberAgentIds: channel.memberAgentIds,
    createdAt: channel.createdAt,
    updatedAt: channel.updatedAt,
  };
}

function channelToFileContent(channel: ChatChannel): string {
  const fm = channelToFrontmatter(channel);
  const body = channel.description || '';
  return matter.stringify(body.endsWith('\n') ? body : body + '\n', fm);
}

function channelFilePath(channelsDir: string, id: string): string {
  return path.join(channelsDir, `${id}.md`);
}

/** Generate a unique channel ID: chan-{nanoid(8)} */
export function generateChannelId(): string {
  return `chan-${nanoid(8)}`;
}

// ---------------------------------------------------------------------------
// CRUD Operations
// ---------------------------------------------------------------------------

/**
 * Create a new channel file in `.squad/channels/`.
 * Returns the created ChatChannel object.
 */
export async function createChannel(
  channelsDir: string,
  input: CreateChannelInput,
): Promise<ChatChannel> {
  await fs.mkdir(channelsDir, { recursive: true });

  const now = new Date().toISOString();
  const channel: ChatChannel = {
    id: generateChannelId(),
    name: input.name,
    description: input.description ?? '',
    memberAgentIds: input.memberAgentIds ?? [],
    createdAt: now,
    updatedAt: now,
  };

  const filePath = channelFilePath(channelsDir, channel.id);
  await fs.writeFile(filePath, channelToFileContent(channel), 'utf-8');

  return channel;
}

/**
 * Update an existing channel by ID.
 * Reads the current file, applies updates, writes back.
 * Returns the updated ChatChannel.
 */
export async function updateChannel(
  channelsDir: string,
  id: string,
  updates: UpdateChannelInput,
): Promise<ChatChannel> {
  const filePath = channelFilePath(channelsDir, id);

  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch {
    throw new Error(`Channel not found: ${id}`);
  }

  const { channel: current } = parseChannelFile(content, filePath);

  const updated: ChatChannel = {
    ...current,
    ...updates,
    id: current.id, // ID is immutable
    createdAt: current.createdAt, // createdAt is immutable
    updatedAt: new Date().toISOString(),
  };

  await fs.writeFile(filePath, channelToFileContent(updated), 'utf-8');
  return updated;
}

/**
 * Delete a channel file by ID.
 * Throws if the channel does not exist.
 */
export async function deleteChannel(channelsDir: string, id: string): Promise<void> {
  const filePath = channelFilePath(channelsDir, id);

  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`Channel not found: ${id}`);
  }

  await fs.unlink(filePath);
}

/**
 * Read a single channel by ID.
 * Returns the ChatChannel or throws if not found.
 */
export async function getChannel(channelsDir: string, id: string): Promise<ChatChannel> {
  const filePath = channelFilePath(channelsDir, id);

  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch {
    throw new Error(`Channel not found: ${id}`);
  }

  return parseChannelFile(content, filePath).channel;
}

/**
 * List all channels.
 * Returns all successfully parsed channels.
 */
export async function listChannels(channelsDir: string): Promise<ChatChannel[]> {
  const { channels } = await parseAllChannels(channelsDir);
  return channels.map((c) => c.channel);
}
