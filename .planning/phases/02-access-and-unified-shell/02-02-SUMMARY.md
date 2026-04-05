---
phase: 02-access-and-unified-shell
plan: 02
subsystem: web-shell
tags: [web, login, session-cookie, redirect-flow, composable-runtime]
requires:
  - phase: 02-01
    provides: access service and session lifecycle contracts
provides:
  - login route with server action and failure mapping
  - protected lottery shell route with redirect-to-login behavior
  - post-login return to originally requested lottery route
  - data-driven access runtime factory and lottery catalog loading from env JSON
affects: [phase-02, phase-03]
tech-stack:
  added: []
  patterns: [runtime adapter factory, env-seeded identities, protected-route entry flow]
key-files:
  created:
    - apps/web/src/app/login/page.tsx
    - apps/web/src/app/lottery/[lotteryCode]/page.tsx
    - apps/web/src/lib/access/access-runtime.ts
    - apps/web/src/lib/access/entry-flow.ts
    - apps/web/src/lib/access/session-cookie.ts
    - apps/web/src/lib/access/lottery-catalog.ts
    - apps/web/next.config.ts
  modified:
    - apps/web/package.json
    - apps/web/tsconfig.json
    - apps/web/src/app/layout.tsx
    - apps/web/src/app/page.tsx
key-decisions:
  - "Web shell uses composable runtime factory so identity/session adapters can be replaced by ready modules later."
  - "Lottery list is loaded from data (`LOTTERY_SHELL_LOTTERIES_JSON`) instead of hardcoding UI menu."
  - "Access seed identities can be injected by data (`LOTTERY_ACCESS_IDENTITIES_JSON`) while preserving stable contracts."
patterns-established:
  - "Protected route entry flow lives in `entry-flow.ts` and stays reusable for upcoming role guards."
  - "Session cookie handling is centralized in one helper module with explicit Set-Cookie semantics."
requirements-progress:
  - AUTH-01 (partial: unauthenticated lottery access redirects to login)
  - AUTH-02 (partial: post-login return to requested lottery route)
  - AUTH-04 (partial: cookie-backed session persists across route transitions and refresh)
duration: 34 min
completed: 2026-04-05
---

# Phase 2 Plan 02: Unified Shell Routes Summary

`02-02` is complete.

## Performance

- **Duration:** 34 min
- **Started:** 2026-04-05T16:01:00+05:00
- **Completed:** 2026-04-05T16:35:00+05:00
- **Tasks:** 1
- **Files modified:** 13

## Accomplishments

- Added `/login` route with server action login flow and deterministic error mapping.
- Added protected `/lottery/[lotteryCode]` route using `requireLotteryAccess` guard and logout action.
- Added session cookie helpers and centralized redirect/login flow logic.
- Added composable access runtime factory (`configureAccessRuntime`) plus env-driven data ingestion for identities and lottery catalog.
- Added Next.js webpack aliasing config to consume NodeNext-style workspace modules in the app runtime.

## Verification Performed

- `corepack pnpm --filter @lottery/web typecheck` (passed)
- `corepack pnpm --filter @lottery/web build` (passed, compiled routes: `/`, `/login`, `/lottery/[lotteryCode]`)
- `corepack pnpm typecheck` (passed)
- `corepack pnpm --filter @lottery/application test` (passed)
- `corepack pnpm smoke` (passed)

## Deviations from Plan

### Auto-fixed Issues

**1. Build compatibility gap between Next bundler and NodeNext `.js` import style in workspace packages**
- **Found during:** `@lottery/web build`
- **Issue:** webpack could not resolve `.js` specifiers emitted in package source exports.
- **Fix:** added `apps/web/next.config.ts` with `transpilePackages` and `resolve.extensionAlias` mapping `.js -> .ts/.tsx/.js`.
- **Impact:** no scope drift, but improved module integration path for future phases.

## User Setup Required

- Optional: provide `LOTTERY_ACCESS_IDENTITIES_JSON` and `LOTTERY_SHELL_LOTTERIES_JSON` to bind ready data modules without code changes.

## Next Step

Execute `02-03` (role guards for UI/server boundaries).

---
*Phase: 02-access-and-unified-shell*
*Completed: 2026-04-05*
