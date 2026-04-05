# Codebase Structure Map

This map documents the scaffold created in Phase 1 so future sessions can navigate by intent.

## Top-Level Layout

```text
apps/
  web/
  terminal-worker/
packages/
  domain/
  application/
  infrastructure/
  lottery-handlers/
  test-kit/
docs/
  adr/
  modules/
  runbooks/
.planning/
  phases/
  research/
  codebase/
```

## Runtime Apps

- `apps/web`
  - Next.js runtime shell.
  - Current entrypoints: `src/app/layout.tsx`, `src/app/page.tsx`.
- `apps/terminal-worker`
  - Worker process host for queue + terminal execution flows.
  - Current entrypoint: `src/main.ts`.

## Shared Packages

- `packages/domain`
  - Shared contracts and state transitions.
  - Key files: `request-state.ts`, `ledger.ts`, `lottery-registry.ts`, `draw.ts`, `ticket.ts`.
- `packages/application`
  - Use-case ports between orchestration and adapters.
  - Key files: `ports/terminal-executor.ts`, `ports/queue.ts`, `ports/time-source.ts`.
- `packages/infrastructure`
  - Adapter boundary placeholder package for infrastructure integrations.
- `packages/lottery-handlers`
  - Contracts for deterministic purchase and result handlers by lottery code.
  - Key file: `contracts.ts`.
- `packages/test-kit`
  - Fake adapters and smoke helpers.
  - Key files: `fake-terminal.ts`, `fake-lottery-handler.ts`.

## Documentation and Planning Anchors

- `docs/adr/ADR-001-stack-and-repo-shape.md` is the stack and shape gate.
- `docs/modules/boundary-catalog.md` defines ownership and anti-ownership rules.
- `docs/runbooks/` carries repeatable operator and local verification procedures.
- `.planning/STATE.md` and `.planning/phases/01-foundation-contracts/.continue-here.md` are session continuity anchors.

## Extension Paths

- New lottery support extends `packages/lottery-handlers` contracts + registry bindings.
- New operational flows should add runbooks under `docs/runbooks/`.
- New module boundaries must be reflected in `docs/modules/boundary-catalog.md`.
