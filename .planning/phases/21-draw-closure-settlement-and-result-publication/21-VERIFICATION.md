---
status: passed
phase: 21-draw-closure-settlement-and-result-publication
verified: 2026-04-19
source:
  - 21-01-PLAN.md
  - 21-01-SUMMARY.md
requirements:
  - CONS-06
---

# Phase 21 Verification

## Goal

Replace the legacy closure-only result loop with canonical draw lifecycle and settlement-gated result publication while keeping the current Big 8 contour stable through compatibility-first projections.

## Verified Must-Haves

1. Admin draw actions now split into explicit create, close, mark-result, and settle operations over canonical `draw` truth.
2. Canonical draw settlement is the gate for published result visibility; closing alone does not publish outcomes.
3. Current ticket/admin result views project canonical result visibility and no longer wait for legacy verification-job truth once a canonical draw is settled.
4. Legacy `draw_closure`, `ticket`, `ticket_verification_job`, and TTL lock surfaces remain compatibility-safe and were not removed or repurposed beyond the Phase 21 boundary.

## Evidence

- `packages/application/src/services/draw-closure-service.ts` now owns canonical draw lifecycle, canonical purchase result marking, settlement, and compatibility ticket publication.
- `apps/web/src/lib/purchase/purchase-runtime.ts` wires canonical draw and purchase storage into the active admin draw service.
- `apps/web/src/app/api/admin/draws/route.ts`, `apps/web/src/app/admin/page.tsx`, and `apps/web/src/lib/purchase/admin-draw-monitor.tsx` expose explicit create/close/mark/settle operator flow and distinguish `open`, `closed`, and `settled`.
- `packages/application/src/services/ticket-query-service.ts` overlays canonical hidden/visible result state onto current ticket views and still emits synthetic compatibility tickets where needed.
- `packages/application/src/services/ticket-verification-queue-service.ts` and `apps/terminal-worker/src/main.ts` keep legacy verification jobs away from canonical-managed draws.
- `packages/application/src/ports/canonical-draw-store.ts`, `packages/infrastructure/src/purchase/in-memory-canonical-draw-store.ts`, and `packages/infrastructure/src/postgres/postgres-purchase-store.ts` support single-draw deletion required by the admin test contour.
- `docs/runbooks/canonical-storage-migration.md` and `ARCHITECTURE.md` document the live Phase 21 cutover boundary and the deferred Phase 22 money-flow work.

## Checks Run

- `corepack pnpm --filter @lottery/application test`
- `corepack pnpm --filter @lottery/application typecheck`
- `corepack pnpm --filter @lottery/web typecheck`
- `corepack pnpm --filter @lottery/terminal-worker typecheck`
- `corepack pnpm --filter @lottery/infrastructure typecheck`
- `corepack pnpm --filter @lottery/web build`
- `corepack pnpm --filter @lottery/application lint`
- `corepack pnpm --filter @lottery/web lint`
- `corepack pnpm --filter @lottery/terminal-worker lint`

## Result

Phase 21 passed. Canonical draw lifecycle and settlement now govern published ticket results in the current admin/user contour, while legacy verification and ticket write models remain additive compatibility surfaces. No Phase 22 winnings/ledger rebase, lock replacement, transport rewrite, or legacy removal happened here.
