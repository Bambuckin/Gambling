# Purchase Request Verification Runbook

Manual verification procedure for Phase 5 purchase request orchestration behavior.

## Preconditions

1. Dependencies are installed (`corepack pnpm install`).
2. Web app is running (`corepack pnpm --filter @lottery/web dev`).
3. You can access `http://localhost:3000`.

## Test Accounts

- `operator` / `operator`
- `tester` / `tester`
- `admin` / `admin`

## Step 1: Validate And Price Draft Before Confirmation

1. Open `http://localhost:3000/lottery/demo-lottery`.
2. Sign in as `tester` / `tester` if prompted.
3. Fill lottery form values (for example `draw_count=2`).
4. Click `Prepare Purchase Draft`.
5. Confirm page shows `Draft [ready]` message with quote amount/currency.
6. Confirm `Confirm Purchase Request` section appears with immutable payload snapshot.

Expected outcome:
- Quote is produced before request creation.
- Confirmation step appears before any queued request is created.

## Step 2: Confirm Request And Verify Queue State

1. In confirmation section, click `Confirm And Create Request`.
2. Confirm page shows `Draft [queued]` message.
3. In `Purchase Requests` table, confirm new row exists with:
   - `status=queued`,
   - non-empty `request id`,
   - expected `attempts` and `cost`.
4. Open `http://localhost:3000/debug/purchase-lab`.
5. Confirm request appears in both:
   - user request table,
   - queue snapshot table.

Expected outcome:
- Confirm action reserves funds and inserts request into queue.
- Status and queue visibility are consistent between user page and debug contour.

## Step 3: Cancel Queued Request And Verify Reserve Release

1. Return to `http://localhost:3000/lottery/demo-lottery`.
2. Click `Cancel Request` on queued item.
3. Confirm page shows `Draft [canceled]` message.
4. Confirm request row status updates to `reserve_released`.
5. Open `http://localhost:3000/debug/purchase-lab`.
6. Confirm canceled request is removed from queue snapshot.

Expected outcome:
- Cancellation is allowed only while queued/retrying.
- Reserve is released and queue item is removed.

## Troubleshooting Matrix

| Symptom | Likely boundary | Inspect first | Investigation command |
|---|---|---|---|
| Request stays `awaiting_confirmation` after confirm | `packages/application` orchestration path | `packages/application/src/services/purchase-orchestration-service.ts`, `apps/web/src/app/lottery/[lotteryCode]/page.tsx` | `corepack pnpm --filter @lottery/application test -- purchase-orchestration-service` |
| Duplicate reserve entries for same request | `packages/application` idempotency key handling | `packages/application/src/services/purchase-orchestration-service.ts`, `packages/application/src/services/wallet-ledger-service.ts` | `corepack pnpm --filter @lottery/application test -- purchase-orchestration-service wallet-ledger-service` |
| Cancel button shown for non-cancelable status | `apps/web` status rendering boundary | `apps/web/src/app/lottery/[lotteryCode]/page.tsx`, `packages/domain/src/request-state.ts` | `Select-String -Path apps/web/src/app/lottery/[lotteryCode]/page.tsx -Pattern \"isRequestCancelableStatus\"` |
| Purchase Lab data differs from user page | `packages/application` query service projection | `packages/application/src/services/purchase-request-query-service.ts`, `apps/web/src/lib/purchase/purchase-runtime.ts` | `corepack pnpm --filter @lottery/application test -- purchase-request-query-service` |

## Additional Notes

- Purchase Lab (`/debug/purchase-lab`) is verification-only and must not become an operator control surface.
- If queue appears empty unexpectedly, check that confirmation step succeeded and request status is `queued` before cancellation.
