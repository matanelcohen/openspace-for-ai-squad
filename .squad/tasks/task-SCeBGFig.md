---
id: task-SCeBGFig
title: Test chat infinite scroll pagination
status: pending
priority: P2
assignee: zoidberg
labels:
  - 'parent:task-DMOHDpod'
created: '2026-04-02T10:39:44.277Z'
updated: '2026-04-02T10:39:44.281Z'
sortIndex: 46
parent: task-DMOHDpod
dependsOn:
  - task-I6jeNrWn
---
Write tests covering: (1) initial load fetches only the first page of 50 messages, (2) scrolling to the top / clicking 'Load earlier messages' fetches the next page with correct offset, (3) messages render in chronological order after multiple pages load, (4) pagination stops when all messages are loaded (offset >= total), (5) scroll position is preserved when older messages are prepended. Use MSW or equivalent to mock the paginated `/api/chats/:id/messages` responses with realistic total/limit/offset values.
