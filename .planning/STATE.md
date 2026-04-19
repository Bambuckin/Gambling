---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Domain Consolidation and Truth Model
current_phase: 21
current_phase_name: draw closure, settlement, and result publication
current_plan: Not started
status: ready
stopped_at: Phase 20 complete; Phase 21 awaits planning
last_updated: "2026-04-19T13:19:11.0170940Z"
last_activity: 2026-04-19 - Phase 20 complete
progress:
  total_phases: 25
  completed_phases: 20
  total_plans: 53
  completed_plans: 53
  percent: 80
---

# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-19)

**Core value:** Each confirmed purchase must move predictably from web UI to the single main terminal with correct reserve/debit behavior, clear status, and full event traceability.
**Current focus:** Milestone v1.1 - establish canonical `purchase`/`draw` truth while keeping the working Big 8 contour stable.

## Current Position

Current Phase: 21
Current Phase Name: draw closure, settlement, and result publication
Total Phases: 25
Current Plan: Not started
Total Plans in Phase: 0
Status: Ready to plan
Progress: 80%
Last activity: 2026-04-19 - Phase 20 complete
Last Activity Description: Phase 20 complete - canonical submit and worker cutover verified

## Decisions Made

| Phase | Summary | Rationale |
|-------|---------|-----------|
| 17 | Keep the current Big 8 contour as the compatibility surface during migration. | New architecture must not break the working cashier/admin/user loop before parity exists. |
| 18 | Introduce canonical `purchase`, `draw`, and `purchase_attempt` additively before transport changes. | Split truth is the root problem; queue replacement is not the first cut. |
| 18 | Do not delete `ticket`, verification, or TTL lock write models until parity is proven. | Safe migration needs compatibility artifacts until the later decommission phase. |
| 18 | Separate purchase execution state from result state and result visibility. | The current model mixes operational progress with post-draw truth. |
| 19 | Feed current request, ticket, and admin read contours through explicit canonical compatibility projections. | Storage can move underneath the UI only if current shapes stay stable and testable. |
| 20 | Submit and worker execution now treat canonical `purchase` and `purchase_attempt` state as primary truth while legacy request/queue/ticket writes remain compatibility mirrors. | This advances migration without breaking the live Big 8 contour or removing legacy artifacts early. |

## Blockers

- Draw closure and result publication still depend on the legacy closure-only loop.
- Terminal exclusivity still relies on TTL lock-table semantics.
- Phase 21 must move result publication onto canonical draw truth without breaking current visibility rules.

## Session

**Last Date:** 2026-04-19
**Stopped At:** Phase 20 complete; Phase 21 awaits planning
**Resume File:** `.planning/ROADMAP.md` (next: run `/gsd-plan-phase 21`)
