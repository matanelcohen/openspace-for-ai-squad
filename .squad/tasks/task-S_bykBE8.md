---
id: task-S_bykBE8
title: Test state caps and reconnect backoff reset
status: in-progress
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-_PGGGZ1K'
created: '2026-04-02T02:04:04.329Z'
updated: '2026-04-02T02:04:04.335Z'
sortIndex: 598
parent: task-_PGGGZ1K
dependsOn:
  - task-5Jd7pfNu
---
Write or update tests (using the existing Vitest setup) for the three hooks changed:

1. **`use-chat.ts`** — Test that when more than `MAX_CACHED_MESSAGES` messages are added, only the newest 500 remain. Verify message ordering is preserved after eviction. Test edge cases: exactly at cap, one over cap, bulk insert well over cap.

2. **`use-task-events.ts`** — Same bounded-growth tests: verify oldest events are evicted and ordering is correct.

3. **`use-websocket.ts`** — Test that the reconnect delay resets to its initial value after a successful subscribe (not just onopen). Simulate a scenario where onopen fires but close follows before subscribe succeeds — verify the delay stays elevated. Then simulate a successful subscribe — verify the delay resets.

Run `pnpm vitest run` scoped to the changed files to confirm all tests pass.
