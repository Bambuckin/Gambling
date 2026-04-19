---
status: passed
phase: 20-purchase-submission-and-worker-cutover
verified: 2026-04-19
source:
  - 20-01-PLAN.md
  - 20-01-SUMMARY.md
requirements:
  - CONS-05
---

# Phase 20 Verification

## Goal

Move submit, queue reservation, terminal execution, and attempt persistence onto canonical `purchase` truth while preserving the current Big 8 user/admin contour through compatibility-first mirroring.

## Verified Must-Haves

1. Submit and cancel flows create, reuse, queue, and cancel canonical purchases idempotently around the existing legacy request identifier.
2. Worker reservation and terminal attempt recording advance canonical `purchase` and durable `purchase_attempt` truth before compatibility queue/request/ticket side effects.
3. Replay, retry, crash-recovery, and cart-completion paths do not duplicate internal business effects when canonical attempt or purchase state already exists.
4. Current request/admin read contours stay truthful during the cutover, while legacy `ticket`, verification jobs, TTL lock, and queue transport remain intentionally in place.

## Evidence

- `apps/web/src/lib/purchase/purchase-runtime.ts` now wires canonical purchase storage into submit orchestration.
- `packages/application/src/services/canonical-purchase-state.ts` centralizes canonical purchase backfill and lifecycle helpers used by the cutover.
- `packages/application/src/services/purchase-orchestration-service.ts` writes canonical queued/canceled purchase state during submit and cancel flows.
- `packages/application/src/services/purchase-execution-queue-service.ts` moves canonical purchases into `processing` and repairs recovered executing items from canonical outcome state.
- `packages/application/src/services/terminal-execution-attempt-service.ts` persists durable attempt records, replays safely, and advances canonical purchase lifecycle before compatibility side effects.
- `packages/application/src/services/purchase-completion-service.ts` completes cart-stage compatibility from canonical purchase truth without duplicating ticket persistence.
- `packages/application/src/services/canonical-compatibility.ts`, `purchase-request-query-service.ts`, and `admin-operations-query-service.ts` keep current read contours honest while canonical worker truth leads legacy mirrors.
- `apps/terminal-worker/src/main.ts` wires canonical stores into the active worker runtime and repairs pending cart completions from canonical state.
- `docs/runbooks/canonical-storage-migration.md` documents the Phase 20 cutover boundary and replay constraints.

## Checks Run

- `corepack pnpm --filter @lottery/application test`
- `corepack pnpm --filter @lottery/application typecheck`
- `corepack pnpm --filter @lottery/terminal-worker typecheck`
- `corepack pnpm --filter @lottery/web typecheck`
- `corepack pnpm --filter @lottery/infrastructure typecheck`
- `corepack pnpm --filter @lottery/web build`

## Result

Phase 20 passed. Submit and worker execution now anchor on canonical purchase and attempt truth, while the current Big 8 surface still runs through compatibility-first legacy mirrors. No legacy write model removal, TTL lock replacement, `pg-boss` transport switch, or Phase 21 draw/result work happened here.
