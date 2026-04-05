# Phase 1: Foundation Contracts - Research

## Objective

Reduce ambiguity for the first implementation session by narrowing the technical decision space for stack, repository layout, contracts, and verification.

## Decision Axes

1. **Web surface**: one app serving user + admin routes vs split apps
2. **Worker runtime**: separate Node service for terminal execution and scheduled jobs
3. **Persistence**: relational database with migration support and strong transactional behavior
4. **Queue**: durable sequential queue that can enforce single active terminal work
5. **Automation**: browser automation library isolated behind adapters
6. **Testing**: unit + contract + integration + smoke path without production terminal

## Shortlist Constraints

- Prefer TypeScript across app, worker, and shared packages.
- Avoid a stack that forces business logic into UI routes.
- Avoid queue choices that require heavy coordination before a single-worker flow can even run.
- Prefer tooling that can support fake adapters and deterministic fixtures easily.

## Recommended Baseline Direction

- Monorepo/workspace structure
- One web app for user/admin surfaces
- One dedicated terminal worker app
- Shared domain/application packages
- Relational DB + migrations
- Queue strategy that preserves sequential execution guarantees
- Playwright-class browser automation behind adapter ports
- Vitest/Jest-class local verification with fake adapters

## Deliverables Expected from Phase 1

1. ADR selecting final stack and repo shape
2. Initial scaffold following that ADR
3. Shared contract layer and fake adapters
4. Smoke path that proves local bootstrap works
5. Standing docs sufficient for a fresh session to continue without chat memory
