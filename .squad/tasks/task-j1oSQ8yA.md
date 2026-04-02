---
id: task-j1oSQ8yA
title: Add reconnecting banner and toast notifications
status: pending
priority: P1
assignee: fry
labels:
  - 'parent:task-Skcn1CvO'
created: '2026-04-02T00:57:33.714Z'
updated: '2026-04-02T01:24:39.352Z'
sortIndex: 569
parent: task-Skcn1CvO
dependsOn:
  - task-CmJ2q73l
description: >
  Install sonner (pnpm add sonner in apps/web). Wire <Toaster /> into the root
  layout (apps/web/src/app/layout.tsx or
  apps/web/src/components/app-layout.tsx). Create a new component
  apps/web/src/components/reconnecting-banner.tsx that uses useWsConnection() to
  detect isConnected === false and renders an amber/warning banner similar to
  the existing systemError banner in app-layout.tsx (use AlertTriangle icon,
  'Connection lost — reconnecting…' text, animate-pulse dot). Mount it in
  app-layout.tsx above the existing systemError banner. Add toast calls: (1)
  toast.error when an optimistic chat message rollback happens, (2)
  toast.success('Reconnected') when connection restores after being lost, (3)
  toast.error on voice session failures. Use Tailwind classes consistent with
  existing design.



  ---

  **[2026-04-02 01:24:39]** ⚠️ Task was stuck in-progress after server restart.
  Reset to pending.
---
Install sonner (pnpm add sonner in apps/web). Wire <Toaster /> into the root layout (apps/web/src/app/layout.tsx or apps/web/src/components/app-layout.tsx). Create a new component apps/web/src/components/reconnecting-banner.tsx that uses useWsConnection() to detect isConnected === false and renders an amber/warning banner similar to the existing systemError banner in app-layout.tsx (use AlertTriangle icon, 'Connection lost — reconnecting…' text, animate-pulse dot). Mount it in app-layout.tsx above the existing systemError banner. Add toast calls: (1) toast.error when an optimistic chat message rollback happens, (2) toast.success('Reconnected') when connection restores after being lost, (3) toast.error on voice session failures. Use Tailwind classes consistent with existing design.
