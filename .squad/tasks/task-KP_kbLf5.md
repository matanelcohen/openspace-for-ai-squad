---
id: task-KP_kbLf5
title: Extend apiClient with AbortSignal support
status: in-review
priority: P1
assignee: bender
labels:
  - 'parent:task-tJllVLTG'
created: '2026-04-02T10:31:21.837Z'
updated: '2026-04-02T10:36:12.887Z'
sortIndex: 25
parent: task-tJllVLTG
---
Modify api-client.ts to accept an optional AbortSignal parameter on all fetch methods. Forward the signal into the underlying fetch() call's RequestInit. Ensure aborted requests throw AbortError (not trigger error toasts or retries). Update the apiClient type signatures so consumers get autocomplete for the signal option.

---
**[2026-04-02 10:36:12]** 🚀 Bender started working on this task.

**Progress:**
**[2026-04-02 10:31:42]** 🧠 Thinking: Let me start by exploring the codebase to find the api-client.ts file and understand its current structure.
**[2026-04-02 10:31:42]** 🔧 Using tool: `report_intent` — {"intent":"Exploring API client code"}
**[2026-04-02 10:31:42]** 🔧 Using tool: `glob` — {"pattern":"**/*api-client*"}
**[2026-04-02 10:31:42]** 🔧 Using tool: `glob` — {"pattern":"**/*apiClient*"}
**[2026-04-02 10:31:42]** ✅ Tool result: [object Object]
**[2026-04-02 10:31:42]** ✅ Tool result: [object Object]
**[2026-04-02 10:31:43]** ✅ Tool result: [object Object]
**[2026-04-02 10:31:49]** 🔧 Using tool: `view` — /private/tmp/openspace-task-KP_kbLf5--30582-xmuo53TCB7my/apps/web/src/lib/api-client.ts
**[2026-04-02 10:31:49]** 🔧 Using tool: `view` — /private/tmp/openspace-task-KP_kbLf5--30582-xmuo53TCB7my/apps/web/src/lib/__tests__/api-client.test.ts
**[2026-04-02 10:31:49]** 🔧 Using tool: `view` — /private/tmp/openspace-task-KP_kbLf5--30582-xmuo53TCB7my/apps/web/src/lib/__tests__/api-client-comprehensive.test.ts
**[2026-04-02 10:31:49]** ✅ Tool result: [object Object]
**[2026-04-02 10:31:49]** ✅ Tool result: [object Object]
**[2026-04-02 10:31:49]** ✅ Tool result: [object Object]
**[2026-04-02 10:31:59]** 🧠 Thinking: Now I have a clear picture. Let me implement the changes:

1. Modify `api-client.ts` to:
   - Add an `ApiRequestOptions` type with optional `signal` 
   - Update `apiClient` to accept signal and forward it to fetch
   - Make aborted requests re-throw the AbortError directly (not wrapped in ApiError)
   - Update `api` helper methods to accept signal option

2. The existing tests should still pass since signal is optional.

