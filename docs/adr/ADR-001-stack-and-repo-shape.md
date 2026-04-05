# ADR-001: Stack and Repository Shape

## Status

Accepted

## Date

2026-04-05

## Context

Phase 1 must lock the implementation baseline before broad scaffolding starts.
The project has strict constraints:

- one active execution terminal at a time;
- transactional financial operations with idempotent reserve/debit/release/credit flows;
- deterministic lottery handlers (no runtime-generated scripts);
- phased delivery with local smoke paths and fake adapters;
- resumability from repository files without chat memory.

## Compared Options

### Option A (selected)

TypeScript pnpm workspace monorepo:

- `apps/web`: Next.js web app for shared user/admin interface.
- `apps/terminal-worker`: Node.js worker for queue execution, schedulers, and terminal orchestration.
- `packages/domain`: pure domain models and state transitions.
- `packages/application`: use cases and orchestration contracts.
- `packages/infrastructure`: DB, queue, and adapter implementations.
- `packages/lottery-handlers`: predefined lottery-specific handlers.
- `packages/test-kit`: fakes, fixtures, and smoke/integration helpers.

Technology baseline:

- Node.js LTS + TypeScript (strict mode).
- PostgreSQL as primary relational store.
- Prisma for schema/migrations and typed data access.
- `pg-boss` for durable Postgres-backed queue with single-worker execution mode.
- Playwright behind terminal adapter interfaces.
- Vitest for unit/integration and smoke harness composition.

### Option B (rejected)

TypeScript workspace with split SPA + API + Redis queue:

- React (Vite) web client + NestJS API backend.
- PostgreSQL + Prisma for persistence.
- BullMQ + Redis for queue semantics.
- Separate browser automation module.

## Decision

Select **Option A** as the Phase 1 baseline.

This ADR locks:

- package manager: `pnpm` workspace;
- repository shape: `apps/*` and `packages/*` with explicit module boundaries;
- runtime split: `apps/web` and `apps/terminal-worker`;
- shared package layout including `packages/test-kit` for deterministic local verification.

## Why This Decision Fits the Constraints

1. One-terminal execution: `apps/terminal-worker` owns queue consumption; `pg-boss` can enforce one active worker lane tied to terminal lock semantics.
2. Financial integrity: PostgreSQL + Prisma enables transactional boundaries for reserve/debit/release/credit flows with auditable persistence.
3. Fake adapter strategy: contracts live in `packages/domain` and `packages/application`; fakes/fixtures stay in `packages/test-kit` without leaking test code into runtime modules.
4. Modularity: UI, orchestration, queue/infrastructure, and lottery handlers are physically separated.
5. Session resumability: the directory shape and scripts are explicit, so future sessions can continue from files on disk.

## Consequences

- Root workspace files must be created in this plan: `package.json`, `pnpm-workspace.yaml`, and `tsconfig.base.json`.
- All future Phase 1 plans must align with this module map and may not merge terminal logic into the web app.
- If stack changes are needed later, they require a new ADR rather than ad-hoc edits.

## Initial Workspace Contract

The root scripts baseline is:

- `dev:web`
- `dev:worker`
- `lint`
- `typecheck`
- `test`
- `smoke`

These scripts are required now even before full app scaffold so later plans can plug concrete commands into a stable interface.
