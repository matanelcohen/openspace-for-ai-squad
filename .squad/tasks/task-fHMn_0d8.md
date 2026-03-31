---
id: task-fHMn_0d8
title: Replace binary theme toggle with theme selector dropdown
status: pending
priority: P0
assignee: fry
labels:
  - theme
  - ui
  - component
  - 'parent:task-y3BEyz6t'
created: '2026-03-31T09:27:50.629Z'
updated: '2026-03-31T09:27:50.629Z'
sortIndex: 299
---
In apps/web/src/components/layout/top-bar.tsx, replace the Sun/Moon binary toggle with a dropdown/popover theme selector that shows all available themes (Light, Dark, Ocean, Sunset, High Contrast, System). Use existing shadcn/ui DropdownMenu or Popover components. Each option should show a color preview swatch and the theme name. Highlight the currently active theme. Keep keyboard accessibility and aria labels.
