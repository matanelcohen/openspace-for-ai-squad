---
id: task--UGSldAl
title: Verify and fix team member UI rendering with real data
status: done
priority: P0
assignee: fry
labels:
  - bug
  - frontend
  - ui
  - team-members
  - 'parent:task-Mfqbvb2z'
created: '2026-03-24T19:53:28.985Z'
updated: '2026-03-31T21:51:04.695Z'
sortIndex: 22
---
Once seed data is available, verify the team members page (apps/web/app/team-members/page.tsx) renders correctly in both grid and table views. Check that useTeamMembers() hook in apps/web/src/hooks/use-team-members.ts properly fetches and displays data. Improve the empty state messaging to guide users to add members or trigger a sync if the table is empty. Verify avatar, department overview stats, and filters all work with seeded data.
