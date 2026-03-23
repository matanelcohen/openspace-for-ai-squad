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
- **2026-03-23 — Execution plan phasing.** Decomposed the PRD into 6 phases and 43 work items. Key insight: the `.squad/` file parser (Phase 1) is the true bottleneck — every feature reads from it. Phases 2 (Dashboard+Tasks) and 3 (Real-time+Chat) can run in parallel, which compresses the timeline significantly. Voice (Phase 4) must follow Chat (Phase 3) because voice reuses the chat message routing pipeline — building it independently would duplicate infrastructure. Auth is safely deferred to Phase 5 because v1 is single-user/local.
- **2026-03-23 — Decisions have deadlines now.** Mapped all 7 open decisions (D1–D7) to the specific work items they block. D1 (monorepo) and D2 (backend framework) must resolve immediately — they gate Phase 0. D4 (task format) blocks Phase 1. D3/D6 (voice) can wait until Phase 4. This gives the team a clear resolution schedule instead of "resolve all before starting."
- **2026-03-23 — Voice interface vision redesigned: push-to-talk → real-time group voice chat.** Matanel clarified the voice vision: it's not push-to-talk command-response, it's a continuous multi-party voice conversation with the full squad — like ChatGPT Advanced Voice mode for a group. Rewrote PRD §3.4 and §4.4, and rebuilt all Phase 4 work items. Key additions: multi-agent voice routing via Coordinator, shared conversation context across agents, voice-triggered action execution (voice commands create real tasks), and WebSocket-based streaming architecture (OpenAI Realtime API recommended). Phase 4 grew from 8 to 9 work items with higher complexity. This is the product's core differentiator — the extra complexity is justified.
