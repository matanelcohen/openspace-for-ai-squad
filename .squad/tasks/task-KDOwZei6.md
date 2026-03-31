---
id: task-KDOwZei6
title: Add tests for team member seeding and data display
status: done
priority: P1
assignee: zoidberg
labels:
  - testing
  - team-members
  - e2e
  - unit-test
  - 'parent:task-Mfqbvb2z'
created: '2026-03-24T19:53:28.987Z'
updated: '2026-03-31T21:51:04.698Z'
sortIndex: 23
---
Add unit tests for the new seed/sync logic in the TeamMemberService. Update apps/api/src/routes/team-members.test.ts to cover the sync endpoint. Update e2e/team-members.spec.ts to verify team members appear on page load after seeding. Test edge cases: re-seeding doesn't duplicate, deleted members can be re-synced, FTS5 index is updated after seed.
