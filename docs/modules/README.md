# Module Boundaries

This folder is the navigation entrypoint for implemented module ownership.
Use these docs before touching cross-module logic.

## Core References

- `docs/modules/system-architecture.md` - runtime and package data-flow map.
- `docs/modules/current-working-contour.md` - what the current real operator-facing slice does today.
- `docs/modules/boundary-catalog.md` - authoritative ownership matrix and integration rules.
- `docs/modules/lottery-handler-extension.md` - handler extension/change workflow.
- `docs/modules/ui-customization.md` - visual layer customization and NLoto seed source map.

## Workspace Maps

- `apps/web/README.md` - page and runtime composition map for the web app.
- `apps/terminal-worker/README.md` - worker loop and handler runtime map.
- `packages/domain/README.md` - domain file ownership.
- `packages/application/README.md` - port/service ownership.
- `packages/infrastructure/README.md` - adapter/schema ownership.
- `packages/lottery-handlers/README.md` - handler contract ownership.
- `packages/test-kit/README.md` - fake helper ownership.

## Implemented Module Inventory

### Runtime apps

1. `apps/web`: user/admin surfaces, route composition, role-aware access, debug verification pages.
2. `apps/terminal-worker`: queue reservation, execution lock coordination, handler execution, verification queue processing.

### Shared packages

1. `packages/domain`: pure domain contracts and state rules.
2. `packages/application`: use-case services and typed ports.
3. `packages/infrastructure`: adapter implementations (`in-memory` and `postgres`).
4. `packages/lottery-handlers`: deterministic purchase/result handlers and registry bindings.
5. `packages/test-kit`: fake adapters for smoke/local validation.

## Boundary Rule

If a change crosses module boundaries, update `docs/modules/boundary-catalog.md` (and ADR if architectural).
