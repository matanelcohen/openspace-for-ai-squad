---
id: task-NIgWydd1
title: Update ThemeProvider and layout to support multiple themes
status: pending
priority: P0
assignee: bender
labels:
  - theme
  - provider
  - config
  - 'parent:task-y3BEyz6t'
created: '2026-03-31T09:27:50.584Z'
updated: '2026-03-31T09:27:50.584Z'
sortIndex: 298
---
Modify apps/web/src/components/providers/theme-provider.tsx and apps/web/app/layout.tsx to support multiple named themes. next-themes already supports custom theme names via the 'themes' prop — pass an array like ['light','dark','ocean','sunset','high-contrast']. Update the attribute strategy if needed. Ensure theme persistence in localStorage and system preference fallback still work. Update tailwind.config.ts darkMode to use data-attribute strategy [class, '[data-theme]'] if needed for non-dark themes.
