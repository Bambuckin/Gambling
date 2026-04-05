# Phase 9: Hardening, Extension Docs, and Release Readiness - Context

**Gathered:** 2026-04-06  
**Status:** Ready for execution  
**Source:** Resume state + roadmap + requirements

<domain>
## Phase Boundary

Phase 9 closes v1 with documentation hardening and release discipline:
- align architecture/module/data-flow docs with actual code boundaries;
- define per-module local verification map for partial and regression checks;
- formalize lottery handler extension workflow and operator actions;
- add release readiness checklist with one-command regression coverage.
</domain>

<decisions>
## Implementation Decisions

### Locked
- Phase 9 is documentation and release hardening only; no behavior change in purchase/queue/ledger flows.
- Module ownership must remain anchored to `docs/modules/boundary-catalog.md`.
- Verification guidance must be runnable locally per module and for cross-module critical flows.
- Lottery handler extension docs must include both developer and operator steps.
- Release readiness must include deterministic command list and pass/fail gate.

### the agent's Discretion
- Exact document split and naming as long as links stay explicit and cross-referenced.
- Whether release checks are shell script, npm script, or both.
</decisions>

<canonical_refs>
## Canonical References

### Scope and requirements
- `.planning/ROADMAP.md` - Phase 9 goal, success criteria, and plan sequence
- `.planning/REQUIREMENTS.md` - `DOCS-01`, `DOCS-02`, `DOCS-03`
- `.planning/STATE.md` - continuity and current position

### Existing documentation anchors
- `ARCHITECTURE.md` - top-level architecture skeleton
- `docs/README.md` - docs index
- `docs/modules/README.md` - module boundary entrypoint
- `docs/modules/boundary-catalog.md` - source-of-truth ownership and integration boundaries
- `docs/modules/lottery-handler-extension.md` - current extension guide
- `docs/runbooks/README.md` - runbook index
- `docs/runbooks/*.md` - existing phase runbooks

### Existing code anchors for documentation reconciliation
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/app/debug/admin-ops-lab/page.tsx`
- `apps/terminal-worker/src/main.ts`
- `packages/application/src/services/*.ts`
- `packages/domain/src/*.ts`
- `packages/infrastructure/src/**/*.ts`
- `packages/lottery-handlers/src/*.ts`
</canonical_refs>

<specifics>
## Specific Ideas

- `09-01`: harden architecture/module/data-flow docs and remove stale placeholders.
- `09-02`: create module verification matrix and partial regression recipes.
- `09-03`: finalize lottery-handler extension + operator runbook.
- `09-04`: add release-readiness checklist + scripted regression gate, then close phase artifacts.
</specifics>

<deferred>
## Deferred Ideas

- External CI/CD release automation remains out of scope for v1 local readiness.
</deferred>

---

*Phase: 09-hardening-extension-docs-and-release-readiness*  
*Context gathered: 2026-04-06*
