---
id: task-Ldt9Qj2w
title: Refactor all detail and list pages to use shared components
status: in-progress
priority: P2
assignee: fry
labels:
  - 'parent:task-kx-cbz6F'
created: '2026-04-02T01:59:13.022Z'
updated: '2026-04-02T01:59:13.382Z'
sortIndex: 588
parent: task-kx-cbz6F
dependsOn:
  - task--flFYp_d
---
Refactor all 7 detail pages and 2 list pages to use the new shared components:

**Detail pages to refactor (replace loading/error/content guards with `<DetailPageLayout>`):**
1. `/apps/web/app/tasks/[id]/page.tsx` (726 lines) — backHref='/tasks', backLabel='Back to tasks', uses `useTask(id)`
2. `/apps/web/app/team-members/[id]/page.tsx` (672 lines) — backHref='/team-members', backLabel='Back to Team', uses `useTeamMember(id)`, has custom DetailSkeleton (pass as loadingContent)
3. `/apps/web/app/skills/[id]/page.tsx` (184 lines) — backHref='/skills', backLabel='Back to Skill Store', uses `useSkillDetail(id)`, currently uses LoadingSpinner
4. `/apps/web/app/skills/gallery/[id]/page.tsx` (202 lines) — backHref='/skills?tab=gallery', backLabel='Back to Gallery', uses `useGallerySkillDetail(id)`
5. `/apps/web/app/workflows/[id]/page.tsx` (196 lines) — backHref='/workflows', backLabel='Back to workflows', uses `useWorkflow({workflowId, executionId})`
6. `/apps/web/app/sandboxes/[id]/page.tsx` (42 lines) — backHref='/sandboxes', uses `useSandbox(sandboxId)`, has full-height spinner
7. `/apps/web/app/escalations/[id]/page.tsx` (40 lines) — Keep SquadGuard wrapper, replace inner loading/error with DetailPageLayout

**List pages to refactor (replace toggle with `<ViewModeToggle>`):**
1. `/apps/web/app/tasks/page.tsx` — Replace inline board/list toggle buttons with `<ViewModeToggle>`, keep LayoutGrid and List icons
2. `/apps/web/app/team-members/page.tsx` — Same toggle replacement

For each page: remove the inline loading/error guard code, replace with `<DetailPageLayout>` wrapping the content via render prop. Preserve all existing data-testid attributes. Keep all page-specific content and hooks unchanged. Only the guard pattern should be abstracted away.
