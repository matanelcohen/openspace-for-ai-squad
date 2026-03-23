# Project Context

- **Owner:** Matanel Cohen
- **Project:** openspace.ai — A human-AI squad management tool that allows humans to interact with AI squads, manage tasks, rank priorities, and have voice conversations with AI agents to make human-AI collaboration better.
- **Stack:** TBD
- **Created:** 2026-03-23

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

- **2026-03-23 — PRD authored.** Wrote the full Product Requirements Document at `docs/prd.md`. The project vision is clear: openspace.ai is a UI layer over the existing `.squad/` file system, not a replacement for it. The hardest design constraint is that `.squad/` is the source of truth and the backend must have direct file system access to it — this constrains deployment to same-machine or mounted-FS setups.
- **2026-03-23 — Scope discipline is critical.** Matanel's vision is broad (voice, task management, dashboards, chat, decisions). I scoped v1 to six core features and explicitly deferred mobile, multi-squad, analytics, marketplace, and SaaS infrastructure. The team must hold this line.
- **2026-03-23 — Seven open technical decisions identified.** The biggest are: monorepo vs. multi-repo (D1), how tasks map to `.squad/` files (D4), and where chat history lives (D7). These block implementation and need team resolution before feature work starts.
- **2026-03-23 — Voice is the differentiator.** Many tools offer dashboards and task boards. The voice interface — talking to agents with personality-distinct voices — is what makes openspace.ai unique. It must ship in v1, not be deferred.
