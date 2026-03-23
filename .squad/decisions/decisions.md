# Decisions — openspace.ai

Master log of team decisions, scope calls, and design choices.

---

## Decision: PRD Created for openspace.ai

- **Author:** Leela (Lead)
- **Date:** 2026-03-23
- **Status:** Active

### What

The Product Requirements Document (PRD) for openspace.ai has been created at `docs/prd.md`. It defines the full v1 scope, architecture, target users, success metrics, and open decisions.

### Why

The team needs a single source of truth for what we're building, what's in scope, and what's deferred. Without a PRD, agents risk building in different directions.

### Key Scope Calls

- **v1 is web-only.** No mobile app. Responsive design is nice-to-have.
- **v1 is single-squad.** Multi-squad management is v2+.
- **`.squad/` is the source of truth.** The UI is a layer on top, not a replacement.
- **Voice is core, not optional.** It's a v1 feature, not a future nice-to-have.
- **No multi-tenant SaaS in v1.** Single-user/small-team on a single machine.

### Impact

- All agents should read `docs/prd.md` before starting feature work.
- Open decisions in §8 need team resolution before implementation begins.
- Fry should focus on frontend stack setup (Next.js + React).
- Bender should focus on the backend API and `.squad/` file system integration.

### Location

`docs/prd.md`

---

*Last updated: 2026-03-23*
