# Phase 6: Main Terminal Execution Engine - Context

**Gathered:** 2026-04-05  
**Status:** Ready for execution  
**Source:** Resume state + roadmap + requirements

<domain>
## Phase Boundary

Phase 6 turns queued purchase requests into terminal execution attempts:
- single-worker execution guard for one active request at a time;
- deterministic queue selection with admin-priority ordering;
- predefined handler resolution by lottery code and binding key;
- attempt journaling with raw terminal output and normalized result;
- retry/final-failure flow with observable terminal health state.
</domain>

<decisions>
## Implementation Decisions

### Locked
- Active execution ownership must be explicit (`lock`) and must not rely on route-level assumptions.
- Queue order remains deterministic: `admin-priority` before regular items not yet started; no interruption of an already executing request.
- Terminal logic is selected from predefined handler registry entries and never generated from request payload.
- Every attempt writes traceable metadata (`attempt`, `startedAt`, `finishedAt`, `rawOutput`, `outcome`, `retry metadata`) linked to request id.
- Retry policy decisions are centralized in application services, not in worker entrypoint script.
- Phase 6 must keep at least one local verification path with fake terminal adapter and without production terminal access.

### the agent's Discretion
- Lock adapter internals for local mode (in-memory vs file-backed) while preserving application lock contract.
- Polling cadence and worker loop tuning for local/dev runtime.
- Exact terminal-health projection shape as long as states stay `idle|busy|degraded|offline`.
</decisions>

<canonical_refs>
## Canonical References

**Downstream work must read these before editing.**

### Scope and requirements
- `.planning/ROADMAP.md` - Phase 6 goal, criteria, and plan sequence
- `.planning/REQUIREMENTS.md` - `TERM-01..TERM-06`
- `.planning/STATE.md` - phase continuity and current position

### Existing implementation anchors
- `packages/application/src/services/purchase-orchestration-service.ts` - queue insert/cancel boundary from Phase 5
- `packages/application/src/services/purchase-request-query-service.ts` - request and queue projections
- `packages/application/src/ports/purchase-queue-store.ts` - queue storage contract
- `packages/application/src/ports/terminal-executor.ts` - terminal execution contract
- `packages/domain/src/request-state.ts` - allowed request transitions
- `packages/lottery-handlers/src/contracts.ts` - deterministic lottery handler contracts
- `packages/test-kit/src/fake-terminal.ts` - local fake terminal adapter
- `apps/terminal-worker/src/main.ts` - worker runtime entrypoint

### Architecture and risks
- `docs/modules/boundary-catalog.md` - ownership and forbidden crossings
- `.planning/research/ARCHITECTURE.md` - module boundaries and primary flows
- `.planning/research/PITFALLS.md` - queue/terminal failure risks and mitigation expectations
</canonical_refs>

<specifics>
## Specific Ideas

- `06-01` introduces execution lock + queue reservation service and worker loop wiring.
- `06-02` creates deterministic handler registry and adapter boundary for lottery-code binding.
- `06-03` persists attempt-level terminal output and normalized result model.
- `06-04` applies retry and exhausted-failure transitions without losing audit trace.
- `06-05` adds terminal state projection and verification contour/runbook updates.
</specifics>

<deferred>
## Deferred Ideas

- Multi-terminal failover (`TERM-07`) remains v2 scope.
- Full production terminal/browser automation details stay behind adapter boundary and can iterate after Phase 6 baseline.
</deferred>

---

*Phase: 06-main-terminal-execution-engine*  
*Context gathered: 2026-04-05*
