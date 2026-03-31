---
id: task-mYlNALLD
title: Define multi-theme CSS variable palettes in globals.css
status: pending
priority: P0
assignee: fry
labels:
  - theme
  - css
  - design-tokens
  - 'parent:task-y3BEyz6t'
created: '2026-03-31T09:27:50.532Z'
updated: '2026-03-31T09:27:50.532Z'
sortIndex: 297
---
Add new theme classes alongside existing :root and .dark in apps/web/app/globals.css. Create at least 3 additional themes (e.g., .theme-ocean, .theme-sunset, .theme-high-contrast) using the same HSL CSS variable tokens (--background, --foreground, --primary, --secondary, --accent, --destructive, --muted, --border, --sidebar, etc.). Each theme should have a cohesive color palette. Keep :root as 'light' and .dark as-is for backward compatibility.
