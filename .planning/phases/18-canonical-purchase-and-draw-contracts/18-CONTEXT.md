# Phase 18: Canonical Purchase and Draw Contracts - Context

**Gathered:** 2026-04-19  
**Status:** Ready for execution

<domain>
## Phase Boundary

Phase 18 establishes the canonical runtime truth model without performing a big-bang cutover:

- define `purchase` as the canonical business write model for ticket truth;
- define `draw` as the canonical write model for draw lifecycle and result publication timing;
- define `purchase_attempt` as the durable execution-attempt journal;
- add additive storage groundwork and invariants without deleting the current legacy write models.

This phase does **not** move the full submit/worker/runtime flow yet. It also does **not** replace queue transport with `pg-boss` yet.
</domain>

<decisions>
## Implementation Decisions

### Locked
- `purchase` is the canonical write truth for ticket state.
- `draw` is the canonical write truth for draw state.
- Purchase execution state is separate from result state and result visibility.
- `ticket` remains a compatibility read model during the migration.
- Migration is additive first; no destructive legacy removal in this phase.
- `purchase_attempt` must be explicit durable data, not only text inside request journal notes.
- `draw` lifecycle is `open -> closed -> settled`.
- `pg-boss` and outbox work are deferred until after canonical truth exists and current behavior is preserved.

### the agent's Discretion
- Exact TypeScript type names and helper boundaries, as long as they keep domain rules explicit and keep legacy exports compiling during the migration.
- Exact repository split between purchase/draw/attempt stores, as long as canonical storage is not hidden inside unrelated legacy store APIs.
</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `ARCHITECTURE.md`
- `packages/domain/src/purchase-request.ts`
- `packages/domain/src/request-state.ts`
- `packages/domain/src/draw.ts`
- `packages/domain/src/ticket.ts`
- `packages/domain/src/terminal-attempt.ts`
- `packages/application/src/services/purchase-orchestration-service.ts`
- `packages/application/src/services/terminal-execution-attempt-service.ts`
- `packages/application/src/services/draw-closure-service.ts`
- `packages/infrastructure/src/postgres/postgres-schema.ts`
- `packages/infrastructure/src/postgres/postgres-purchase-store.ts`
- `apps/terminal-worker/src/main.ts`
- `apps/web/src/lib/purchase/purchase-runtime.ts`
</canonical_refs>

<code_context>
## Existing Code Insights

- Current runtime truth is split across `PurchaseRequestRecord`, queue item, `TicketRecord`, verification job, draw closure, and TTL lock state.
- Worker already has a stable execution loop, so the first migration step should change truth models before it changes transport.
- Admin result flow already exists, but draw closure and result visibility are still coupled too tightly to legacy ticket truth.
- Current web/admin surfaces are working; they must survive through compatibility projections rather than through a rewrite.
</code_context>

<deferred>
## Deferred Ideas

- Full submit/worker cutover to canonical purchase storage
- Advisory-lock replacement and transport migration (`pg-boss` / outbox)
- Legacy ticket / verification-job / lock-table removal
- UI redesign beyond the current simplified contour
</deferred>

---

*Phase: 18-canonical-purchase-and-draw-contracts*  
*Context gathered: 2026-04-19*
