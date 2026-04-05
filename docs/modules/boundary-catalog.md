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
- UI, domain, queue, ledger, and terminal adapters must remain separated.

## Module Ownership Matrix

| Module | Owns | Must Not Own | Current Entrypoints |
|---|---|---|---|
| `apps/web` | Web runtime shell and page routing entrypoint | Terminal automation details, ledger mutation logic, queue worker behavior | `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx` |
| `apps/terminal-worker` | Worker process boot and execution host process | UI rendering, user session logic, lottery pricing/domain rules | `apps/terminal-worker/src/main.ts` |
| `packages/domain` | Core contracts: request lifecycle, ledger operations, registry records, draw/ticket shapes | Transport protocols, DB wiring, queue engine implementation, browser automation selectors | `packages/domain/src/index.ts` |
| `packages/application` | Typed ports for terminal execution, queue, and time source | Concrete adapter SDK bindings, JSX/UI concerns, persistence schema definitions | `packages/application/src/index.ts` |
| `packages/infrastructure` | Infrastructure-facing abstraction placeholders and adapter boundary stubs | Domain state-machine ownership, handler business behavior, UI composition | `packages/infrastructure/src/index.ts` |
| `packages/lottery-handlers` | Stable contracts for purchase/result handlers by lottery code | Web route/session handling, queue ownership, ledger accounting logic | `packages/lottery-handlers/src/contracts.ts`, `packages/lottery-handlers/src/index.ts` |
| `packages/test-kit` | Fake terminal and fake lottery handlers for smoke/integration scaffolds | Production queue scheduling, production terminal sessions, final business truth | `packages/test-kit/src/fake-terminal.ts`, `packages/test-kit/src/fake-lottery-handler.ts` |

## Integration Points (Allowed)

1. `apps/web` may consume exported contracts from `@lottery/domain` and application services later, but never call terminal adapters directly.
2. `apps/terminal-worker` may depend on `@lottery/application`, `@lottery/infrastructure`, and `@lottery/lottery-handlers` to run execution workflows.
3. `@lottery/lottery-handlers` contracts must align with registry bindings from `@lottery/domain`.
4. `@lottery/test-kit` must implement application/handler contracts without adding production-only assumptions.

## Integration Points (Disallowed)

1. Direct `apps/web` imports from terminal adapter implementation files.
2. Domain package imports from runtime apps.
3. Handler logic embedding web request/session concerns.
4. Worker boot code embedding lottery-specific selector logic inline.

## Verification Notes

- `corepack pnpm typecheck` confirms module exports and import boundaries compile.
- `corepack pnpm test` currently validates request-state rules in `@lottery/domain`.
- `corepack pnpm smoke` validates test-kit smoke entrypoint without a production terminal.

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
