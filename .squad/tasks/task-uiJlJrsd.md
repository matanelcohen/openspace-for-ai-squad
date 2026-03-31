---
id: task-uiJlJrsd
title: 'Refactor hardcoded dark: classes to use CSS variables'
status: pending
priority: P1
assignee: fry
labels:
  - theme
  - refactor
  - components
  - 'parent:task-y3BEyz6t'
created: '2026-03-31T09:27:50.667Z'
updated: '2026-03-31T09:27:50.667Z'
sortIndex: 300
---
Audit and refactor components that use hardcoded Tailwind dark: prefix classes (e.g., dark:text-green-400, dark:bg-green-900/30) to instead use the semantic CSS variable-based colors (text-primary, bg-secondary, etc.) so they automatically adapt to any theme. Key files: confidence-badge.tsx, tasks/[id]/page.tsx, team-members/[id]/page.tsx, settings/page.tsx, escalations/config/page.tsx, and all components in src/components/ui/ and src/components/escalations/. Some dark: usage (like icon animations) can remain.
