# Module Boundary Catalog

This catalog is the source of truth for ownership in the current scaffold.
Use it before changing code across `apps/*` and `packages/*`.

## Global Boundary Rules

- `apps/web` and `apps/terminal-worker` are runtime entrypoints, not business-rule owners.
- `packages/domain` defines pure contracts and state rules, with no runtime side effects.
- `packages/application` defines orchestration ports and use-case boundaries.
- `packages/infrastructure` contains adapter-facing abstractions, not UI or workflow decisions.
- `packages/lottery-handlers` owns deterministic lottery handler contracts and later concrete handlers.
- `packages/test-kit` owns fake adapters and smoke helpers for local verification.
- Access identities and session lifecycle rules live in domain/application/infrastructure packages, never in runtime route files.
- UI, domain, queue, ledger, and terminal adapters must remain separated.

## Module Ownership Matrix

| Module | Owns | Must Not Own | Current Entrypoints |
|---|---|---|---|
| `apps/web` | Web runtime shell, login/user/admin/denied/debug routes, middleware pre-filter, route-level access flow (`src/lib/access/*`), registry runtime composition (`src/lib/registry/*`), admin registry mutation flow (`src/lib/registry/admin-registry.ts`), draw runtime composition (`src/lib/draw/*`), ledger runtime composition (`src/lib/ledger/*`), and dynamic lottery form renderer (`src/lib/lottery-form/*`) | Terminal automation details, ledger mutation rules, queue worker behavior, direct auth-store mutation bypassing application service, registry business rules embedded in route files | `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx`, `apps/web/src/app/login/page.tsx`, `apps/web/src/app/lottery/[lotteryCode]/page.tsx`, `apps/web/src/app/admin/page.tsx`, `apps/web/src/app/debug/access-lab/page.tsx`, `apps/web/src/app/debug/registry-lab/page.tsx`, `apps/web/src/middleware.ts` |
| `apps/terminal-worker` | Worker process boot and execution host process | UI rendering, user session logic, lottery pricing/domain rules | `apps/terminal-worker/src/main.ts` |
| `packages/domain` | Core contracts: request lifecycle, ledger operations + immutable aggregate invariants, registry records (including dynamic form metadata), draw/ticket shapes, access identity/session lifecycle types, and access audit event schema | Transport protocols, DB wiring, queue engine implementation, browser automation selectors | `packages/domain/src/index.ts`, `packages/domain/src/access.ts`, `packages/domain/src/access-audit.ts`, `packages/domain/src/ledger.ts`, `packages/domain/src/lottery-registry.ts` |
| `packages/application` | Typed ports and use cases for terminal execution, queue, time source, access/session orchestration, wallet ledger orchestration, access audit emission, lottery registry orchestration (including enable/disable/reorder mutations), and draw freshness orchestration | Concrete adapter SDK bindings, JSX/UI concerns, persistence schema definitions | `packages/application/src/index.ts`, `packages/application/src/services/access-service.ts`, `packages/application/src/services/wallet-ledger-service.ts`, `packages/application/src/services/lottery-registry-service.ts`, `packages/application/src/services/draw-refresh-service.ts`, `packages/application/src/ports/access-audit-log.ts`, `packages/application/src/ports/ledger-store.ts`, `packages/application/src/ports/lottery-registry-store.ts`, `packages/application/src/ports/draw-store.ts` |
| `packages/infrastructure` | Adapter implementations for infrastructure concerns, including in-memory access identity/session stores, password verifier, access audit log, lottery registry storage, draw snapshot storage, and immutable ledger storage | Domain state-machine ownership, handler business behavior, UI composition | `packages/infrastructure/src/index.ts`, `packages/infrastructure/src/access/in-memory-identity-store.ts`, `packages/infrastructure/src/access/in-memory-session-store.ts`, `packages/infrastructure/src/access/in-memory-access-audit-log.ts`, `packages/infrastructure/src/registry/in-memory-lottery-registry-store.ts`, `packages/infrastructure/src/draw/in-memory-draw-store.ts`, `packages/infrastructure/src/ledger/in-memory-ledger-store.ts` |
| `packages/lottery-handlers` | Stable contracts for purchase/result handlers by lottery code | Web route/session handling, queue ownership, ledger accounting logic | `packages/lottery-handlers/src/contracts.ts`, `packages/lottery-handlers/src/index.ts` |
| `packages/test-kit` | Fake terminal and fake lottery handlers for smoke/integration scaffolds | Production queue scheduling, production terminal sessions, final business truth | `packages/test-kit/src/fake-terminal.ts`, `packages/test-kit/src/fake-lottery-handler.ts` |

