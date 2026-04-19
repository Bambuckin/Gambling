# Phase 15: Winning Actions - Balance Credit and Cash Desk

## Goal

Turn a winning Big 8 ticket into exactly one follow-up action: internal balance credit or cash-desk payout request.

## Locked Decisions

- Winning actions are mutually exclusive.
- `Зачислить на баланс` runs through a hidden internal credit job.
- Hidden credit jobs run only when purchase queue is empty.
- `Получить в кассе` creates a visible admin-side `CashDeskRequest`.
- Cash desk workflow depth in this wave is only `pending -> paid`.
- Only one admin exists for now and closes cash-desk requests.

## Required Implementation

1. Add claim lifecycle to tickets.
   - Ticket needs an explicit `claimState`.
   - Minimum state set:
     - `unclaimed`
     - `credit_pending`
     - `credited`
     - `cash_desk_pending`
     - `cash_desk_paid`

2. Implement hidden winnings credit queue.
   - Create a separate internal job type such as `WinningsCreditJob`.
   - Do not expose it as a normal user request.
   - Worker must process it only when purchase queue is empty.

3. Implement credit path.
   - User clicks `Зачислить на баланс`.
   - System creates one hidden credit job.
   - Successful job writes exactly one ledger credit and flips `claimState` to `credited`.
   - Retry/idempotency must prevent double credits.

4. Implement cash desk path.
   - User clicks `Получить в кассе`.
   - System creates a visible `CashDeskRequest` with status `pending`.
   - Admin closes it as `paid`.
   - Ticket `claimState` becomes `cash_desk_paid`.
   - No ledger credit happens on this path.

5. Audit every action.
   - Claim start, credit success, cash desk request creation, and paid confirmation must all be auditable.

## Likely Touch Points

- `packages/domain/src/ticket.ts`
- `packages/domain/src/ledger.ts`
- `packages/application/src/services/wallet-ledger-service.ts`
- `packages/application/src/services/admin-queue-service.ts`
- `packages/application/src/services/admin-operations-query-service.ts`
- `apps/terminal-worker/src/main.ts`
- `apps/terminal-worker/src/lib/terminal-handler-runtime.ts`
- `apps/web/src/app/lottery/[lotteryCode]/page.tsx`
- `apps/web/src/app/admin/page.tsx`

## Acceptance Scenarios

- Winning ticket shows exactly two actions.
- User cannot trigger both actions for the same winning ticket.
- Credit job waits until purchase queue is empty.
- Credit path writes one and only one ledger credit.
- Cash desk path creates a visible admin request and never changes user balance directly.

## Out Of Scope

- Generic scheduler redesign.
- Multi-step cashier approval chain.
- Real terminal payout integration beyond the hidden internal job abstraction.
