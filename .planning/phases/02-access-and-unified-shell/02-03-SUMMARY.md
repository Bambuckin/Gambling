---
phase: 02-access-and-unified-shell
plan: 03
subsystem: web-access-guards
tags: [roles, middleware, admin-route, authorization, guard-reuse]
requires:
  - phase: 02-01
    provides: access/session lifecycle service
  - phase: 02-02
    provides: login and protected shell routes
provides:
  - centralized role guard utilities reused by middleware and server routes
  - middleware request-edge filtering for `/lottery/*` and `/admin/*`
  - admin-only route and deterministic denied-access route
  - role-aware shell navigation without route-local authorization duplication
affects: [phase-02, phase-08]
tech-stack:
  added: []
  patterns: [defense-in-depth role checks, middleware pre-filter + server authoritative guard]
key-files:
  created:
    - apps/web/src/lib/access/cookie-names.ts
    - apps/web/src/lib/access/role-guard.ts
    - apps/web/src/app/admin/page.tsx
    - apps/web/src/app/denied/page.tsx
    - apps/web/src/middleware.ts
  modified:
    - apps/web/src/lib/access/entry-flow.ts
    - apps/web/src/lib/access/session-cookie.ts
    - apps/web/src/app/layout.tsx
    - .planning/phases/02-access-and-unified-shell/02-03-PLAN.md
    - docs/modules/boundary-catalog.md
    - .planning/codebase/STRUCTURE.md
key-decisions:
  - "Middleware uses role-hint cookie for early route filtering, while server-side guard remains authoritative via AccessService authenticate."
  - "Lottery route is treated as user path, admin console is admin-only, and denied route is explicit instead of silent fallback."
patterns-established:
  - "Role decisions are centralized in `role-guard.ts` and reused across middleware and server boundaries."
  - "Session cookie and role-hint cookie are managed together to avoid desync in logout/invalid-session flows."
requirements-progress:
  - AUTH-03 (partial: role-based route and action boundaries enforced for user/admin)
duration: 27 min
completed: 2026-04-05
---

# Phase 2 Plan 03: Role Guards Summary

`02-03` is complete.

## Performance

- **Duration:** 27 min
- **Started:** 2026-04-05T16:19:00+05:00
- **Completed:** 2026-04-05T16:46:00+05:00
- **Tasks:** 1
- **Files modified:** 11

## Accomplishments

- Added centralized role guard module with route policy + redirect decisions.
- Added middleware boundary checks for protected prefixes (`/lottery/*`, `/admin/*`).
- Added admin-only page with guarded server action and explicit denied-access page.
- Updated entry flow to enforce required roles server-side and to maintain session + role-hint cookies consistently.
- Updated layout navigation to show role-appropriate links.

## Verification Performed

- `corepack pnpm --filter @lottery/web typecheck` (passed)
- `corepack pnpm --filter @lottery/web build` (passed; middleware included)
- `corepack pnpm typecheck` (passed)
- `corepack pnpm --filter @lottery/application test` (passed)
- `corepack pnpm smoke` (passed)

## Deviations from Plan

None.

## User Setup Required

None.

## Next Step

Execute `02-04` (access events/logging and verification scenarios).

---
*Phase: 02-access-and-unified-shell*
*Completed: 2026-04-05*
