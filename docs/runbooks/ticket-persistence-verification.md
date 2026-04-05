# Ticket Persistence Verification Runbook

Manual verification procedure for Phase 7 plans `07-01..07-03` ticket persistence, verification normalization, and winnings credit behavior.

## Preconditions

1. Dependencies are installed (`corepack pnpm install`).
2. Repository is on a clean branch (`git status --short --branch`).

## Step 1: Validate domain and application contracts

Run:

```powershell
corepack pnpm --filter @lottery/domain test -- ticket
corepack pnpm --filter @lottery/application test -- ticket-persistence-service terminal-execution-attempt-service
corepack pnpm --filter @lottery/terminal-worker typecheck
```

Expected outcome:
- domain ticket creation tests pass;
- successful terminal attempt test persists exactly one ticket;
- retry/error tests do not create ticket records.

## Step 2: Confirm success-path linkage fields

Inspect:

- `packages/application/src/services/ticket-persistence-service.ts`
- `packages/application/src/services/terminal-execution-attempt-service.ts`
- `packages/domain/src/ticket.ts`

Verify that persisted ticket fields include:

- `requestId`
- `userId`
- `lotteryCode`
- `drawId`
- `purchasedAt`
- `externalReference`
- `purchaseStatus=purchased`
- `verificationStatus=pending`

## Step 3: Validate verification-job auto-queue wiring

Run:

```powershell
corepack pnpm --filter @lottery/application test -- ticket-verification-queue-service
corepack pnpm --filter @lottery/terminal-worker typecheck
```

Expected outcome:
- pending purchased tickets are enqueued once into verification jobs;
- reserving a job transitions it to `verifying` and prevents double-reservation;
- worker build includes verification queue polling path.

## Step 4: Validate verification-result normalization and winnings credit

Run:

```powershell
corepack pnpm --filter @lottery/domain test -- ticket
corepack pnpm --filter @lottery/application test -- ticket-verification-result-service wallet-ledger-service
corepack pnpm --filter @lottery/terminal-worker typecheck
```

Expected outcome:
- ticket verification outcome writes `verificationStatus`, `verificationRawOutput`, and `winningAmountMinor`;
- replay of the same verification event returns `replayed=true` and does not duplicate winnings credit;
- ledger winnings entry references `ticketId` and uses idempotency key `${ticketId}:winnings:${verificationEventId}`.

## Troubleshooting Matrix

| Symptom | Likely boundary | Inspect first | Investigation command |
|---|---|---|---|
| Success request has no ticket | `packages/application` success path wiring | `terminal-execution-attempt-service.ts`, `ticket-persistence-service.ts` | `corepack pnpm --filter @lottery/application test -- terminal-execution-attempt-service` |
| Duplicate tickets for one request | `TicketStore` idempotency or request key logic | `ticket-persistence-service.ts`, `ticket-store.ts` | `corepack pnpm --filter @lottery/application test -- ticket-persistence-service` |
| Ticket has missing linkage fields | Domain creation contract drift | `packages/domain/src/ticket.ts` | `corepack pnpm --filter @lottery/domain test -- ticket` |
| Worker build breaks after ticket persistence wiring | Worker/runtime integration boundary | `apps/terminal-worker/src/main.ts` | `corepack pnpm --filter @lottery/terminal-worker typecheck` |
| Verification jobs are not created for pending tickets | Verification queue orchestration boundary | `ticket-verification-queue-service.ts`, `ticket-verification-job-store.ts` | `corepack pnpm --filter @lottery/application test -- ticket-verification-queue-service` |
| Winnings are credited twice for one ticket verification | Verification-result idempotency boundary | `ticket-verification-result-service.ts`, `wallet-ledger-service.ts` | `corepack pnpm --filter @lottery/application test -- ticket-verification-result-service wallet-ledger-service` |

## Additional Notes

- Ticket persistence is application-owned and must not be moved into runtime route files or worker store writes.
- Verification result normalization and winnings credit remain application-owned (`TicketVerificationResultService`, `WalletLedgerService`), never runtime-owned.
