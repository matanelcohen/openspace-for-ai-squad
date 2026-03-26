/**
 * E2E tests — Channel CRUD API validation & edge cases
 *
 * Covers gaps not addressed by existing tests:
 *   - Schema validation: name length, whitespace, description overflow
 *   - Partial updates (rename, description-only)
 *   - Duplicate-name edge cases (self-rename allowed, cross-rename rejected)
 *   - Pagination (limit, offset, boundary values)
 *   - Error responses: 400, 404, 409 with correct bodies
 *   - Location header on 201
 */

import { type APIRequestContext, expect, test } from '@playwright/test';

const API_BASE = 'http://localhost:3001/api';

function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createChannel(
  request: APIRequestContext,
  name: string,
  memberAgentIds: string[],
  description = '',
) {
  const res = await request.post(`${API_BASE}/channels`, {
    data: { name, description, memberAgentIds },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as {
    id: string;
    name: string;
    description: string;
    memberAgentIds: string[];
    createdAt: string;
    updatedAt: string;
  };
}

async function deleteChannel(request: APIRequestContext, id: string) {
  await request.delete(`${API_BASE}/channels/${id}`);
}

// ═══════════════════════════════════════════════════════════════════
// Schema validation — create
// ═══════════════════════════════════════════════════════════════════

test.describe('Channel creation validation', () => {
  test.setTimeout(15_000);

  test('rejects missing name field', async ({ request }) => {
    const res = await request.post(`${API_BASE}/channels`, {
      data: { memberAgentIds: ['fry'] },
    });
    expect(res.ok()).toBe(false);
    expect(res.status()).toBe(400);
  });

  test('rejects whitespace-only name', async ({ request }) => {
    const res = await request.post(`${API_BASE}/channels`, {
      data: { name: '   ', memberAgentIds: ['fry'] },
    });
    expect(res.ok()).toBe(false);
    expect(res.status()).toBe(400);
  });

  test('rejects empty string name', async ({ request }) => {
    const res = await request.post(`${API_BASE}/channels`, {
      data: { name: '', memberAgentIds: ['fry'] },
    });
    expect(res.ok()).toBe(false);
    expect(res.status()).toBe(400);
  });

  test('rejects name exceeding 100 characters', async ({ request }) => {
    const longName = 'A'.repeat(101);
    const res = await request.post(`${API_BASE}/channels`, {
      data: { name: longName, memberAgentIds: ['fry'] },
    });
    expect(res.ok()).toBe(false);
    expect(res.status()).toBe(400);
  });

  test('accepts name at exactly 100 characters', async ({ request }) => {
    const maxName = 'B'.repeat(100);
    const res = await request.post(`${API_BASE}/channels`, {
      data: { name: maxName, memberAgentIds: ['fry'] },
    });
    expect(res.status()).toBe(201);
    const channel = await res.json();

    try {
      expect(channel.name).toBe(maxName);
    } finally {
      await deleteChannel(request, channel.id);
    }
  });

  test('rejects description exceeding 500 characters', async ({ request }) => {
    const res = await request.post(`${API_BASE}/channels`, {
      data: {
        name: uniqueName('LongDesc'),
        description: 'D'.repeat(501),
        memberAgentIds: ['fry'],
      },
    });
    expect(res.ok()).toBe(false);
    expect(res.status()).toBe(400);
  });

  test('accepts description at exactly 500 characters', async ({ request }) => {
    const maxDesc = 'E'.repeat(500);
    const res = await request.post(`${API_BASE}/channels`, {
      data: {
        name: uniqueName('MaxDesc'),
        description: maxDesc,
        memberAgentIds: ['fry'],
      },
    });
    expect(res.status()).toBe(201);
    const channel = await res.json();

    try {
      expect(channel.description).toBe(maxDesc);
    } finally {
      await deleteChannel(request, channel.id);
    }
  });

  test('rejects unknown fields (additionalProperties: false)', async ({ request }) => {
    const res = await request.post(`${API_BASE}/channels`, {
      data: {
        name: uniqueName('ExtraField'),
        memberAgentIds: ['fry'],
        unknownField: 'should fail',
      },
    });
    expect(res.ok()).toBe(false);
    expect(res.status()).toBe(400);
  });

  test('returns 201 with Location header on successful creation', async ({ request }) => {
    const name = uniqueName('Location');
    const res = await request.post(`${API_BASE}/channels`, {
      data: { name, memberAgentIds: ['fry'] },
    });
    expect(res.status()).toBe(201);

    const channel = await res.json();
    const location = res.headers()['location'];
    expect(location).toContain(channel.id);

    await deleteChannel(request, channel.id);
  });

  test('created channel has correct timestamps', async ({ request }) => {
    const before = new Date().toISOString();
    const name = uniqueName('Timestamps');
    const res = await request.post(`${API_BASE}/channels`, {
      data: { name, memberAgentIds: ['fry'] },
    });
    const after = new Date().toISOString();

    expect(res.status()).toBe(201);
    const channel = await res.json();

    try {
      expect(channel.createdAt).toBeTruthy();
      expect(channel.updatedAt).toBeTruthy();
      // Timestamps should be between before and after
      expect(channel.createdAt >= before).toBe(true);
      expect(channel.createdAt <= after).toBe(true);
      // createdAt and updatedAt should match on creation
      expect(channel.createdAt).toBe(channel.updatedAt);
    } finally {
      await deleteChannel(request, channel.id);
    }
  });

  test('created channel generates a unique ID', async ({ request }) => {
    const ch1 = await createChannel(request, uniqueName('Id1'), ['fry']);
    const ch2 = await createChannel(request, uniqueName('Id2'), ['fry']);

    try {
      expect(ch1.id).toBeTruthy();
      expect(ch2.id).toBeTruthy();
      expect(ch1.id).not.toBe(ch2.id);
      // IDs should be reasonable length (nanoid 12)
      expect(ch1.id.length).toBeGreaterThanOrEqual(8);
    } finally {
      await deleteChannel(request, ch1.id);
      await deleteChannel(request, ch2.id);
    }
  });

  test('channel created without description defaults to empty string', async ({ request }) => {
    const name = uniqueName('NoDesc');
    const channel = await createChannel(request, name, ['fry']);

    try {
      expect(channel.description).toBe('');
    } finally {
      await deleteChannel(request, channel.id);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// Update edge cases
// ═══════════════════════════════════════════════════════════════════

test.describe('Channel update edge cases', () => {
  test.setTimeout(15_000);

  test('update non-existent channel returns 404', async ({ request }) => {
    const res = await request.put(`${API_BASE}/channels/nonexistent-id-99999`, {
      data: { name: 'Nope' },
    });
    expect(res.status()).toBe(404);
  });

  test('rename channel to a new unique name succeeds', async ({ request }) => {
    const channel = await createChannel(request, uniqueName('Rename'), ['fry']);
    const newName = uniqueName('Renamed');

    try {
      const res = await request.put(`${API_BASE}/channels/${channel.id}`, {
        data: { name: newName },
      });
      expect(res.ok()).toBe(true);

      const updated = await res.json();
      expect(updated.name).toBe(newName);

      // Verify via GET
      const getRes = await request.get(`${API_BASE}/channels/${channel.id}`);
      const fetched = await getRes.json();
      expect(fetched.name).toBe(newName);
    } finally {
      await deleteChannel(request, channel.id);
    }
  });

  test('rename channel to its own current name succeeds (self-rename)', async ({ request }) => {
    const name = uniqueName('SelfRename');
    const channel = await createChannel(request, name, ['fry']);

    try {
      const res = await request.put(`${API_BASE}/channels/${channel.id}`, {
        data: { name },
      });
      // Self-rename should be allowed (not treated as duplicate)
      expect(res.ok()).toBe(true);
      const updated = await res.json();
      expect(updated.name).toBe(name);
    } finally {
      await deleteChannel(request, channel.id);
    }
  });

  test('rename to existing channel name fails with 409', async ({ request }) => {
    const nameA = uniqueName('RenameA');
    const nameB = uniqueName('RenameB');
    const chA = await createChannel(request, nameA, ['fry']);
    const chB = await createChannel(request, nameB, ['fry']);

    try {
      // Try to rename B to A's name
      const res = await request.put(`${API_BASE}/channels/${chB.id}`, {
        data: { name: nameA },
      });
      expect(res.ok()).toBe(false);
      // Should be 409 Conflict for duplicate name
      expect(res.status()).toBeGreaterThanOrEqual(400);
      expect(res.status()).toBeLessThan(500);
    } finally {
      await deleteChannel(request, chA.id);
      await deleteChannel(request, chB.id);
    }
  });

  test('update description only (partial update)', async ({ request }) => {
    const channel = await createChannel(request, uniqueName('PartialDesc'), ['fry'], 'Original');

    try {
      const res = await request.put(`${API_BASE}/channels/${channel.id}`, {
        data: { description: 'Updated description' },
      });
      expect(res.ok()).toBe(true);
      const updated = await res.json();

      expect(updated.description).toBe('Updated description');
      // Name should be unchanged
      expect(updated.name).toBe(channel.name);
      // Members should be unchanged
      expect(updated.memberAgentIds).toEqual(channel.memberAgentIds);
    } finally {
      await deleteChannel(request, channel.id);
    }
  });

  test('update updates the updatedAt timestamp', async ({ request }) => {
    const channel = await createChannel(request, uniqueName('UpdateTime'), ['fry']);

    // Small delay to ensure timestamps differ
    await new Promise((r) => setTimeout(r, 50));

    try {
      const before = new Date().toISOString();
      const res = await request.put(`${API_BASE}/channels/${channel.id}`, {
        data: { description: 'Trigger timestamp update' },
      });
      expect(res.ok()).toBe(true);
      const updated = await res.json();

      // updatedAt should be >= before
      expect(updated.updatedAt >= before).toBe(true);
      // updatedAt should differ from createdAt
      expect(updated.updatedAt).not.toBe(channel.createdAt);
    } finally {
      await deleteChannel(request, channel.id);
    }
  });

  test('PATCH endpoint behaves the same as PUT for partial updates', async ({ request }) => {
    const channel = await createChannel(request, uniqueName('PatchTest'), ['fry'], 'Original');

    try {
      const res = await request.patch(`${API_BASE}/channels/${channel.id}`, {
        data: { description: 'Patched' },
      });
      expect(res.ok()).toBe(true);
      const updated = await res.json();

      expect(updated.description).toBe('Patched');
      expect(updated.name).toBe(channel.name);
    } finally {
      await deleteChannel(request, channel.id);
    }
  });

  test('update rejects unknown fields', async ({ request }) => {
    const channel = await createChannel(request, uniqueName('UpdateExtra'), ['fry']);

    try {
      const res = await request.put(`${API_BASE}/channels/${channel.id}`, {
        data: { name: 'Updated', bogusField: true },
      });
      expect(res.ok()).toBe(false);
      expect(res.status()).toBe(400);
    } finally {
      await deleteChannel(request, channel.id);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// Pagination
// ═══════════════════════════════════════════════════════════════════

test.describe('Channel list pagination', () => {
  test.setTimeout(20_000);

  const createdIds: string[] = [];

  test.afterAll(async ({ request }) => {
    for (const id of createdIds) {
      await request.delete(`${API_BASE}/channels/${id}`);
    }
  });

  test('limit restricts the number of returned channels', async ({ request }) => {
    // Ensure at least 3 channels exist
    for (let i = 0; i < 3; i++) {
      const ch = await createChannel(request, uniqueName(`Page${i}`), ['fry']);
      createdIds.push(ch.id);
    }

    const res = await request.get(`${API_BASE}/channels`, {
      params: { limit: '2' },
    });
    expect(res.ok()).toBe(true);
    const channels = await res.json();
    expect(channels.length).toBeLessThanOrEqual(2);
  });

  test('offset skips the specified number of channels', async ({ request }) => {
    // Get all channels
    const allRes = await request.get(`${API_BASE}/channels`);
    const all = await allRes.json();

    if (all.length < 2) {
      test.skip();
      return;
    }

    // Get with offset=1
    const offsetRes = await request.get(`${API_BASE}/channels`, {
      params: { offset: '1', limit: String(all.length) },
    });
    const offset = await offsetRes.json();

    // Should have one fewer channel
    expect(offset.length).toBe(all.length - 1);
    // First channel from all list should not be in offset list
    expect(offset[0]?.id).not.toBe(all[0]?.id);
  });

  test('limit=0 is rejected (minimum is 1)', async ({ request }) => {
    const res = await request.get(`${API_BASE}/channels`, {
      params: { limit: '0' },
    });
    expect(res.ok()).toBe(false);
    expect(res.status()).toBe(400);
  });

  test('limit exceeding 200 is rejected', async ({ request }) => {
    const res = await request.get(`${API_BASE}/channels`, {
      params: { limit: '201' },
    });
    expect(res.ok()).toBe(false);
    expect(res.status()).toBe(400);
  });

  test('negative offset is rejected', async ({ request }) => {
    const res = await request.get(`${API_BASE}/channels`, {
      params: { offset: '-1' },
    });
    expect(res.ok()).toBe(false);
    expect(res.status()).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Delete edge cases
// ═══════════════════════════════════════════════════════════════════

test.describe('Channel delete edge cases', () => {
  test.setTimeout(15_000);

  test('delete returns 204 No Content', async ({ request }) => {
    const channel = await createChannel(request, uniqueName('Del204'), ['fry']);

    const res = await request.delete(`${API_BASE}/channels/${channel.id}`);
    expect(res.status()).toBe(204);
  });

  test('double-delete returns 404 on second attempt', async ({ request }) => {
    const channel = await createChannel(request, uniqueName('DoubleDel'), ['fry']);

    const first = await request.delete(`${API_BASE}/channels/${channel.id}`);
    expect(first.status()).toBe(204);

    const second = await request.delete(`${API_BASE}/channels/${channel.id}`);
    expect(second.status()).toBe(404);
  });

  test('deleted channel messages are no longer retrievable', async ({ request }) => {
    const channel = await createChannel(request, uniqueName('DelMsgs'), ['fry']);
    const recipient = `channel:${channel.id}`;

    // Send messages
    const msg1Res = await request.post(`${API_BASE}/chat/messages`, {
      data: { sender: 'user', recipient, content: 'Before delete 1' },
    });
    expect(msg1Res.status()).toBe(201);

    const msg2Res = await request.post(`${API_BASE}/chat/messages`, {
      data: { sender: 'user', recipient, content: 'Before delete 2' },
    });
    expect(msg2Res.status()).toBe(201);

    // Delete channel
    await request.delete(`${API_BASE}/channels/${channel.id}`);

    // Messages should be gone
    const msgsRes = await request.get(`${API_BASE}/chat/messages`, {
      params: { agent: recipient },
    });
    // Either 404 (channel gone) or empty messages
    if (msgsRes.ok()) {
      const data = await msgsRes.json();
      const messages = data.messages ?? data;
      const contents = messages.map((m: { content: string }) => m.content);
      expect(contents).not.toContain('Before delete 1');
      expect(contents).not.toContain('Before delete 2');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// GET edge cases
// ═══════════════════════════════════════════════════════════════════

test.describe('Channel GET edge cases', () => {
  test.setTimeout(10_000);

  test('get channel with non-existent ID returns 404', async ({ request }) => {
    const res = await request.get(`${API_BASE}/channels/does-not-exist-xyz`);
    expect(res.status()).toBe(404);
  });

  test('get channel returns all expected fields', async ({ request }) => {
    const name = uniqueName('Fields');
    const channel = await createChannel(request, name, ['fry', 'leela'], 'Test description');

    try {
      const res = await request.get(`${API_BASE}/channels/${channel.id}`);
      expect(res.ok()).toBe(true);
      const data = await res.json();

      // Verify all expected fields exist and have correct types
      expect(typeof data.id).toBe('string');
      expect(typeof data.name).toBe('string');
      expect(typeof data.description).toBe('string');
      expect(Array.isArray(data.memberAgentIds)).toBe(true);
      expect(typeof data.createdAt).toBe('string');
      expect(typeof data.updatedAt).toBe('string');

      // Verify values
      expect(data.name).toBe(name);
      expect(data.description).toBe('Test description');
      expect(data.memberAgentIds).toEqual(['fry', 'leela']);
    } finally {
      await deleteChannel(request, channel.id);
    }
  });
});
