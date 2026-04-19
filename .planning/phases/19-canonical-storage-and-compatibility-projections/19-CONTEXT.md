# Phase 19: Canonical Storage and Compatibility Projections - Context

**Gathered:** 2026-04-19  
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 19 turns the Phase 18 contracts into usable storage and compatibility seams without cutting runtime behavior over yet:

- make canonical purchase/draw/attempt repositories truly usable for persistence and reads;
- introduce compatibility projections so current request/ticket/admin surfaces can keep reading stable shapes;
- keep the current Big 8 working contour alive while canonical truth starts sitting underneath it;
- make local seed/start/reset safe against the additive schema.

This phase does **not** move submit/queue/worker execution onto canonical storage yet. It also does **not** remove legacy tables or replace TTL locking / queue transport.
</domain>

<decisions>
## Locked

- Phase 18 canonical tables and contracts are the base; Phase 19 must build on them, not redesign them.
- Legacy `purchase_request`, `ticket`, `ticket_verification_job`, `draw_closure`, and TTL lock models remain intact in this phase.
- Compatibility must preserve the current cashier/admin/user read contour while storage truth becomes canonical.
- No `pg-boss`, outbox transport swap, or worker cutover in this phase.
- Additive-first migration discipline still applies: no destructive rewrites, no legacy table renames, no replay that mutates production truth blindly.

### the agent's Discretion

- Exact projection boundary: application service, adapter helper, SQL view, or repository-level mapper, as long as the current read surfaces stay truthful and the canonical storage remains explicit.
- Whether compatibility is fed through SQL projections, in-memory mapping helpers, or dedicated query services, as long as it is testable and migration-safe.
</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/phases/18-canonical-purchase-and-draw-contracts/18-CONTEXT.md`
- `.planning/phases/18-canonical-purchase-and-draw-contracts/18-01-SUMMARY.md`
- `.planning/phases/18-canonical-purchase-and-draw-contracts/18-VERIFICATION.md`
- `packages/domain/src/purchase-request.ts`
- `packages/domain/src/draw.ts`
- `packages/domain/src/terminal-attempt.ts`
- `packages/application/src/services/purchase-request-query-service.ts`
- `packages/application/src/services/ticket-query-service.ts`
- `packages/application/src/services/admin-operations-query-service.ts`
- `apps/web/src/lib/purchase/purchase-runtime.ts`
- `packages/infrastructure/src/postgres/postgres-purchase-store.ts`
- `packages/infrastructure/src/postgres/postgres-schema.ts`
</canonical_refs>

<code_context>
## Existing Code Insights

- Canonical Postgres stores exist only as additive skeletons; current runtime factories still instantiate only legacy request/ticket/queue stores.
- Current user/admin read surfaces derive truth from `PurchaseRequestStore`, `PurchaseQueueStore`, and `TicketStore`, so compatibility cannot be hand-waved.
- The schema now has canonical tables, but there is no backfill-safe projection path yet from canonical purchase/draw/attempt into today's request/ticket/admin views.
- Test reset and local startup flows still assume the legacy runtime contour is the only source of truth.
</code_context>

<deferred>
## Deferred Ideas

- Worker submit/execution cutover to canonical purchase state
- Canonical draw control cutover for admin result publication
- Advisory locks / transport replacement
- Legacy write-model removal
</deferred>

---

*Phase: 19-canonical-storage-and-compatibility-projections*  
*Context gathered: 2026-04-19*
