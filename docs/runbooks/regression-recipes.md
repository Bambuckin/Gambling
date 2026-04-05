# Regression Recipes

Critical cross-module checks for pre-release validation.
Run from repository root and stop on first hard failure.

## Recipe 1: Purchase Happy Path

1. `corepack pnpm --filter @lottery/application test -- purchase-draft-service purchase-request-service purchase-orchestration-service`
2. `corepack pnpm --filter @lottery/web build`
3. Manual spot-check: create draft and confirm request at `/lottery/demo-lottery`.

Expected outcome:
- draft reaches `ready`;
- confirmed request reaches `queued`;
- request is visible in user view and purchase lab.

## Recipe 2: Reserve Release On Cancellation

1. `corepack pnpm --filter @lottery/application test -- purchase-orchestration-service wallet-ledger-service`
2. Manual spot-check: cancel queued request in `/lottery/demo-lottery`.

Expected outcome:
- request transitions to `reserve_released`;
- queue item disappears from `/debug/purchase-lab`;
- reserved amount returns to available wallet funds.

## Recipe 3: Terminal Retry And Final Error

1. `corepack pnpm --filter @lottery/application test -- terminal-execution-attempt-service terminal-retry-service terminal-health-service`
2. `corepack pnpm --filter @lottery/terminal-worker typecheck`

Expected outcome:
- retrying transitions are preserved up to policy cap;
- exhausted attempts become final error;
- terminal health projection reflects degraded/offline where applicable.

## Recipe 4: Ticket Verification And Winnings Credit

1. `corepack pnpm --filter @lottery/application test -- ticket-persistence-service ticket-verification-queue-service ticket-verification-result-service wallet-ledger-service`
2. Manual spot-check: open `/debug/ticket-lab` and verify terminal output + winning amount fields.

Expected outcome:
- successful purchase produces ticket record;
- verification result is stored with raw output;
- winning amount credits wallet ledger exactly once per verification event.

## Recipe 5: Admin Queue Priority + Alerts

1. `corepack pnpm --filter @lottery/application test -- admin-queue-service admin-operations-query-service operations-audit-service operations-alert-service`
2. `corepack pnpm --filter @lottery/web build`
3. Manual spot-check: apply priority action in `/admin`, confirm projection in `/debug/admin-ops-lab`.

Expected outcome:
- queued request priority updates without touching executing item;
- operations audit event is appended;
- queue/terminal/finance alerts are surfaced consistently in admin projections.

## Fast Failure Diagnostics

| Symptom | First boundary to inspect | First command to rerun |
|---|---|---|
| request status drift | `packages/application/src/services/purchase-orchestration-service.ts` | `corepack pnpm --filter @lottery/application test -- purchase-orchestration-service` |
| queue order mismatch | `packages/application/src/services/admin-queue-service.ts` | `corepack pnpm --filter @lottery/application test -- admin-queue-service` |
| verification credit duplicates | `packages/application/src/services/ticket-verification-result-service.ts` | `corepack pnpm --filter @lottery/application test -- ticket-verification-result-service wallet-ledger-service` |
| worker retry mismatch | `packages/application/src/services/terminal-retry-service.ts` | `corepack pnpm --filter @lottery/application test -- terminal-retry-service` |
| admin alert mismatch | `packages/application/src/services/operations-alert-service.ts` | `corepack pnpm --filter @lottery/application test -- operations-alert-service` |
