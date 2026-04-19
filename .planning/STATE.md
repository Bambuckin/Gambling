# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-19)

**Core value:** Each confirmed purchase must move predictably from web UI to the single main terminal with correct reserve/debit behavior, clear status, and full event traceability.
**Current focus:** Milestone v1.1 - establish canonical `purchase`/`draw` truth while keeping the working Big 8 contour stable.

## Current Position

Current Phase: 18
Current Phase Name: canonical-purchase-and-draw-contracts
Total Phases: 25
Current Plan: 1
Total Plans in Phase: 1
Status: Ready to execute
Progress: 68%
Last Activity: 2026-04-19 - Phase 18 planned and execution brief written
Last Activity Description: Planning debt repaired, baseline validated, and canonical migration wave ready to execute.

## Decisions Made

| Phase | Summary | Rationale |
|-------|---------|-----------|
| 17 | Keep the current Big 8 contour as the compatibility surface during migration. | New architecture must not break the working cashier/admin/user loop before parity exists. |
| 18 | Introduce canonical `purchase`, `draw`, and `purchase_attempt` additively before transport changes. | Split truth is the root problem; queue replacement is not the first cut. |
| 18 | Do not delete `ticket`, verification, or TTL lock write models until parity is proven. | Safe migration needs compatibility artifacts until the later decommission phase. |
| 18 | Separate purchase execution state from result state and result visibility. | The current model mixes operational progress with post-draw truth. |

## Blockers

- Runtime truth is still split across request, queue, ticket, verification, and draw-closure models.
- Terminal exclusivity still relies on TTL lock-table semantics.
- Phase 18 must preserve the current Big 8 surface while adding canonical storage beside it.

## Session

**Last Date:** 2026-04-19
**Stopped At:** Planned the v1.1 architecture consolidation wave, repaired planning debt, and prepared Phase 18 for execution
**Resume File:** `.planning/phases/18-canonical-purchase-and-draw-contracts/18-01-PLAN.md`
