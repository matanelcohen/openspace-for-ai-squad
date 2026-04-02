---
id: task-eNc_c-3b
title: Test ingestion-status timer fix
status: pending
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-Xh6T9Wt2'
created: '2026-04-02T11:14:45.553Z'
updated: '2026-04-02T11:14:45.555Z'
sortIndex: 102
parent: task-Xh6T9Wt2
dependsOn:
  - task-DN-ty4y5
---
Write or update tests for the ingestion-status component to verify:
1. **No timer leaks on unmount**: Mount the component, trigger `handleIngest`, then unmount before timers fire — assert no warnings about setState on unmounted components and that all timers are cleared.
2. **Single cleanup path**: Trigger ingestion and let polling complete — verify `setIngesting(false)` is called exactly once, not multiple times from competing timeouts.
3. **Safety timeout works**: Mock the polling to never succeed — verify the safety timeout eventually stops polling and sets `ingesting` to false.
4. **Happy path**: Mock successful ingestion detection — verify polling stops, interval is cleared, and state updates correctly.

Use `vi.useFakeTimers()` to control timer behavior. Check existing test patterns in the repo for conventions.
