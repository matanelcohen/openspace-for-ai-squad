import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { parseAllChannels, parseChannelFile } from '../squad-parser/channel-parser.js';
import {
  createChannel,
  deleteChannel,
  generateChannelId,
  getChannel,
  listChannels,
  updateChannel,
} from './channel-writer.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let channelsDir: string;

beforeEach(async () => {
  channelsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'channel-writer-'));
});

afterEach(async () => {
  await fs.rm(channelsDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// generateChannelId
// ---------------------------------------------------------------------------

describe('generateChannelId', () => {
  it('produces ids matching chan-{8chars}', () => {
    const id = generateChannelId();
    expect(id).toMatch(/^chan-[A-Za-z0-9_-]{8}$/);
  });

  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateChannelId()));
    expect(ids.size).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// createChannel
// ---------------------------------------------------------------------------

describe('createChannel', () => {
  it('creates a channel file with correct content', async () => {
    const channel = await createChannel(channelsDir, {
      name: 'Backend',
      description: 'Backend team channel.',
      memberAgentIds: ['bender', 'leela'],
    });

    expect(channel.id).toMatch(/^chan-/);
    expect(channel.name).toBe('Backend');
    expect(channel.description).toBe('Backend team channel.');
    expect(channel.memberAgentIds).toEqual(['bender', 'leela']);

    // File should exist
    const filePath = path.join(channelsDir, `${channel.id}.md`);
    const content = await fs.readFile(filePath, 'utf-8');
    expect(content).toContain(channel.id);
    expect(content).toContain('Backend');
  });

  it('applies defaults for optional fields', async () => {
    const channel = await createChannel(channelsDir, { name: 'General' });

    expect(channel.description).toBe('');
    expect(channel.memberAgentIds).toEqual([]);
  });

  it('creates the directory if it does not exist', async () => {
    const deepDir = path.join(channelsDir, 'nested', 'deep');
    const channel = await createChannel(deepDir, { name: 'Deep channel' });

    const filePath = path.join(deepDir, `${channel.id}.md`);
    const stat = await fs.stat(filePath);
    expect(stat.isFile()).toBe(true);
  });

  it('round-trips through the parser', async () => {
    const channel = await createChannel(channelsDir, {
      name: 'Round-trip test',
      description: 'This should survive serialization.',
      memberAgentIds: ['fry', 'bender'],
    });

    const { channels } = await parseAllChannels(channelsDir);
    expect(channels).toHaveLength(1);
    const parsed = channels[0]!.channel;

    expect(parsed.id).toBe(channel.id);
    expect(parsed.name).toBe(channel.name);
    expect(parsed.memberAgentIds).toEqual(channel.memberAgentIds);
    expect(parsed.description).toContain('This should survive serialization.');
  });
});

// ---------------------------------------------------------------------------
// getChannel
// ---------------------------------------------------------------------------

describe('getChannel', () => {
  it('reads a channel by id', async () => {
    const created = await createChannel(channelsDir, { name: 'Readable' });
    const fetched = await getChannel(channelsDir, created.id);

    expect(fetched.id).toBe(created.id);
    expect(fetched.name).toBe('Readable');
  });

  it('throws for non-existent channel', async () => {
    await expect(getChannel(channelsDir, 'nonexistent')).rejects.toThrow('Channel not found');
  });
});

// ---------------------------------------------------------------------------
// listChannels
// ---------------------------------------------------------------------------

describe('listChannels', () => {
  it('lists all channels', async () => {
    await createChannel(channelsDir, { name: 'Alpha' });
    await createChannel(channelsDir, { name: 'Beta' });

    const channels = await listChannels(channelsDir);
    expect(channels).toHaveLength(2);
  });

  it('returns empty array when directory does not exist', async () => {
    const channels = await listChannels(path.join(channelsDir, 'nonexistent'));
    expect(channels).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// updateChannel
// ---------------------------------------------------------------------------

describe('updateChannel', () => {
  it('updates specified fields and bumps updatedAt', async () => {
    const created = await createChannel(channelsDir, {
      name: 'Original',
    });

    // Ensure a measurable time difference for updatedAt comparison
    await new Promise((r) => setTimeout(r, 5));

    const updated = await updateChannel(channelsDir, created.id, {
      name: 'Updated name',
      memberAgentIds: ['bender'],
    });

    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Updated name');
    expect(updated.memberAgentIds).toEqual(['bender']);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.updatedAt > created.updatedAt).toBe(true);
  });

  it('preserves fields not included in updates', async () => {
    const created = await createChannel(channelsDir, {
      name: 'Keep members',
      memberAgentIds: ['fry', 'leela'],
    });

    const updated = await updateChannel(channelsDir, created.id, { name: 'New name' });
    expect(updated.memberAgentIds).toEqual(['fry', 'leela']);
  });

  it('cannot change id or createdAt', async () => {
    const created = await createChannel(channelsDir, { name: 'Immutable' });

    const updated = await updateChannel(channelsDir, created.id, {
      ...({ id: 'hacked-id', createdAt: '1999-01-01T00:00:00Z' } as Record<string, unknown>),
      name: 'Still safe',
    } as never);

    expect(updated.id).toBe(created.id);
    expect(updated.createdAt).toBe(created.createdAt);
  });

  it('throws for non-existent channel', async () => {
    await expect(updateChannel(channelsDir, 'nonexistent', { name: 'Nope' })).rejects.toThrow(
      'Channel not found',
    );
  });

  it('persists changes to disk', async () => {
    const created = await createChannel(channelsDir, { name: 'Persist test' });
    await updateChannel(channelsDir, created.id, { name: 'Persisted' });

    const reread = await getChannel(channelsDir, created.id);
    expect(reread.name).toBe('Persisted');
  });
});

// ---------------------------------------------------------------------------
// deleteChannel
// ---------------------------------------------------------------------------

describe('deleteChannel', () => {
  it('removes the channel file', async () => {
    const created = await createChannel(channelsDir, { name: 'Delete me' });
    await deleteChannel(channelsDir, created.id);

    await expect(getChannel(channelsDir, created.id)).rejects.toThrow('Channel not found');
  });

  it('throws for non-existent channel', async () => {
    await expect(deleteChannel(channelsDir, 'ghost')).rejects.toThrow('Channel not found');
  });

  it('does not affect other channels', async () => {
    const c1 = await createChannel(channelsDir, { name: 'Keep' });
    const c2 = await createChannel(channelsDir, { name: 'Remove' });

    await deleteChannel(channelsDir, c2.id);

    const { channels } = await parseAllChannels(channelsDir);
    expect(channels).toHaveLength(1);
    expect(channels[0]!.channel.id).toBe(c1.id);
  });
});
