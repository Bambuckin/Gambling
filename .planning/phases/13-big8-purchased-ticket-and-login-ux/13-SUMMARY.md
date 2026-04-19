---
phase: 13-big8-purchased-ticket-and-login-ux
plan: all
subsystem: purchase-completion-login-ux
tags: [purchase-completion, identity-seed, login-ux, registry-modes]
requires:
  - phase: 11
    provides: real Big 8 cart-stage execution and realtime status
provides:
  - centralized demo identity seed with cashier1/cashier2 accounts
  - Big 8 emulate_after_cart purchase completion through existing success path
  - per-lottery purchaseCompletionMode and drawFreshnessMode registry fields
  - warn_only stale-draw handling for Big 8
  - login page copy-UX for demo accounts
  - regular-user default landing on /lottery/bolshaya-8
affects: [domain, application, infrastructure, terminal-worker, web]
tech-stack:
  added: [PurchaseCompletionService, DemoIdentitySeed type, DemoAccountList client component]
  patterns: [emulate_after_cart completion, centralized identity seed, per-lottery registry modes]
key-files:
  modified:
    - packages/domain/src/access.ts
    - packages/domain/src/lottery-registry.ts
    - packages/domain/src/request-state.ts
    - packages/domain/src/draw.ts
    - packages/infrastructure/src/seeds/default-lottery-catalog.ts
    - packages/infrastructure/src/index.ts
    - packages/application/src/services/draw-refresh-service.ts
    - packages/application/src/index.ts
    - apps/web/src/lib/access/access-runtime.ts
    - apps/web/src/lib/access/entry-flow.ts
    - apps/web/src/lib/access/lab-scenarios.ts
    - apps/web/src/app/login/page.tsx
    - apps/web/src/app/lottery/[lotteryCode]/page.tsx
    - apps/web/src/app/admin/page.tsx
    - apps/terminal-worker/src/main.ts
    - scripts/postgres-init-and-seed.ts
  added:
    - packages/infrastructure/src/seeds/default-identity-seeds.ts
    - apps/web/src/lib/access/demo-account-list.tsx
    - packages/application/src/services/purchase-completion-service.ts
    - packages/application/src/__tests__/purchase-completion-service.test.ts
key-decisions:
  - "DemoIdentitySeed type in domain + centralized seed array in infrastructure — single source of truth for all identity consumers"
  - "PurchaseCompletionService in application is the future home for real checkout; currently implements emulate_after_cart"
  - "added_to_cart -> success transition added to request state machine as honest intermediate-to-final path"
  - "purchaseCompletionMode and drawFreshnessMode are per-lottery registry fields — extensible without code changes"
  - "Worker reads completion mode from seed registry entries; future migration to runtime registry store is straightforward"
patterns-established:
  - "Post-cart completion is a pluggable application service, not inline worker logic"
  - "Identity seeds flow from one source to all consumers (in-memory, postgres, login UI)"
  - "Per-lottery behavioral modes live in the registry, not scattered conditionals"
requirements-completed: []
duration: 25 min
completed: 2026-04-16
---

# Phase 13: Big 8 Purchase Completion and Login UX - Summary

Phase 13 is complete.

## Performance

- **Duration:** 25 min
- **Started:** 2026-04-16T17:13:00+05:00
- **Completed:** 2026-04-16T17:38:00+05:00
- **Plans executed:** 4 (13-01 through 13-04)
- **Files modified:** 16
- **Files added:** 4

## Accomplishments

### 13-01: Centralized demo identities + post-login route
- Added `DemoIdentitySeed` type and `buildIdentityFromSeed()` in domain (`packages/domain/src/access.ts`)
- Created `packages/infrastructure/src/seeds/default-identity-seeds.ts` — single source of truth for 5 accounts: operator, admin, tester, cashier1, cashier2
- Refactored `access-runtime.ts` and `postgres-init-and-seed.ts` to consume centralized seeds
- Added initial balance ledger seeds for cashier1 and cashier2
- Fixed post-login route: regular user → `/lottery/bolshaya-8`, admin → `/admin`
- Updated `sanitizeLotteryCode` default to `bolshaya-8`

### 13-02: Login page demo account list + copy UX
- Created `DemoAccountList` client component with copy buttons for login/password
- Login page reads demo accounts from centralized seed via server-side import
- Each account shows label, credentials, and copy-to-clipboard buttons

### 13-03: Registry modes + stale-draw warn_only
- Added `LotteryPurchaseCompletionMode` and `LotteryDrawFreshnessMode` types to domain
- Added `purchaseCompletionMode` and `drawFreshnessMode` optional fields to `LotteryRegistryEntry`
- Big 8 catalog entry: `emulate_after_cart` + `warn_only`
- Updated `resolveDrawAvailabilityState` to respect freshness mode
- `DrawRefreshService.getDrawState` accepts optional `freshnessMode` parameter
- Updated all web callers to pass `drawFreshnessMode` from registry entry

### 13-04: PurchaseCompletionService
- Added `added_to_cart → success` transition in request state machine
- Created `PurchaseCompletionService` in application layer — future home for real checkout
- Service synthesizes deterministic success after cart stage with `${requestId}:cart-emulated` reference
- Ticket created through existing `ticketPersistenceService.persistSuccessfulPurchaseTicket`
- Worker wires completion service and triggers it after `added_to_cart` outcome for lotteries with matching completion mode
- 4 unit tests covering completion, skip-on-direct, skip-on-wrong-state, and deterministic reference

## Verification Performed

- `corepack pnpm --filter @lottery/domain test` — 42 passed
- `corepack pnpm --filter @lottery/application test` — 92 passed (4 new)
- `corepack pnpm --filter @lottery/infrastructure typecheck` — clean
- `corepack pnpm --filter @lottery/terminal-worker typecheck` — clean
- `corepack pnpm --filter @lottery/web build` — clean
- `corepack pnpm typecheck` — all packages clean

## Deviations from Plan

None. All four sub-plans executed as designed.

## User Setup Required

If using Postgres backend, re-run seed script to populate new cashier accounts:
```powershell
corepack pnpm --filter @lottery/scripts seed --seed-mode=force
```

## Next Step

Phase 14: Admin-Driven Draw Emulation and Notifications.

---

*Phase: 13-big8-purchased-ticket-and-login-ux*
*Completed: 2026-04-16*
