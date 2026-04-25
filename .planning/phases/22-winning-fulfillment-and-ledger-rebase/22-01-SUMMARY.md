# Phase 22 - Plan 01 Summary

**Status:** Complete

## Result

- Cut winning fulfillment over to canonical purchase/draw truth through `WinningFulfillmentService`, so credit and cash-desk eligibility now comes from canonical visible win state instead of legacy verification-job side effects.
- Rebasing the money path added canonical `purchaseId`/`requestId`/`drawId` to cash-desk requests, winnings-credit jobs, and ledger references; winnings credit idempotency now keys off canonical purchase identity.
- Stopped `TicketVerificationResultService` from auto-crediting winnings, which restores the intended explicit fulfillment choice between balance credit and cash desk.
- Projected canonical fulfillment status back into current lottery/admin surfaces, including synthetic compatibility tickets, restored user actions on the lottery page, and added admin cash-desk payout plus credit-job visibility.
- Locked the cutover with targeted application tests and updated migration/architecture docs so the Phase 22 boundary is explicit and truthful.

## Verification

- `corepack pnpm --filter @lottery/application test -- --runInBand ticket-query-service wallet-ledger-service winnings-credit-service winning-fulfillment-service ticket-verification-result-service admin-test-reset-service`
- `corepack pnpm --filter @lottery/application typecheck`
- `corepack pnpm --filter @lottery/web typecheck`
- `corepack pnpm --filter @lottery/terminal-worker typecheck`
- `corepack pnpm --filter @lottery/infrastructure typecheck`
- `corepack pnpm --filter @lottery/web build`

## Notes

- Legacy `ticket`, `ticket_verification_job`, `draw_closure`, and TTL lock surfaces still exist as compatibility layers; Phase 22 did not remove them.
- Current user/admin pages still read through compatibility shapes with canonical overlays. Phase 23 is the read-model cleanup pass.
- Legacy ticket claim state may still be mirrored when a legacy ticket row exists, but it is no longer allowed to be the only payout truth.