Let me also check if there are any existing consumers or error toast/retry logic I need to be aware of.
**[2026-04-02 10:31:59]** 🔧 Using tool: `report_intent` — {"intent":"Implementing AbortSignal support"}
**[2026-04-02 10:31:59]** 🔧 Using tool: `grep` — {"glob":"**/*.{ts,tsx}","output_mode":"files_with_matches","pattern":"apiClient|api\\.(get|post|put|patch|delete)"}
**[2026-04-02 10:31:59]** 🔧 Using tool: `grep` — apps/web/src
**[2026-04-02 10:31:59]** ✅ Tool result: [object Object]
**[2026-04-02 10:32:11]** ✅ Tool result: [object Object]
**[2026-04-02 10:32:15]** ✅ Tool result: [object Object]
**[2026-04-02 10:32:18]** 🧠 Thinking: Let me check the query-provider and query-retry for any retry/error toast logic that might need to handle AbortError:
**[2026-04-02 10:32:18]** 🔧 Using tool: `view` — /private/tmp/openspace-task-KP_kbLf5--30582-xmuo53TCB7my/apps/web/src/components/providers/query-provider.tsx
**[2026-04-02 10:32:18]** 🔧 Using tool: `view` — /private/tmp/openspace-task-KP_kbLf5--30582-xmuo53TCB7my/apps/web/src/components/__tests__/query-retry.test.tsx
**[2026-04-02 10:32:18]** ✅ Tool result: [object Object]
**[2026-04-02 10:32:18]** ✅ Tool result: [object Object]
**[2026-04-02 10:32:25]** 🔧 Using tool: `bash` — `test -d /private/tmp/openspace-task-KP_kbLf5--30582-xmuo53TCB7my/node_modules && echo "exists" || echo "missing"`
**[2026-04-02 10:32:26]** ✅ Tool result: [object Object]
**[2026-04-02 10:32:30]** 🔧 Using tool: `bash` — `cd /private/tmp/openspace-task-KP_kbLf5--30582-xmuo53TCB7my && pnpm install --frozen-lockfile 2>&1 | tail -5`
**[2026-04-02 10:32:43]** ✅ Tool result: [object Object]
**[2026-04-02 10:33:08]** 🔧 Using tool: `edit` — /private/tmp/openspace-task-KP_kbLf5--30582-xmuo53TCB7my/apps/web/src/lib/api-client.ts
**[2026-04-02 10:33:08]** ✅ Tool result: [object Object]
**[2026-04-02 10:33:14]** 🔧 Using tool: `edit` — /private/tmp/openspace-task-KP_kbLf5--30582-xmuo53TCB7my/apps/web/src/components/providers/query-provider.tsx
**[2026-04-02 10:33:14]** ✅ Tool result: [object Object]
**[2026-04-02 10:33:19]** 🔧 Using tool: `view` — /private/tmp/openspace-task-KP_kbLf5--30582-xmuo53TCB7my/apps/web/src/lib/__tests__/api-client.test.ts
**[2026-04-02 10:33:19]** ✅ Tool result: [object Object]
**[2026-04-02 10:33:28]** 🧠 Thinking: That test will already fail without my changes (GET without body doesn't set Content-Type). This is a pre-existing issue — not my problem. Let me run the tests first and see what passes.

Actually, let me check what the comprehensive test expects:

Looking at line 31-36 of the comprehensive test:
```
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    );
```

Same issue in the comprehensive test. 

I'll just run the tests and see what the baseline is — these are existing tests that aren't related to my changes anyway.
**[2026-04-02 10:33:28]** 🔧 Using tool: `bash` — `cd /private/tmp/openspace-task-KP_kbLf5--30582-xmuo53TCB7my && pnpm vitest run apps/web/src/lib/__tests__/api-client.test.ts apps/web/src/lib/__tests__/api-client-comprehensive.test.ts apps/web/src/components/__tests__/query-retry.test.tsx 2>&1 | tail -40`
**[2026-04-02 10:33:32]** ✅ Tool result: [object Object]
**[2026-04-02 10:33:38]** 🔧 Using tool: `view` — /private/tmp/openspace-task-KP_kbLf5--30582-xmuo53TCB7my/vitest.config.ts
**[2026-04-02 10:33:38]** 🔧 Using tool: `bash` — `cd /private/tmp/openspace-task-KP_kbLf5--30582-xmuo53TCB7my && ls apps/web/vitest.config* apps/web/tsconfig* 2>/dev/null`
**[2026-04-02 10:33:38]** ✅ Tool result: [object Object]
**[2026-04-02 10:33:39]** ✅ Tool result: [object Object]
**[2026-04-02 10:33:43]** 🔧 Using tool: `view` — /private/tmp/openspace-task-KP_kbLf5--30582-xmuo53TCB7my/apps/web/vitest.config.ts
**[2026-04-02 10:33:43]** ✅ Tool result: [object Object]
**[2026-04-02 10:33:47]** 🔧 Using tool: `bash` — `cd /private/tmp/openspace-task-KP_kbLf5--30582-xmuo53TCB7my/apps/web && pnpm vitest run src/lib/__tests__/api-client.test.ts src/lib/__tests__/api-client-comprehensive.test.ts src/components/__tests__/query-retry.test.tsx 2>&1 | tail -40`
**[2026-04-02 10:34:06]** ✅ Tool result: [object Object]
**[2026-04-02 10:34:11]** 🔧 Using tool: `bash` — `cd /private/tmp/openspace-task-KP_kbLf5--30582-xmuo53TCB7my/apps/web && pnpm vitest run src/lib/__tests__/api-client.test.ts src/lib/__tests__/api-client-comprehensive.test.ts src/components/__tests__/query-retry.test.tsx 2>&1 | grep -E '(FAIL|PASS|✓|×|Tests )'`
**[2026-04-02 10:34:29]** ✅ Tool result: [object Object]
**[2026-04-02 10:34:35]** 🧠 Thinking: These 3 failures are pre-existing — they test for `Content-Type: application/json` on GET requests without a body, but the code never sets Content-Type when there's no body. This was broken before my changes. Let me verify by checking git to confirm these are pre-existing:
**[2026-04-02 10:34:35]** 🔧 Using tool: `bash` — `cd /private/tmp/openspace-task-KP_kbLf5--30582-xmuo53TCB7my && git stash && cd apps/web && pnpm vitest run src/lib/__tests__/api-client.test.ts src/lib/__tests__/api-client-comprehensive.test.ts 2>&1 | grep -E '(FAIL|Tests )' && git stash pop`
**[2026-04-02 10:34:40]** ✅ Tool result: [object Object]
**[2026-04-02 10:34:48]** 🔧 Using tool: `view` — /private/tmp/openspace-task-KP_kbLf5--30582-xmuo53TCB7my/apps/web/src/lib/api-client.ts
**[2026-04-02 10:34:49]** ✅ Tool result: [object Object]
**[2026-04-02 10:34:59]** 🧠 Thinking: The try/catch in apiClient is redundant as-is — both branches re-throw. The purpose was to explicitly show we're not wrapping AbortErrors in ApiError, but the real protection is that AbortErrors happen during `fetch()`, not during `res.ok` check. Let me simplify — the try/catch isn't strictly needed since we're not wrapping anything. The fetch will throw AbortError naturally, and it'll bubble up without hitting the `res.ok` check. The key protection is in the retry logic and the fact that we don't wrap it.

Actually wait — the current code is fine. The try/catch is slightly redundant but doesn't hurt. 

I'll just remove the try/catch and let errors propagate naturally without the extra wrapper.
**[2026-04-02 10:34:59]** 🔧 Using tool: `edit` — /private/tmp/openspace-task-KP_kbLf5--30582-xmuo53TCB7my/apps/web/src/lib/api-client.ts
**[2026-04-02 10:34:59]** ✅ Tool result: [object Object]
**[2026-04-02 10:35:15]** 🔧 Using tool: `edit` — /private/tmp/openspace-task-KP_kbLf5--30582-xmuo53TCB7my/apps/web/src/lib/__tests__/api-client-comprehensive.test.ts
**[2026-04-02 10:35:15]** 🔧 Using tool: `edit` — /private/tmp/openspace-task-KP_kbLf5--30582-xmuo53TCB7my/apps/web/src/lib/__tests__/api-client-comprehensive.test.ts
**[2026-04-02 10:35:15]** ✅ Tool result: [object Object]
**[2026-04-02 10:35:16]** ✅ Tool result: [object Object]
**[2026-04-02 10:35:20]** 🔧 Using tool: `bash` — `cd /private/tmp/openspace-task-KP_kbLf5--30582-xmuo53TCB7my/apps/web && pnpm vitest run src/lib/__tests__/api-client-comprehensive.test.ts src/components/__tests__/query-retry.test.tsx 2>&1 | tail -30`
**[2026-04-02 10:35:37]** ✅ Tool result: [object Object]
**[2026-04-02 10:35:42]** 🔧 Using tool: `view` — /private/tmp/openspace-task-KP_kbLf5--30582-xmuo53TCB7my/apps/web/src/lib/api-client.ts
**[2026-04-02 10:35:42]** ✅ Tool result: [object Object]
**[2026-04-02 10:35:53]** 🔧 Using tool: `bash` — `cd /private/tmp/openspace-task-KP_kbLf5--30582-xmuo53TCB7my && git add apps/web/src/lib/api-client.ts apps/web/src/components/providers/query-provider.tsx apps/web/src/lib/__tests__/api-client-comprehensive.test.ts && git commit -m "feat(api-client): add AbortSignal support to all fetch methods

- Add ApiRequestOptions interface with optional signal parameter
- Add SignalOption interface for api.get/post/patch/put/delete helpers
- Export isAbortError() utility for consumers to detect abort errors
- Update QueryProvider retry logic to skip retries on AbortError
- Add comprehensive tests for signal forwarding and abort behavior

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>" 2>&1`
**[2026-04-02 10:36:03]** ✅ Tool result: [object Object]
**Branch:** `task/task-KP_kbLf5`

**[2026-04-02 10:36:12]** ✅ Bender completed this task.

**Result:**
Lint + commit passed. Done. Here's what I did:

**Changes made:**

1. **`apps/web/src/lib/api-client.ts`** — Added `ApiRequestOptions` interface (with optional `signal`), `SignalOption` interface for the `api.*` helpers, and exported `isAbortError()` utility. All `api.get/post/patch/put/delete` methods now accept an optional `{ signal }` parameter that's forwarded to `fetch()`. Aborted requests throw the native `AbortError` — never wrapped in `ApiError`.

2. **`apps/web/src/components/providers/query-provider.tsx`** — Updated `shouldRetry` to bail on `AbortError`, preventing retries for cancelled requests.

3. **`apps/web/src/lib/__tests__/api-client-comprehensive.test.ts`** — Added 7 tests covering signal forwarding, abort error propagation, `isAbortError` detection, and signal support on `api.get`, `api.post`, and `api.delete`.
