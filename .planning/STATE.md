---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: UI Contract, Readability, and Closure Truth
current_phase: 34
current_phase_name: release cleanup and main publish
status: completed
current_plan: 34-01
stopped_at: Phase 34 plan 34-01 cleaned local runtime/build artifacts and validated the release tree
last_updated: "2026-04-25T11:06:00+05:00"
last_activity: 2026-04-25 -- Phase 34 removed generated artifacts, preserved release inputs, and validated the cleaned tree
progress:
  total_phases: 9
  completed_phases: 9
  total_plans: 1
  completed_plans: 1
  percent: 100
---

# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-22)

**Core value:** Each confirmed purchase must move predictably from web UI to the single main terminal with correct reserve/debit behavior, clear status, and full event traceability.
**Current focus:** Milestone v1.2 hotfix pass and release cleanup are complete; remaining work is commit/publish to main and environment-dependent LAN smoke

## Current Position

Phase: 34 (release cleanup and main publish) - COMPLETED
Plan: 34-01
Current Phase: 34
Current Phase Name: release cleanup and main publish
Total Phases: 9
Current Plan: 34-01
Total Plans in Phase: 1
Status: Phase 34 plan 34-01 is implemented and validated; the tree is ready for commit/publish
Progress: 100%
Last activity: 2026-04-25 -- Release cleanup completed and validated
Last Activity Description: Phase 34 removed generated browser/build/log/cache artifacts, preserved source and release templates, and validated the workspace before commit/publish.

## Decisions Made

| Phase | Summary | Rationale |
|-------|---------|-----------|
| 17 | Keep the current Big 8 contour as the compatibility surface during migration. | New architecture must not break the working cashier/admin/user loop before parity exists. |
| 18 | Introduce canonical `purchase`, `draw`, and `purchase_attempt` additively before transport changes. | Split truth is the root problem; queue replacement is not the first cut. |
| 18 | Do not delete `ticket`, verification, or TTL lock write models until parity is proven. | Safe migration needs compatibility artifacts until the later decommission phase. |
| 18 | Separate purchase execution state from result state and result visibility. | The current model mixes operational progress with post-draw truth. |
| 19 | Feed current request, ticket, and admin read contours through explicit canonical compatibility projections. | Storage can move underneath the UI only if current shapes stay stable and testable. |
| 20 | Submit and worker execution now treat canonical `purchase` and `purchase_attempt` state as primary truth while legacy request/queue/ticket writes remain compatibility mirrors. | This advances migration without breaking the live Big 8 contour or removing legacy artifacts early. |
| 21 | Canonical `draw` settlement now gates published result visibility while legacy ticket and verification models remain compatibility surfaces. | This moves draw/result truth onto the new model without starting the Phase 22 money-flow rebase early. |
| 22 | Canonical purchase result visibility now gates winning fulfillment, and winnings ledger idempotency is keyed by canonical purchase identity. | Explicit credit/cash-desk flow stays replay-safe while old ticket claim state becomes compatibility only. |
| 23 | Current admin, terminal receiver, and lottery-page read surfaces are now canonical-first, while launcher/runbook handoff is synced to the real manual smoke contour. | Read truth and operator instructions must match before lock/transport hardening starts. |
| 24 | Advisory locking replaced TTL lock takeover semantics, while queue send/receive flow now runs behind a replaceable transport seam that still preserves the current contour. | Exclusivity and transport had to harden before any legacy write-model removal could start safely. |
| 26 | UI cleanup must move together with ledger, status, and draw-close mechanics instead of shipping as a cosmetic-only pass. | The user explicitly wants the interface to reflect the real runtime contour, not decorative placeholders. |
| 27 | User cabinet rows now consume presenter-shaped Russian labels for requests and tickets, and the unused raw live monitor was removed. | The cashier surface must stay live without exposing backend status/result strings or stale service-only helpers. |
| 28 | Admin receiver, status, alert, audit, and draw monitor labels now render through a shared Russian presenter layer while application query services keep returning machine states. | UI labels need one coherent mapping boundary without scattering raw backend values through JSX. |
| 29 | Admin draw closure is now one close-and-publish operator action, with `closeDraw()` as the only publication path for open and legacy closed canonical draws. | The admin surface must not require or preserve a second settlement publication step after draw close. |
| 30 | User-facing result/purchase labels and draw-close notifications now render readable Russian text, and the close-to-credit path is protected by a focused regression. | The v1.2 UI contract is only complete if readable labels match the actual wallet, result, and winnings mechanics. |
| 31 | Draw close now auto-credits winning tickets, completion debits reserved funds, draw sync defaults to 5 seconds, and client notifications report win/lose or credited winnings in Russian. | The reported runtime bugs were inside the v1.2 acceptance contour and needed a small hotfix phase instead of leaving the roadmap marked complete with known breakage. |
| 32 | Runtime reset now leaves draws and queue empty, admin can inspect and manually adjust user balances, and client result push notifications are visible in the cabinet. | The second runtime report exposed operator-visible gaps that needed a narrow hotfix rather than a broad milestone rewrite. |
| 33 | Detached reserves are reconciled through auditable debit/release entries, and client win/lose notifications surface as in-app push even if they existed before mount. | The client wallet and notification surfaces must be driven by actual ledger/notification state instead of stale queue assumptions. |
| 34 | Release cleanup must remove only local runtime/build artifacts and preserve all v1.2 source, tests, docs, env templates, and planning history. | The main branch should receive the buildable implementation, not local browser profiles, logs, caches, or stray command outputs. |

## Blockers

- Live NLoto selector/session hardening still needs target-LAN smoke on the real terminal machine.
- Full live browser/LAN smoke for Phase 33 was not run in this local pass and should follow `docs/runbooks/current-working-contour-smoke.md`.
- Compatibility tables still exist physically and should be dropped only in a deliberate migration window, not during the active runtime cutover.

## Session

**Last Date:** 2026-04-24
**Stopped At:** Phase 34 plan 34-01 is complete and the release tree is ready to commit/publish
**Resume File:** `.planning/phases/34-release-cleanup-and-main-publish/34-01-SUMMARY.md`
