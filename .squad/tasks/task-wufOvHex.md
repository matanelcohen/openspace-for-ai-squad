---
id: task-wufOvHex
title: Add ARIA attributes and keyboard accessibility to core components
status: in-progress
priority: P1
assignee: fry
labels:
  - 'parent:task-cnoC89oM'
created: '2026-04-02T03:01:02.618Z'
updated: '2026-04-02T03:01:02.862Z'
sortIndex: 659
parent: task-cnoC89oM
dependsOn:
  - task-OKufm4XK
---
Improve keyboard accessibility and ARIA support across the frontend. Focus on highest-impact components:

**ARIA Enhancements:**
- `apps/web/src/components/ui/dialog.tsx` — Add `aria-modal`, `aria-labelledby`, `aria-describedby`
- `apps/web/src/components/ui/table.tsx` — Add `role="table"`, `role="row"`, `role="columnheader"` attributes
- `apps/web/src/components/notifications/notification-bell.tsx` — Add `aria-label` and `aria-live="polite"` for dynamic badge count
- Form dialogs (`task-form-dialog.tsx`, `team-member-form-dialog.tsx`, `skill-form-dialog.tsx`) — Add `aria-invalid`, `aria-describedby`, `aria-required` to form inputs with validation
- `apps/web/src/components/ui/collapsible.tsx` — Add `aria-expanded` to trigger

**Keyboard Accessibility:**
- Ensure all interactive elements (especially icon buttons and custom clickable divs) are focusable with proper `tabIndex` and `onKeyDown` handlers
- Verify focus-visible rings are consistent across all interactive components (15 files already have them, extend to remaining)
- Add focus trapping to modal dialogs if not already handled by Radix

**Reference:** The codebase already uses @radix-ui (good WCAG AA foundation) and has an accessibility reference guide at `.squad/skills/web-coder/references/accessibility.md`. Build on these patterns. The sidebar and top-bar already have good ARIA — use them as examples.
