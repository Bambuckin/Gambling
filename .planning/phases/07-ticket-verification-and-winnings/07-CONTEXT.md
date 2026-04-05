# Phase 7: Ticket Verification and Winnings - Context

**Gathered:** 2026-04-05  
**Status:** Ready for execution  
**Source:** Resume state + roadmap + requirements

<domain>
## Phase Boundary

Phase 7 connects completed terminal purchases to post-draw outcomes:
- persist ticket records immediately after successful purchase execution;
- run ticket verification through deterministic terminal handlers after draw availability;
- normalize verification outcome and winning amount onto ticket state;
- credit winnings through ledger with idempotent references.
</domain>

<decisions>
## Implementation Decisions

### Locked
- A request that reaches `success` must produce exactly one persistent ticket record, linked by `requestId` and `drawId`.
- Ticket persistence must stay idempotent for retries/replays (no duplicate ticket records for the same request).
- Ticket verification and winnings updates must stay behind application service boundaries; runtime apps must not own result normalization.
- Ticket records must carry enough fields for next plans: purchase status, verification status, verification raw output, and winning amount.
- Verification and ticket inspection UI must stay in a dedicated verification contour, not an operator mutation surface.

### the agent's Discretion
- Ticket id format and fallback external reference strategy when terminal output lacks explicit reference.
- Trigger model for verification start (manual/scheduled) as long as it stays deterministic and testable.
- Projection shape for ticket read models consumed by web/debug routes.
</decisions>

<canonical_refs>
## Canonical References

**Downstream work must read these before editing.**

### Scope and requirements
- `.planning/ROADMAP.md` - Phase 7 goal, criteria, and plan sequence
- `.planning/REQUIREMENTS.md` - `TICK-01..TICK-04`, `BAL-04`
- `.planning/STATE.md` - continuity and current phase position

### Existing implementation anchors
- `packages/application/src/services/terminal-execution-attempt-service.ts` - success/retry/error transition ownership
- `packages/application/src/services/purchase-request-query-service.ts` - existing request status projection patterns
- `packages/application/src/services/wallet-ledger-service.ts` - immutable money mutation + idempotency boundary
- `packages/application/src/ports/terminal-executor.ts` - terminal result contract shape
- `packages/domain/src/ticket.ts` - ticket domain contract seed
- `apps/terminal-worker/src/main.ts` - worker orchestration and attempt recording flow

### Architecture and risks
- `docs/modules/boundary-catalog.md` - ownership and forbidden crossings
- `.planning/research/ARCHITECTURE.md` - ticket-result module position in system flow
- `.planning/research/PITFALLS.md` - balance/request drift and idempotency risks
</canonical_refs>

<specifics>
## Specific Ideas

- `07-01` persists a ticket record on successful terminal purchase outcome and links it to request/draw/user.
- `07-02` introduces verification scheduling/trigger path that feeds tickets into terminal result checks without manual per-ticket execution.
- `07-03` normalizes verification result payload and performs winnings credit through ledger idempotency keys.
- `07-04` surfaces ticket outcome views for users and adds verification-focused test contour/runbook updates.
</specifics>

<deferred>
## Deferred Ideas

- Push notifications for result updates stay in v2 (`NOTF-01`).
- Admin-heavy observability for ticket pipelines stays in Phase 8.
</deferred>

---

*Phase: 07-ticket-verification-and-winnings*  
*Context gathered: 2026-04-05*
