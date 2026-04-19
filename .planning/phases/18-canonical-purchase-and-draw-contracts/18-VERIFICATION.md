---
status: passed
phase: 18-canonical-purchase-and-draw-contracts
verified: 2026-04-19
source:
  - 18-01-PLAN.md
  - 18-01-SUMMARY.md
requirements:
  - CONS-01
  - CONS-02
  - CONS-03
---

# Phase 18 Verification

## Goal

Establish additive canonical domain contracts and persistence skeleton for `purchase`, `draw`, and `purchase_attempt` without breaking the current Big 8 working contour.

## Verified Must-Haves

1. Canonical `purchase` contract exists separately from legacy `purchase_request`, with explicit lifecycle state, result state, and result visibility.
2. Canonical `draw` contract exists with explicit `open -> closed -> settled` lifecycle and visibility gated by settlement.
3. Durable `purchase_attempt` contract exists as explicit structured data rather than only legacy journal-note text.
4. Additive Postgres groundwork exists for canonical purchases, draws, and attempts, while legacy request/ticket/verification/TTL lock tables remain intact.

## Evidence

- `packages/domain/src/request-state.ts` adds canonical purchase statuses and transitions.
- `packages/domain/src/purchase-request.ts` adds `CanonicalPurchaseRecord` and helpers for result status and result visibility.
- `packages/domain/src/draw.ts` adds `CanonicalDrawRecord` with explicit close and settle operations.
- `packages/domain/src/terminal-attempt.ts` adds durable `PurchaseAttemptRecord`.
- `packages/application/src/ports/canonical-purchase-store.ts`, `canonical-draw-store.ts`, and `purchase-attempt-store.ts` expose additive canonical persistence seams.
- `packages/infrastructure/src/postgres/postgres-schema.ts` adds `lottery_purchases`, `lottery_draws`, and `lottery_purchase_attempts`.
- `packages/infrastructure/src/postgres/postgres-purchase-store.ts` adds Postgres repository skeletons for canonical purchases, draws, and attempts.
- `ARCHITECTURE.md` documents canonical write models versus temporary compatibility surfaces.

## Checks Run

- `corepack pnpm --filter @lottery/domain test`
- `corepack pnpm --filter @lottery/application test`
- `corepack pnpm --filter @lottery/infrastructure typecheck`
- `corepack pnpm --filter @lottery/web build`

## Result

Phase 18 passed with additive-first migration discipline preserved. No legacy write model was removed or renamed in this phase.
