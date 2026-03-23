# Squad Decisions

## Active Decisions

### 2026-03-23T20:42:00Z: PRD created for openspace.ai
**By:** Leela (Lead)
**What:** Created `docs/prd.md`, the v1 Product Requirements Document for openspace.ai. It defines the product vision, six core features, architecture, non-goals, success metrics, and seven open decisions.
**Why:** The team needed a shared source of truth for scope, architecture, and prioritization before implementation.
**Impact:** All agents should read `docs/prd.md` before starting feature work, and the open decisions in 8 require follow-up resolution.

### 2026-03-23T20:50:00Z: Execution plan created from PRD
**By:** Leela (Lead)
**What:** Created `docs/execution-plan.md`, a 6-phase execution plan with 43 actionable work items, dependencies, agent assignments, and complexity estimates.
**Why:** The PRD needed to be decomposed into executable work with a clear critical path and explicit parallelism opportunities.
**Impact:** Phase 0 can begin immediately, Phases 2 and 3 can run in parallel after the data layer, and voice remains sequenced after chat.

### 2026-03-23T20:50:30Z: Model usage directive
**By:** Matanel Cohen (via Copilot)
**What:** Squad is only allowed to use `claude-opus-4.6` and `gpt-5.4`. No other models are permitted.
**Why:** User directive captured for team memory.

### 2026-03-23T20:56:17Z: Voice chat product directive
**By:** Matanel Cohen (via Copilot)
**What:** The voice interface must be real-time voice chat like ChatGPT voice mode, not push-to-talk commands. The user talks naturally with the full squad in a group conversation, agents respond by voice, and the squad can take actions from voice conversations.
**Why:** User clarified the core product vision. Voice is the differentiator.

### 2026-03-23T20:57:00Z: D1 and D2 resolved
**By:** Matanel Cohen (via Copilot)
**What:** D1 was resolved in favor of a monorepo. D2 was resolved in favor of Fastify for the backend. Both blocking Phase 0 decisions are now closed.
**Why:** User accepted Leela's recommendations and unblocked implementation.
**Impact:** P0-1 can start immediately.

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
