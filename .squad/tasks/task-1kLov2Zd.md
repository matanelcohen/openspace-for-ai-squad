---
id: task-1kLov2Zd
title: Add pending-approval to taskCounts byStatus fixture
status: done
priority: P0
assignee: zoidberg
labels:
  - bug
  - typescript
  - tests
  - 'parent:task-h0oYAnT5'
created: '2026-03-25T13:35:39.387Z'
updated: '2026-03-25T13:55:39.932Z'
sortIndex: 32
---
In packages/shared/src/__tests__/shared.test.ts line 247, the byStatus record is missing the `'pending-approval'` key. Add `'pending-approval': 0` to the byStatus object and update the length assertion on line 259 from 5 to 6 to account for all 6 TaskStatus values.

---
**[2026-03-25 13:48:38]** 🚀 Zoidberg started working on this task.

---
**[2026-03-25 13:50:16]** 🚀 Zoidberg started working on this task.

---
**[2026-03-25 13:51:22]** 🚀 Zoidberg started working on this task.

---
**[2026-03-25 13:53:55]** 🛑 Permanently blocked after 3 failed attempts.

---
**[2026-03-25 13:55:39]** 🚀 Zoidberg started working on this task.

**Progress:**
**[2026-03-25 13:55:29]** 🧠 Thinking: Let me look at the file mentioned in the task and make the necessary changes.
**[2026-03-25 13:55:29]** 🔧 Using tool: `unknown`
**[2026-03-25 13:55:29]** 🔧 Using tool: `unknown`
**[2026-03-25 13:55:34]** 🔧 Using tool: `unknown`

**[2026-03-25 13:55:39]** ✅ Zoidberg completed this task.

**Result:**
The fix was already in place from a previous attempt. All 20 tests pass, including the `byStatus` length assertion checking for 6 statuses. The `'pending-approval': 0` key is present and the `toHaveLength(6)` assertion is correct. ✅
