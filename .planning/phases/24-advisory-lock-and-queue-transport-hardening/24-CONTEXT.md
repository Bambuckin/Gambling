# Phase 24: Advisory Lock and Queue Transport Hardening - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning
**Source:** inline execution context from the current session

<domain>
## Phase Boundary

- Replace TTL-based terminal exclusivity with a database-native advisory-lock style boundary.
- Keep queue send/receive semantics behind a replaceable transport seam instead of binding application flow directly to the current queue table shape.
- Preserve the current manual smoke contour, current routes, and current UI contracts unless a narrow runtime change is required to keep the contour truthful.
- Keep the change additive and local; do not start legacy-model removal in this phase.

</domain>

<decisions>
## Implementation Decisions

### Locked decisions

- Phase 24 must keep the current working contour manually testable.
- Exclusive terminal execution must stop depending on `expires_at` / TTL lock-table takeover semantics.
- The worker must hold exclusivity safely across long-lived external terminal I/O.
- Queue transport must become replaceable behind a stable application boundary while the current storage-backed backend remains the active implementation.
- Current admin/user/receiver route contracts must stay stable unless a minimal compatibility adjustment is required.
- Legacy write-model removal is explicitly out of scope for this phase.

### The agent's discretion

- Whether the advisory lock key is derived from one bigint or a deterministic pair of int keys, as long as the lock is Postgres-native and crash-safe.
- Whether the replaceable queue seam is implemented by specializing the existing generic queue port or by adding a new purchase-specific transport port, as long as the application layer stops depending on raw queue-table semantics for send/receive flow.
- Whether compatibility diagnostics keep reading the old queue table directly or switch to the new transport boundary, as long as the current operator/manual contour remains understandable.

</decisions>

<canonical_refs>
## Canonical References

**Downstream work must read these before implementation.**

### Phase and migration state
- `AGENTS.md` - repo operating rules, Sofia persona, and GSD workflow requirement
- `.planning/STATE.md` - current milestone/phase state
- `.planning/ROADMAP.md` - Phase 24 goal and success criteria
- `.planning/phases/23-admin-receiver-and-user-read-models/23-01-SUMMARY.md` - exact Phase 23 handoff boundary
- `.planning/REQUIREMENTS.md` - `CONS-09`
- `ARCHITECTURE.md` - current runtime/data-flow contract

### Current runtime code
- `packages/application/src/services/purchase-execution-queue-service.ts` - reserve/release flow and stale executing-item repair
- `packages/application/src/services/purchase-orchestration-service.ts` - submit-side enqueue path
- `packages/application/src/services/terminal-execution-attempt-service.ts` - retry requeue / completion dequeue path
- `packages/application/src/ports/terminal-execution-lock.ts` - current exclusivity port
- `packages/application/src/ports/purchase-queue-store.ts` - current queue storage contract
- `packages/application/src/ports/queue.ts` - existing generic queue abstraction candidate
- `packages/infrastructure/src/postgres/postgres-purchase-store.ts` - current Postgres queue + TTL lock adapters
- `packages/infrastructure/src/purchase/in-memory-terminal-execution-lock.ts` - in-memory lock adapter
- `packages/infrastructure/src/purchase/in-memory-purchase-queue-store.ts` - in-memory queue store
- `apps/terminal-worker/src/main.ts` - worker reservation loop and runtime wiring
- `apps/web/src/lib/purchase/purchase-runtime.ts` - web runtime wiring
- `scripts/runtime-queue-doctor.ts` - current lock/queue diagnostics

</canonical_refs>

<specifics>
## Specific Ideas

- Keep manual smoke unchanged: `/lottery/bolshaya-8`, `/admin`, `/terminal/receiver` must remain usable without a contour rewrite.
- Prefer a wrapper/adapter seam over a transport rewrite; the current queue backend stays active in this phase.
- Crash/restart safety matters more than removing old artifacts aggressively.

</specifics>

<deferred>
## Deferred Ideas

- Removing legacy lock table artifacts completely.
- Removing legacy queue/read-model storage completely.
- Starting the Phase 25 regression-hardening / legacy-removal wave.

</deferred>

---

*Phase: 24-advisory-lock-and-queue-transport-hardening*  
*Context gathered: 2026-04-21 via inline session handoff*
