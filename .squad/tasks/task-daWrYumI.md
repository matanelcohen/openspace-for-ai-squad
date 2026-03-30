---
id: task-daWrYumI
title: Expand skill test coverage for new capabilities
status: pending
priority: P1
assignee: zoidberg
labels:
  - skills
  - testing
  - QA
  - coverage
  - 'parent:task-OCFIYeWW'
created: '2026-03-26T15:16:09.733Z'
updated: '2026-03-30T14:41:32.654Z'
sortIndex: 194
---
Write tests for all new functionality added by other sub-tasks: (1) API endpoint tests for new CRUD routes (deactivate, delete, update), (2) error recovery & retry logic tests (retry exhaustion, backoff timing, circuit breaker thresholds), (3) version upgrade path tests (migration, rollback, constraint validation), (4) E2E tests for skill config UI (render config form, save, load persisted config), (5) integration test for full upgrade workflow. Target the existing test patterns in apps/api/src/services/skill-registry/__tests__/.

---
⏭️ YOLO skipped: P1 depends on other sub-tasks finishing first (new CRUD routes, error recovery logic). Cannot write tests for functionality that doesn't exist yet.

---
⏭️ YOLO skipped: P1 but depends on other sub-tasks completing first (new CRUD routes, retry logic). Zoidberg is also busy.

---
⏭️ YOLO skipped: Depends on other sub-tasks (new CRUD routes, retry logic) being completed first. Also needs Zoidberg who is busy.
