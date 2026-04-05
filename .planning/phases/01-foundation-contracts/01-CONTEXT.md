# Phase 1: Foundation Contracts - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 establishes the technical and documentary foundation for the whole system: stack decision, repository shape, module contracts, stub-capable ports, and local verification scaffolding. It does not implement real purchase, draw, balance, or admin features yet; it creates the structure those later phases will build on.

</domain>

<decisions>
## Implementation Decisions

### Repository Shape
- **D-01:** Use one repository with separate runtime apps and shared packages so the UI, execution worker, and domain logic can evolve independently.
- **D-02:** Planned top-level shape is `apps/`, `packages/`, `docs/`, and `.planning/`, with runtime-specific code isolated from shared business logic.

### Stack Decision Rules
- **D-03:** Phase 1 must explicitly choose and document one TypeScript-first stack in an ADR before broad scaffolding starts.
- **D-04:** The selected stack must support a transactional relational store, a durable single-worker queue strategy, browser automation adapters, and strong local testing ergonomics.

### Module Contracts
- **D-05:** Define core contracts before feature coding: request state machine, ledger operations, lottery registry schema, draw snapshot model, terminal execution port, and ticket verification port.
- **D-06:** Every external dependency boundary must be stub-capable so later phases can run without the production terminal.

### Verification Strategy
- **D-07:** Phase 1 must create a local smoke path driven by fake terminal adapters and fake lottery handlers.
- **D-08:** Verification notes are mandatory artifacts for each module, not optional follow-up docs.

### Documentation-First Working Mode
- **D-09:** Create ADRs, module-boundary docs, runbook skeletons, and repo entry-point docs during Phase 1, not after the scaffold exists.
- **D-10:** Future sessions must be able to resume from repository files alone; decisions that matter later must be written to disk immediately.

### the agent's Discretion
- Concrete framework, ORM, queue implementation, and test runner selection inside the Phase 1 ADR.
- Exact package names and script names after the stack ADR is chosen.
- Whether the web UI is split into multiple apps or one app with internal admin/user routing, as long as boundaries stay explicit.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope and requirements
- `.planning/PROJECT.md` — product scope, non-negotiables, constraints, and project-level decisions
- `.planning/REQUIREMENTS.md` — atomic requirement inventory and phase traceability
- `.planning/ROADMAP.md` — phase boundaries, success criteria, and phase plans list
- `.planning/STATE.md` — current project position and session continuity

### Project research
- `.planning/research/STACK.md` — stack selection criteria and recommended technical profile
- `.planning/research/ARCHITECTURE.md` — component boundaries and flow expectations
- `.planning/research/PITFALLS.md` — failure modes to avoid while shaping the foundation
- `.planning/research/SUMMARY.md` — condensed research direction for build order and system form

### Standing repository docs
- `README.md` — repo entry point for future sessions
- `docs/README.md` — documentation map and session-independence rule
- `docs/adr/ADR-000-project-principles.md` — fixed project principles
- `docs/modules/README.md` — provisional module boundary list
- `docs/runbooks/README.md` — runbook expectations

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.planning/*` artifacts: the only real source of truth right now; future implementation must align with them.
- `AGENTS.md`: project instructions and GSD workflow enforcement for future sessions.
- `README.md` and `docs/*`: standing docs intended to remove session dependency.

### Established Patterns
- Planning-first workflow via GSD.
- One-terminal operational model is fixed.
- Documentation and handoff artifacts are treated as codebase assets.

### Integration Points
- Future scaffold should create `apps/` for runtime surfaces and `packages/` for shared logic.
- Terminal automation must plug into a dedicated worker layer, not into the web app.
- Fake adapters and test fixtures must be introduced early enough that later phases can verify behavior locally.

</code_context>

<specifics>
## Specific Ideas

- The user explicitly wants the repository organized so another session using GPT-5.3-Codex can continue from files alone.
- Modular delivery and partial verification are hard requirements, not preferences.
- Full documentation is part of the implementation contract.

</specifics>

<deferred>
## Deferred Ideas

- Concrete purchase UX details belong to later phases once access and registry foundations exist.
- Concrete admin dashboard views belong to Phase 8.
- Multiple active terminals, public payment flows, and proactive notifications remain out of scope for v1.

</deferred>

---

*Phase: 01-foundation-contracts*
*Context gathered: 2026-04-05*
