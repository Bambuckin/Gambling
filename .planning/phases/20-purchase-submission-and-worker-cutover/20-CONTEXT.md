# Phase 20: Purchase Submission and Worker Cutover - Context

**Gathered:** 2026-04-19  
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 20 cuts the live submit and worker path over to canonical `purchase` and durable `purchase_attempt` truth without breaking the current Big 8 cashier/admin/user contour:

- submit must write canonical purchase state with deterministic idempotency;
- worker reservation and attempt recording must update canonical purchase status and durable attempt history;
- legacy request, queue, and ticket surfaces may remain as compatibility mirrors where the current UI/runtime still needs them;
- restart, replay, and retry paths must not duplicate internal business effects when canonical history already exists.

This phase does **not** redesign draw settlement. It also does **not** remove legacy models, replace the TTL lock, or start the advisory-lock / transport work planned later.
</domain>

<decisions>
## Locked

- Phase 18 canonical contracts and Phase 19 canonical stores/projections are the base; Phase 20 must cut behavior over on top of them, not redesign them.
- Compatibility-first remains mandatory: keep the current Big 8 working contour truthful while canonical purchase truth becomes the active submit/worker source.
- Legacy `purchase_request`, `ticket`, `ticket_verification_job`, `draw_closure`, and TTL execution lock remain in place in this phase.
- Do not replace queue transport with `pg-boss` or start Phase 21 draw/result publication work here.
- Canonical cutover must stay local to submit, queue reservation, terminal execution, attempt journaling, and the compatibility mirrors required to keep existing request/ticket/admin reads honest.

### the agent's Discretion

- Whether canonical purchase IDs reuse the current request ID or stay separately addressable through `legacyRequestId`, as long as lookups stay deterministic and replay-safe.
- Whether compatibility mirroring is kept inside the existing services or extracted into a small helper, as long as the change stays local and does not create a parallel architecture.
</decisions>

<canonical_refs>
## Canonical References

- `.planning/STATE.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `ARCHITECTURE.md`
- `docs/runbooks/canonical-storage-migration.md`
- `.planning/phases/18-canonical-purchase-and-draw-contracts/18-01-SUMMARY.md`
- `.planning/phases/18-canonical-purchase-and-draw-contracts/18-VERIFICATION.md`
- `.planning/phases/19-canonical-storage-and-compatibility-projections/19-CONTEXT.md`
- `.planning/phases/19-canonical-storage-and-compatibility-projections/19-01-PLAN.md`
- `.planning/phases/19-canonical-storage-and-compatibility-projections/19-01-SUMMARY.md`
- `.planning/phases/19-canonical-storage-and-compatibility-projections/19-VERIFICATION.md`
- `apps/web/src/lib/purchase/purchase-runtime.ts`
- `apps/web/src/app/lottery/[lotteryCode]/page.tsx`
- `apps/terminal-worker/src/main.ts`
- `packages/application/src/services/purchase-request-service.ts`
- `packages/application/src/services/purchase-orchestration-service.ts`
- `packages/application/src/services/purchase-execution-queue-service.ts`
- `packages/application/src/services/terminal-execution-attempt-service.ts`
- `packages/application/src/services/purchase-completion-service.ts`
- `packages/application/src/services/purchase-request-query-service.ts`
- `packages/application/src/services/admin-operations-query-service.ts`
- `packages/application/src/services/canonical-compatibility.ts`
- `packages/domain/src/purchase-request.ts`
- `packages/domain/src/request-state.ts`
- `packages/domain/src/terminal-attempt.ts`
</canonical_refs>

<code_context>
## Existing Code Insights

- Web submit still persists legacy `purchase_request` through `PurchaseRequestService` and queues through `PurchaseOrchestrationService`; canonical purchase storage is not on the write path yet.
- Worker reservation, attempt recording, queue removal/retry, and cart-stage completion still derive truth from legacy request and queue stores.
- Query services already know how to project canonical purchase/attempt truth onto current request, ticket, and admin shapes when canonical records exist.
- TTL lock and queue table are still the active exclusivity/transport surfaces, so Phase 20 must work with them rather than replacing them.
</code_context>

<deferred>
## Deferred Ideas

- Explicit draw close/settle/result publication controls (Phase 21)
- Winning fulfillment and ledger rebase on canonical result truth (Phase 22)
- Advisory lock / queue transport replacement (Phase 24)
- Legacy write-model removal (Phase 25)
</deferred>

---

*Phase: 20-purchase-submission-and-worker-cutover*  
*Context gathered: 2026-04-19*
