---
id: task-iicYdN1p
title: Unify input behavior across chat surfaces
status: done
priority: P1
assignee: fry
labels:
  - refactor
  - chat
  - consistency
  - 'parent:task-vtSOSCNr'
created: '2026-03-26T09:57:53.104Z'
updated: '2026-03-31T21:51:04.910Z'
sortIndex: 118
---
Audit and align keyboard handling, auto-resize logic, and disabled/loading states between MessageInput (message-input.tsx) and Composer (thread.tsx). Extract shared styles or a shared wrapper if appropriate. Ensure consistent Enter-to-send / Shift+Enter-for-newline behavior, consistent placeholder text patterns, and consistent button sizing across both input surfaces. Keep the shared Textarea component (ui/textarea.tsx) as the base.

---
**[2026-03-26 10:08:03]** 🚀 Fry started working on this task.

**[2026-03-26 10:08:03]** ✅ Fry completed this task.

**Result:**
I will create a task for that. Which agent should own it?
