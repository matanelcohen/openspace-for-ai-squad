---
id: task-m2_XkghE
title: Write tests for debounced search behavior
status: pending
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-jWYEfBFS'
created: '2026-04-02T11:11:11.896Z'
updated: '2026-04-02T11:11:11.900Z'
sortIndex: 97
parent: task-jWYEfBFS
dependsOn:
  - task-l5ATSOJR
---
Add tests verifying: (1) the search input updates immediately on keystroke (no visual lag), (2) the flatSpans filtered list does NOT update until ~200-300ms after the last keystroke (debounce works), (3) rapid keystrokes only trigger one filter pass after the debounce settles, (4) clearing the input resets results without debounce delay. Use fake timers (vi.useFakeTimers / jest.useFakeTimers) to control debounce timing precisely.
