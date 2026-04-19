# Phase 21: Draw Closure, Settlement, and Result Publication - Context

**Gathered:** 2026-04-19  
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 21 replaces the current closure-only draw result loop with canonical draw lifecycle and canonical result publication:

- admin draw actions must become explicit `create -> close -> mark-result -> settle` operations over canonical `draw`;
- result visibility must stay hidden until settlement and become visible only through settlement;
- canonical `purchase` result state must become the source for published win/lose truth in current user/admin read contours;
- legacy `draw_closure`, `ticket`, and verification-job models may remain as compatibility mirrors where the current contour still needs them.

This phase does **not** rebase winnings credit or cash-desk fulfillment onto canonical result truth. It also does **not** remove verification jobs, `ticket`, or TTL execution lock tables.
</domain>

<decisions>
## Locked

- Phase 20 already cut submit/worker execution over to canonical `purchase` and durable `purchase_attempt`; Phase 21 must build on that instead of redesigning purchase execution.
- Canonical `draw` is the target truth for draw lifecycle and publication gating.
- Compatibility-first still applies: existing Big 8 user/admin surfaces must keep working while result publication shifts underneath them.
- Phase 21 must not start Phase 22 money-flow rebase, remove legacy `ticket` or verification models, or replace TTL terminal exclusivity.

### the agent's Discretion

- Whether compatibility mirroring is done by overlaying canonical result truth onto existing ticket/admin reads or by synchronizing a small subset of legacy rows at settlement, as long as canonical draw and purchase state remain primary truth.
- Whether canonical draw creation happens eagerly during admin draw creation or lazily on the first lifecycle action, as long as admin actions stay idempotent and auditable.
</decisions>

<canonical_refs>
## Canonical References

- `.planning/STATE.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `ARCHITECTURE.md`
- `docs/runbooks/canonical-storage-migration.md`
- `.planning/phases/20-purchase-submission-and-worker-cutover/20-01-SUMMARY.md`
- `.planning/phases/20-purchase-submission-and-worker-cutover/20-VERIFICATION.md`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/app/api/admin/draws/route.ts`
- `apps/web/src/lib/purchase/admin-draw-monitor.tsx`
- `apps/web/src/lib/purchase/purchase-runtime.ts`
- `apps/terminal-worker/src/main.ts`
- `packages/application/src/services/draw-closure-service.ts`
- `packages/application/src/services/ticket-query-service.ts`
- `packages/application/src/services/ticket-verification-queue-service.ts`
- `packages/application/src/services/ticket-verification-result-service.ts`
- `packages/application/src/services/canonical-compatibility.ts`
- `packages/application/src/ports/canonical-draw-store.ts`
- `packages/domain/src/draw.ts`
- `packages/domain/src/purchase-request.ts`
</canonical_refs>

<code_context>
## Existing Code Insights

- Canonical `draw` store already exists in domain, application ports, infrastructure, and web runtime wiring, but no runtime service currently owns canonical draw lifecycle.
- Admin draw actions still go through `DrawClosureService`, which mutates legacy `draw_closure` and legacy `ticket` verification fields directly.
- Admin draws API and monitor only understand `open|closed`; there is no explicit `settled` step or settlement-gated publication path.
- User/admin ticket views can already project canonical purchase truth, but current ticket rows still lead when they exist, so published result story still follows legacy verification state.
- Worker verification queue still keys off legacy `draw_closure` and can enqueue verification jobs independently from canonical draw settlement.
</code_context>

<deferred>
## Deferred Ideas

- Rebase winnings credit and cash-desk fulfillment onto canonical purchase/draw result truth (Phase 22)
- Rebuild admin/receiver/user read models on canonical audit views (Phase 23)
- Advisory-lock transport changes (Phase 24)
- Legacy write-model removal (Phase 25)
</deferred>

---

*Phase: 21-draw-closure-settlement-and-result-publication*  
*Context gathered: 2026-04-19*
