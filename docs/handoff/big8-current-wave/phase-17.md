# Phase 17: User Cabinet Stats and Admin Test Reset Tools

## Goal

Finish the current wave with a usable cross-lottery user cabinet and explicit admin tools for queue cleanup and full test-runtime reset.

## Locked Decisions

- User cabinet is cross-lottery, even though the active working contour is Big 8 first.
- Required cabinet filters:
  - `lottery`
  - `status`
  - `period`
- Prediction logic is deferred.
- Reset actions are admin-only.
- Reset actions are test-runtime tools, not production operations.
- Reset actions must be implemented inside the application layer, not by shelling out to repo scripts from the web UI.

## Required Implementation

1. Add user cabinet aggregates.
   - Minimum summary fields:
     - current balance,
     - total stakes,
     - total winnings,
     - net result,
     - total tickets,
     - winning tickets count.

2. Add cabinet filters and history view.
   - One place to inspect requests, tickets, win/loss outcomes, and claim state across lotteries.

3. Add admin operational summaries.
   - Keep them practical:
     - queue depth,
     - current active request,
     - successful and failed purchases,
     - pending cash-desk requests,
     - total credited winnings.

4. Implement `Очистить очередь`.
   - This action is available only when terminal state is idle.
   - It removes non-started queued purchase requests and non-started hidden winnings-credit jobs.
   - It clears queue projections/runtime snapshots tied to those items.
   - It releases reserves for removed purchase requests.
   - It does not delete completed requests, tickets, ledger history, or accumulated stats.

5. Implement `Сбросить тестовые данные`.
   - This action is available only when terminal state is idle.
   - It requires explicit danger confirmation in the UI.
   - It clears:
     - purchase requests,
     - execution attempts,
     - queue runtime state,
     - tickets,
     - admin result marks,
     - user notifications,
     - cash desk requests,
     - hidden winnings credit jobs,
     - non-seed ledger entries,
     - derived stats/projections,
     - active sessions.
   - It preserves:
     - identities and credentials,
     - lottery catalog and settings,
     - baseline seeded balances/config.
   - After reset, balances and runtime state must match the seeded baseline.

6. Audit both reset actions.
   - Queue cleanup and full reset both need admin-visible audit entries.

## Likely Touch Points

- `packages/application/src/services/admin-operations-query-service.ts`
- `packages/application/src/services/admin-queue-service.ts`
- `packages/application/src/services/purchase-request-query-service.ts`
- `packages/application/src/services/wallet-ledger-service.ts`
- `packages/domain/src/ledger.ts`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/app/lottery/[lotteryCode]/page.tsx`
- `apps/web/src/lib/ledger/wallet-view.ts`

## Acceptance Scenarios

- User cabinet shows the required aggregates and filters history correctly.
- Admin can clear queue only when the terminal is idle, and reserves are released for removed queued work.
- Admin can run full test reset only when the terminal is idle.
- Full test reset preserves demo/admin users and baseline configuration but removes all test-generated runtime data.
- After reset, users must log in again because sessions were revoked.

## Out Of Scope

- Predictive analytics or hints.
- Production-grade destructive maintenance tooling.
- Resetting or re-seeding via shell command from the browser.
