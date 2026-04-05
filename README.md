# Lottery Terminal Operations System

Status: planning-ready, implementation not started.

This repository is organized so a future session can resume work from files on disk without relying on prior chat context.

## Start Here

1. `.planning/STATE.md`
2. `.planning/PROJECT.md`
3. `.planning/REQUIREMENTS.md`
4. `.planning/ROADMAP.md`
5. `.planning/phases/01-foundation-contracts/01-CONTEXT.md`
6. `.planning/phases/01-foundation-contracts/01-RESEARCH.md`
7. `.planning/phases/01-foundation-contracts/01-01-PLAN.md` through `01-04-PLAN.md`
8. `.planning/phases/01-foundation-contracts/.continue-here.md`

## Current Intent

Build a LAN web system for lottery ticket operations with:

- one shared user/admin web interface,
- one main execution terminal,
- registry-driven lottery modules,
- internal balance ledger with reserve/debit/release/credit flows,
- deterministic terminal handlers,
- full operational and documentation traceability.

## Working Rules

- Keep business logic out of UI and terminal apps.
- Treat balance and request state transitions as auditable domain events.
- Add or change lotteries only through documented registry and handler contracts.
- Preserve stepwise delivery: every phase must remain partially runnable and testable.
- Update planning and docs artifacts when boundaries or decisions change.

## Documentation Map

- `docs/adr/` — architectural decisions and principles
- `docs/modules/` — module responsibilities and extension notes
- `docs/runbooks/` — operator and maintenance procedures
- `.planning/` — GSD roadmap, phase context, plans, state, and handoff artifacts

## Environment Note

- Git is installed, available on PATH, and this repository is already initialized on `main`.
- In this Codex desktop environment, some `gsd-tools` operations that spawn `git` from Node may need an unrestricted shell because sandboxed child-process spawns can fail with `EPERM`. That is an execution-environment constraint, not a repository setup problem.

## Immediate Next Step

Resume with Phase 1 execution starting at `.planning/phases/01-foundation-contracts/01-01-PLAN.md`.
