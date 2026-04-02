---
id: task-Tob9J9v4
title: Test WS disconnection and retry behavior
status: pending
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-Skcn1CvO'
created: '2026-04-02T00:57:34.058Z'
updated: '2026-04-02T01:24:39.266Z'
sortIndex: 570
parent: task-Skcn1CvO
dependsOn:
  - task-CmJ2q73l
  - task-j1oSQ8yA
description: >
  Write tests in apps/web/src/hooks/__tests__/ (or co-located .test.ts files)
  covering: (1) useChatMessages retries on fetch failure up to 3 times with
  backoff, (2) useSendMessage rolls back optimistic update and fires toast on
  mutation error, (3) useWsConnection returns isConnected: false when socket
  closes and isReconnecting: true during backoff, (4) ReconnectingBanner renders
  when isConnected is false and hides when true, (5) voice session shows error
  toast when api.post fails. Mock WebSocket and fetch using vitest (already
  configured in vitest.config.ts). Verify the reconnecting banner
  appears/disappears by rendering AppLayout with a mocked WS provider.



  ---

  **[2026-04-02 01:24:39]** ⚠️ Task was stuck in-progress after server restart.
  Reset to pending.
---
Write tests in apps/web/src/hooks/__tests__/ (or co-located .test.ts files) covering: (1) useChatMessages retries on fetch failure up to 3 times with backoff, (2) useSendMessage rolls back optimistic update and fires toast on mutation error, (3) useWsConnection returns isConnected: false when socket closes and isReconnecting: true during backoff, (4) ReconnectingBanner renders when isConnected is false and hides when true, (5) voice session shows error toast when api.post fails. Mock WebSocket and fetch using vitest (already configured in vitest.config.ts). Verify the reconnecting banner appears/disappears by rendering AppLayout with a mocked WS provider.
