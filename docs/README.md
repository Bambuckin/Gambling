# Documentation Map

Documentation in this repository is part of execution, not a post-factum attachment.

## Core Sections

- `docs/adr/` - architecture, stack, and repository-shape decisions.
- `docs/modules/` - stable module boundaries, contracts, and ownership.
- `docs/runbooks/` - operational procedures, bootstrap, and incident handling.

## Current Foundation Reference

- `docs/adr/ADR-000-project-principles.md` - immutable project principles.
- `docs/adr/ADR-001-stack-and-repo-shape.md` - selected workspace baseline.

ADR-001 defines the workspace layout used by Phase 1:

- `apps/web`
- `apps/terminal-worker`
- `packages/domain`
- `packages/application`
- `packages/infrastructure`
- `packages/lottery-handlers`
- `packages/test-kit`

## Session Independence Rule

A future session must be able to continue from repository files alone.  
If a decision affects future implementation, write it to `docs/` or `.planning/` immediately.

## Entry Links for Continuation

1. `.planning/STATE.md`
2. `.planning/ROADMAP.md`
3. `.planning/phases/01-foundation-contracts/.continue-here.md`
4. `docs/adr/ADR-001-stack-and-repo-shape.md`
