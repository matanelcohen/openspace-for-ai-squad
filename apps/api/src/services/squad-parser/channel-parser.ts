/**
 * Channel parser — reads `.squad/channels/*.md` files into typed ChatChannel objects.
 *
 * File format: YAML frontmatter + markdown body.
 * The markdown body becomes the channel description.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import type { ChatChannel } from '@openspace/shared';
import matter from 'gray-matter';

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function toISOString(value: unknown): string {
  if (typeof value === 'string') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString();
  }
  return new Date().toISOString();
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string');
  return [];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ParseChannelResult {
  channel: ChatChannel;
  filePath: string;
}

export interface ParseChannelError {
  filePath: string;
  error: string;
}

export interface ParseAllChannelsResult {
  channels: ParseChannelResult[];
  errors: ParseChannelError[];
}

/**
 * Parse a single channel file. Returns a ChatChannel or throws on invalid format.
 */
export function parseChannelFile(content: string, filePath: string): ParseChannelResult {
  const { data, content: body } = matter(content);

  if (!data || typeof data !== 'object') {
    throw new Error(`Missing or invalid frontmatter in ${filePath}`);
  }

  const fm = data as Record<string, unknown>;

  if (typeof fm.id !== 'string' || fm.id.trim() === '') {
    throw new Error(`Missing required field "id" in ${filePath}`);
  }
  if (typeof fm.name !== 'string' || fm.name.trim() === '') {
    throw new Error(`Missing required field "name" in ${filePath}`);
  }

  const channel: ChatChannel = {
    id: fm.id.trim(),
    name: fm.name.trim(),
    description: body.trim(),
    memberAgentIds: toStringArray(fm.memberAgentIds),
    createdAt: toISOString(fm.createdAt),
    updatedAt: toISOString(fm.updatedAt),
  };

  return { channel, filePath };
}

/**
 * Parse all `.md` files in the given channels directory.
 * Returns successfully parsed channels and any errors encountered.
 */
export async function parseAllChannels(channelsDir: string): Promise<ParseAllChannelsResult> {
  const channels: ParseChannelResult[] = [];
  const errors: ParseChannelError[] = [];

  let entries: string[];
  try {
    entries = await fs.readdir(channelsDir);
  } catch {
    // Directory doesn't exist or is unreadable — return empty
    return { channels: [], errors: [] };
  }

  const mdFiles = entries.filter((e) => e.endsWith('.md')).sort();

  for (const file of mdFiles) {
    const filePath = path.join(channelsDir, file);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const result = parseChannelFile(content, filePath);
      channels.push(result);
    } catch (err) {
      errors.push({
        filePath,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Sort by creation time for stable ordering
  channels.sort(
    (a, b) => new Date(a.channel.createdAt).getTime() - new Date(b.channel.createdAt).getTime(),
  );

  return { channels, errors };
}
