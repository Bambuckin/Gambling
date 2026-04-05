# Phase 5: Purchase Request Orchestration - Context

**Gathered:** 2026-04-05  
**Status:** Ready for execution  
**Source:** Resume state + roadmap + requirements

<domain>
## Phase Boundary

Phase 5 converts lottery form input into an execution-ready request:
- lottery-specific parameter validation before confirmation;
- deterministic ticket pricing before any money movement;
- immutable request snapshot and state journal foundation;
- queue-ready/cancelable request lifecycle visible to the user.
</domain>

<decisions>
## Implementation Decisions

### Locked
- Validation and pricing run before request creation and are based on registry metadata (`formFields`, `pricing`).
- Purchase flow keeps draw freshness gate from Phase 3 and wallet reserve rules from Phase 4 as hard preconditions.
- Request state transitions continue through domain state-machine rules; route files do not own lifecycle logic.
- Any request payload used for confirmation/execution must be immutable after snapshot creation.
- User status visibility and test verification contour stay separate from core request orchestration services.

### the agent's Discretion
- Exact shape of validation error payloads and quote response DTOs.
- Whether pricing internals live in one domain module or split by strategy helper.
- Concrete UI wording and response messages while keeping status semantics stable.
</decisions>

<canonical_refs>
## Canonical References

**Downstream work must read these before editing.**

### Scope and requirements
- `.planning/ROADMAP.md` - Phase 5 goal, success criteria, plan sequence
- `.planning/REQUIREMENTS.md` - `PURC-01..PURC-06`
- `.planning/STATE.md` - continuity and current phase position

### Existing implementation anchors
- `apps/web/src/app/lottery/[lotteryCode]/page.tsx` - current purchase draft action
- `packages/domain/src/lottery-registry.ts` - form fields + pricing contracts
- `packages/domain/src/request-state.ts` - lifecycle transition rules
- `packages/application/src/services/lottery-registry-service.ts` - registry read boundary
- `packages/application/src/services/wallet-ledger-service.ts` - reserve/debit/release API

### Architecture and risks
- `docs/modules/boundary-catalog.md` - service ownership and forbidden crossings
- `.planning/research/FEATURES.md` - purchase and queue behavior intent
- `.planning/research/PITFALLS.md` - stale draw / duplicate request / money drift risks
</canonical_refs>

<specifics>
## Specific Ideas

- `05-01` should return a typed validation + pricing quote without side effects.
- Keep `05-02` confirmation snapshot immutable so `05-03` can reserve funds and enqueue without recalculating user payload.
- Introduce request-specific read model early enough to support `05-05` user status view.
</specifics>

<deferred>
## Deferred Ideas

- Terminal worker retry policy and final execution result normalization stay in Phase 6.
- Ticket persistence and winnings credit stay in Phase 7.
</deferred>

---

*Phase: 05-purchase-request-orchestration*  
*Context gathered: 2026-04-05*
