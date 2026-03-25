# Pending-Approval Workflow

> **Status:** Active
> **Last Updated:** 2026-03-25

---

## Overview

`pending-approval` is a task status that acts as a **human-in-the-loop gate** for AI-generated sub-tasks. When the system automatically breaks down a backlog task into smaller pieces, each sub-task is created with `pending-approval` status. This ensures a human reviews and approves AI-proposed work before any agent begins executing it.

---

## Task Status Lifecycle

openspace.ai tasks move through the following statuses:

| Status | Label | Description |
|--------|-------|-------------|
| `pending-approval` | Pending Approval | AI-generated sub-task awaiting human review |
| `backlog` | Backlog | Approved and ready for agent pickup |
| `in-progress` | In Progress | Agent is actively working on the task |
| `in-review` | In Review | Work is complete and awaiting review |
| `done` | Done | Task is finished |
| `blocked` | Blocked | Task cannot proceed due to a dependency or issue |

### Status Flow Diagram

```
User creates task (status: backlog)
        │
        ▼
  ┌─────────────┐     AI breaks task into 2–5 sub-tasks
  │   backlog    │────────────────────────────────────────┐
  └─────┬───────┘                                        │
        │                                                ▼
        │                                  ┌──────────────────────┐
        │                                  │  pending-approval     │
        │                                  │  (sub-tasks created)  │
        │                                  └──────┬───────┬───────┘
        │                                         │       │
        │                                    Approve    Reject
        │                                         │       │
        │                                         ▼       ▼
        │                                      backlog  DELETED
        │◄────────────────────────────────────────┘
        │
        ▼
  ┌─────────────┐
  │ in-progress  │
  └─────┬───────┘
        │
        ▼
  ┌─────────────┐
  │  in-review   │
  └─────┬───────┘
        │
        ▼
  ┌─────────────┐
  │    done      │
  └─────────────┘
```

> Tasks can also move to `blocked` from any active status and back to `backlog` when unblocked.

---

## How It Works

### 1. Task Breakdown (Trigger)

When a user creates a task with `status: backlog`, the API automatically triggers an AI-powered breakdown:

- The system calls the AI provider to decompose the task into **2–5 actionable sub-tasks**.
- Each sub-task is assigned to the most appropriate agent based on expertise (e.g., Fry for frontend, Bender for backend, Zoidberg for testing).
- Sub-tasks are created with `status: 'pending-approval'` and labeled with `parent:<parentTaskId>` to link them back to the original task.

This happens asynchronously — the parent task is returned immediately while breakdown runs in the background.

### 2. Human Review

Pending-approval tasks appear on the task board in their own column with distinct **amber/yellow styling** so they stand out. Each card displays:

- The AI-proposed title and description
- The suggested assignee (agent)
- The suggested priority
- **Approve** (green ✓) and **Reject** (red ✗) action buttons

### 3. Approve

When a user clicks **Approve**:

1. The API validates the task is in `pending-approval` status.
2. The task status is updated to `backlog`.
3. If the task has an assigned agent, it is **enqueued for the agent to pick up** and begin working on automatically.

**API:** `PATCH /api/tasks/:id/approve`

### 4. Reject

When a user clicks **Reject**:

1. The API validates the task is in `pending-approval` status.
2. The task is **permanently deleted**.

The rejection is optimistic on the frontend — the task card disappears immediately, with a rollback if the API call fails.

**API:** `PATCH /api/tasks/:id/reject`

---

## API Reference

| Endpoint | Method | Description | Success Response |
|----------|--------|-------------|------------------|
| `/api/tasks/:id/approve` | `PATCH` | Approve a pending task → moves to `backlog` | `200` with updated task |
| `/api/tasks/:id/reject` | `PATCH` | Reject a pending task → deletes it | `204` No Content |

Both endpoints return `400 Bad Request` if the task is not in `pending-approval` status.

---

## Key Files

| File | Role |
|------|------|
| `packages/shared/src/types/task.ts` | `TaskStatus` type definition |
| `packages/shared/src/constants/index.ts` | Status list and display labels |
| `apps/api/src/routes/tasks.ts` | Approve/reject API endpoints |
| `apps/api/src/services/task-breakdown/index.ts` | AI-powered sub-task generation |
| `apps/web/src/hooks/use-tasks.ts` | `useApproveTask` / `useRejectTask` hooks |
| `apps/web/src/components/tasks/task-card.tsx` | Approve/reject UI buttons |

---

## Design Decisions

- **Why gate AI sub-tasks?** Automatic task breakdown is powerful but not infallible. The pending-approval gate lets humans catch bad decompositions, adjust scope, or reject irrelevant sub-tasks before agents spend time on them.
- **Why delete on reject (not archive)?** Rejected sub-tasks are AI proposals that the user deemed unnecessary. Keeping them would clutter the task list. If the user wants a different breakdown, they can re-create the parent task.
- **Why optimistic UI for rejection?** Since rejection is destructive and users rarely undo it, removing the card instantly feels snappier. The rollback mechanism protects against network failures.
