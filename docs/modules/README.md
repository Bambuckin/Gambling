# Module Boundaries

This folder is the navigation entrypoint for implemented module ownership.
Use these docs before touching cross-module logic.

## Core References

- `docs/modules/system-architecture.md` - runtime and package data-flow map.
- `docs/modules/boundary-catalog.md` - authoritative ownership matrix and integration rules.
- `docs/modules/lottery-handler-extension.md` - handler extension/change workflow.

## Implemented Module Inventory

### Runtime apps

1. `apps/web`: user/admin surfaces, route composition, role-aware access, debug verification pages.
2. `apps/terminal-worker`: queue reservation, execution lock coordination, handler execution, verification queue processing.

### Shared packages

1. `packages/domain`: pure domain contracts and state rules.
2. `packages/application`: use-case services and typed ports.
3. `packages/infrastructure`: adapter implementations (currently in-memory).
4. `packages/lottery-handlers`: deterministic purchase/result handlers and registry bindings.
5. `packages/test-kit`: fake adapters for smoke/local validation.

## Boundary Rule

If a change crosses module boundaries, update `docs/modules/boundary-catalog.md` (and ADR if architectural).
