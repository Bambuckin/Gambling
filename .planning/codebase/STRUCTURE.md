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
  - Next.js runtime shell with Phase 2 access and role-guard routes.
  - Current entrypoints: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/login/page.tsx`, `src/app/lottery/[lotteryCode]/page.tsx`, `src/app/admin/page.tsx`, `src/app/denied/page.tsx`, `src/middleware.ts`.
  - Access helpers: `src/lib/access/access-runtime.ts`, `src/lib/access/entry-flow.ts`, `src/lib/access/session-cookie.ts`, `src/lib/access/cookie-names.ts`, `src/lib/access/lottery-catalog.ts`, `src/lib/access/role-guard.ts`.
  - Build wiring: `next.config.ts` (workspace package transpile + extension alias for NodeNext imports).
- `apps/terminal-worker`
  - Worker process host for queue + terminal execution flows.
  - Current entrypoint: `src/main.ts`.

## Shared Packages

- `packages/domain`
  - Shared contracts and state transitions.
  - Key files: `request-state.ts`, `ledger.ts`, `lottery-registry.ts`, `draw.ts`, `ticket.ts`, `access.ts`, `access-audit.ts`.
- `packages/application`
  - Use-case ports between orchestration and adapters.
  - Key files: `ports/terminal-executor.ts`, `ports/queue.ts`, `ports/time-source.ts`, `ports/identity-store.ts`, `ports/session-store.ts`, `ports/password-verifier.ts`, `ports/access-audit-log.ts`, `services/access-service.ts`.
- `packages/infrastructure`
  - Adapter package for infrastructure implementations.
  - Key files: `access/in-memory-identity-store.ts`, `access/in-memory-session-store.ts`, `access/in-memory-access-audit-log.ts`, `access/sha256-password-verifier.ts`.
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
- `.planning/STATE.md` and `.planning/phases/02-access-and-unified-shell/.continue-here.md` are current session continuity anchors.

## Extension Paths

- New lottery support extends `packages/lottery-handlers` contracts + registry bindings.
- Access/session persistence can replace in-memory adapters by implementing application ports in `packages/infrastructure/src/access/`.
- Access audit persistence can swap in-memory adapter by implementing `AccessAuditLog` port in `packages/application/src/ports/access-audit-log.ts`.
- Web shell can bind external data sources via `LOTTERY_ACCESS_IDENTITIES_JSON` and `LOTTERY_SHELL_LOTTERIES_JSON` without touching route code.
- Role routing decisions are centralized in `src/lib/access/role-guard.ts` and reused by middleware + server access guards.
- New operational flows should add runbooks under `docs/runbooks/`.
- New module boundaries must be reflected in `docs/modules/boundary-catalog.md`.