## Integration Points (Allowed)

1. `apps/web` may consume exported contracts from `@lottery/domain` and application services later, but never call terminal adapters directly.
2. `apps/terminal-worker` may depend on `@lottery/application`, `@lottery/infrastructure`, and `@lottery/lottery-handlers` to run execution workflows.
3. `@lottery/lottery-handlers` contracts must align with registry bindings from `@lottery/domain`.
4. `@lottery/test-kit` must implement application/handler contracts without adding production-only assumptions.
5. Access/session route handlers may use `AccessService` from `@lottery/application`, but must not bypass storage ports.
6. `apps/web/src/lib/access/access-runtime.ts` may expose adapter-factory composition for ready data modules, but route files must stay unaware of concrete store implementations.
7. `apps/web/src/middleware.ts` may use role-hint pre-checks for early redirects, but authoritative role/session validation stays in server-side access guards.
8. Access lifecycle audit writes must go through `AccessAuditLog` port, never from route files directly.
9. `apps/web/src/lib/registry/registry-runtime.ts` may compose registry adapters, while `apps/web/src/lib/access/lottery-catalog.ts` remains a read-only consumer.
10. Dynamic form field rendering in `apps/web/src/lib/lottery-form/*` consumes domain metadata only; it must not embed registry mutation logic.
11. Draw freshness checks (`missing|stale|fresh`) are resolved in application service and consumed by web UI for purchase gating; route actions must not reimplement freshness math.
12. Admin registry controls may mutate visibility and order only through `apps/web/src/lib/registry/admin-registry.ts` and `LotteryRegistryService`.
13. Wallet balances shown in web routes are read through `WalletLedgerService`; reserve/debit/release mutation logic stays in application layer.

## Integration Points (Disallowed)

1. Direct `apps/web` imports from terminal adapter implementation files.
2. Domain package imports from runtime apps.
3. Handler logic embedding web request/session concerns.
4. Worker boot code embedding lottery-specific selector logic inline.
5. Runtime UI/routes directly mutating identity/session storage without `AccessService`.
6. Treating middleware role-hint cookie as the only authorization check.

## Verification Notes

- `corepack pnpm typecheck` confirms module exports and import boundaries compile.
- `corepack pnpm test` currently validates request-state + ledger invariants in `@lottery/domain`.
- `corepack pnpm --filter @lottery/application test` validates access lifecycle, wallet ledger service, lottery registry service, and draw freshness scenarios.
- `corepack pnpm --filter @lottery/web build` validates role-guarded routes, registry-driven shell, draw freshness gating, and ledger-backed wallet read path wiring.
- `corepack pnpm smoke` validates test-kit smoke entrypoint without a production terminal.
- `docs/runbooks/registry-and-draw-verification.md` is the operator checklist for admin registry controls and draw freshness gating.

## Dependency Direction Policy

- Runtime apps may depend on shared packages; shared packages may not depend on runtime apps.
- `@lottery/domain` is inward-facing and should remain the least coupled package.
- `@lottery/test-kit` may depend on all contracts it fakes, but production code must not depend on `@lottery/test-kit`.
- Terminal-specific adapter details must stay behind interfaces from `@lottery/application` and handler contracts.

## Change Checklist

1. Confirm ownership in this catalog before adding files.
2. If ownership changes, update this catalog and related runbooks in the same commit.
3. If boundary changes are architectural, add or update an ADR.

When a change violates this catalog, update this file (and ADR if needed) before merging.
