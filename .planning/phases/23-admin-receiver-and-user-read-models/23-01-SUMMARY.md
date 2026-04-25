# Phase 23 Summary: Admin, Receiver, and User Read Models

## Outcome

Phase 23 is complete.

Current admin, terminal receiver, and user-facing lottery reads are now canonical-first:

- receiver and debug inbox rows read from canonical `purchase` + `purchase_attempt` truth;
- admin overview/problem/queue contours stay meaningful even for canonical-only purchases;
- user request, ticket, and cabinet reads no longer depend on legacy request/ticket rows as their primary anchor;
- the live lottery page now exposes canonical-first account totals and explicit winning actions without waiting for a separate cabinet route.

Legacy `purchase_request`, `ticket`, `ticket_verification_job`, and TTL lock artifacts still exist, but only as compatibility layers or deferred transport/runtime concerns for later phases.

## Delivered Changes

### Canonical-first read services

- Added `TerminalReceiverQueryService` and moved receiver/read APIs onto canonical purchase + attempt state.
- Extended `PurchaseRequestQueryService` and `TicketQueryService` so current user/admin shapes prefer canonical snapshots and only fall back to legacy rows when canonical data is absent.
- Rebased `UserCabinetStatsService` to work through `TicketQueryService`, so canonical-only tickets and wins are visible in account aggregates.
- Rebased `AdminOperationsQueryService` and `AdminQueueService` so admin snapshots continue to explain queue/terminal/runtime state when a canonical purchase exists without a matching legacy row.

### Web/runtime cutover

- `apps/web/src/lib/purchase/purchase-runtime.ts` now wires canonical-first services for admin queue, receiver, and user cabinet stats.
- `/terminal/receiver`, its inbox API, and the debug inbox now render receiver rows from the canonical projection layer.
- `/admin` now combines canonical-first queue/problem state with alert/audit, cash-desk payout, and winnings-credit visibility.
- `/lottery/bolshaya-8` now shows a canonical-first `Итоги по аккаунту` panel and keeps explicit `Зачислить` vs `В кассу` actions for winning tickets.

### Manual-test and handoff sync

- Launcher scripts now fail loudly on broken preflight/install steps instead of silently continuing after a non-zero `pnpm` exit.
- `start-web-runtime.ps1` prints the main manual-test URLs directly.
- LAN bundle generation now starts the client kiosk from `/login` and documents `/lottery/bolshaya-8` as the manual test target after login.
- Deployment, smoke, admin-console, and handoff docs now match the real current contour, including credit and cash-desk validation.

## Files of Record

- `packages/application/src/services/terminal-receiver-query-service.ts`
- `packages/application/src/services/purchase-request-query-service.ts`
- `packages/application/src/services/ticket-query-service.ts`
- `packages/application/src/services/user-cabinet-stats-service.ts`
- `packages/application/src/services/admin-operations-query-service.ts`
- `packages/application/src/services/admin-queue-service.ts`
- `apps/web/src/lib/purchase/mock-terminal-inbox.ts`
- `apps/web/src/lib/purchase/purchase-runtime.ts`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/app/terminal/receiver/page.tsx`
- `apps/web/src/app/lottery/[lotteryCode]/page.tsx`
- `scripts/start-web-runtime.ps1`
- `scripts/start-worker-runtime.ps1`
- `scripts/start-worker-mock-terminal.ps1`
- `scripts/prepare-worker-runtime.ps1`
- `scripts/build-lan-bundles.ps1`
- `scripts/release-readiness-check.ps1`
- `docs/runbooks/current-working-contour-smoke.md`
- `docs/runbooks/deployment-bootstrap.md`
- `docs/runbooks/launch-readiness-checklist.md`
- `docs/runbooks/admin-operations-console.md`
- `docs/handoff-runtime.md`
- `docs/modules/current-working-contour.md`
- `ARCHITECTURE.md`

## Validation

Executed during the phase:

```powershell
corepack pnpm --filter @lottery/application test -- --runInBand purchase-request-query-service ticket-query-service terminal-receiver-query-service
corepack pnpm --filter @lottery/application test -- --runInBand user-cabinet-stats-service ticket-query-service purchase-request-query-service
corepack pnpm --filter @lottery/application test -- --runInBand admin-operations-query-service operations-alert-service
corepack pnpm --filter @lottery/application test -- --runInBand admin-queue-service
corepack pnpm --filter @lottery/application test -- --runInBand user-cabinet-stats-service
corepack pnpm --filter @lottery/application typecheck
corepack pnpm --filter @lottery/web build
corepack pnpm --filter @lottery/web typecheck
corepack pnpm --filter @lottery/terminal-worker typecheck
corepack pnpm --filter @lottery/infrastructure typecheck
```

Observed result:

- application tests stayed green through the phase and reached 31 files / 156 tests;
- application typecheck passed;
- web build passed;
- web typecheck passed after build;
- terminal-worker and infrastructure typecheck passed.

## Remaining Gaps

1. TTL-based execution lock is still in place; Phase 24 will replace it with advisory locking.
2. Queue transport is still the current compatibility boundary; it has not yet been hardened behind a cleaner transport seam.
3. Legacy write-model storage is still present and will only be removed after the dedicated parity and regression-hardening phase.
4. Real checkout/payment automation after cart stage is still not complete, so this remains manual-test ready rather than production-ready.
