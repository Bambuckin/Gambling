---
status: passed
phase: 19-canonical-storage-and-compatibility-projections
verified: 2026-04-19
source:
  - 19-01-PLAN.md
  - 19-01-SUMMARY.md
requirements:
  - CONS-04
---

# Phase 19 Verification

## Goal

Make canonical storage usable and introduce compatibility projections so current cashier/admin/user surfaces stay truthful while storage truth moves underneath them additively.

## Verified Must-Haves

1. Runtime wiring exposes canonical purchase, draw, and attempt repositories in both `postgres` and `in-memory` modes.
2. Current request, ticket, and admin query services can project canonical truth without breaking their existing return shapes.
3. Local reset/startup remains safe against additive schema because canonical runtime stores are cleared together with legacy test data.
4. No worker cutover, transport swap, legacy write-model removal, or TTL lock replacement happened in this phase.

## Evidence

- `apps/web/src/lib/purchase/purchase-runtime.ts` wires canonical stores beside the legacy request/queue/ticket stores.
- `packages/infrastructure/src/purchase/in-memory-canonical-*.ts` provide usable local canonical repositories.
- `packages/application/src/services/canonical-compatibility.ts` makes compatibility mapping explicit and testable.
- `packages/application/src/services/purchase-request-query-service.ts` overlays canonical status/attempt truth and emits synthetic compatibility rows.
- `packages/application/src/services/ticket-query-service.ts` emits synthetic compatibility tickets for canonical purchases.
- `packages/application/src/services/admin-operations-query-service.ts` projects canonical problem requests into the admin contour.
- `packages/application/src/services/admin-test-reset-service.ts` clears canonical runtime stores during full test reset.
- `docs/runbooks/canonical-storage-migration.md` documents additive coexistence, reset behavior, and backfill constraints.

## Checks Run

- `corepack pnpm --filter @lottery/application test`
- `corepack pnpm --filter @lottery/infrastructure typecheck`
- `corepack pnpm --filter @lottery/web build`

## Result

Phase 19 passed with compatibility projections explicit, tested, and still additive-first. The Big 8 working contour remains on the legacy execution path while canonical storage becomes usable underneath it.
