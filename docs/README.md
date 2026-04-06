# Documentation Map

Documentation in this repository is part of execution, not a post-factum attachment.

## Core Sections

- `docs/START-HERE.md` - first-entry orientation for a new engineer/model.
- `docs/adr/` - architecture, stack, and repository-shape decisions.
- `docs/modules/` - implemented architecture map, boundaries, contracts, extension guidance.
- `docs/runbooks/` - verification and operational procedures from local bootstrap to release checks.
- `docs/handoff-runtime.md` - explicit continuation scope for another model/account.

## Architecture And Modules

- `docs/adr/ADR-000-project-principles.md` - immutable project principles.
- `docs/adr/ADR-001-stack-and-repo-shape.md` - selected workspace baseline.
- `ARCHITECTURE.md` - current system shape, module topology, and core data flows.
- `docs/modules/system-architecture.md` - expanded runtime/package flow map.
- `docs/modules/boundary-catalog.md` - source-of-truth module ownership and allowed/disallowed integration points.
- `docs/modules/lottery-handler-extension.md` - deterministic workflow for adding/changing lottery handlers.

## Session Independence Rule

A future session must be able to continue from repository files alone.  
If a decision affects future implementation, write it to `docs/` or `.planning/` immediately.

## Runbooks

- `docs/runbooks/local-bootstrap.md` - local environment and baseline checks.
- `docs/runbooks/fake-terminal-smoke.md` - smoke validation without production terminal.
- `docs/runbooks/purchase-request-verification.md` - purchase lifecycle and queue status checks.
- `docs/runbooks/queue-incident-triage.md` - queue/terminal incident triage.
- `docs/runbooks/admin-operations-console.md` - admin operations and observability checks.
- `docs/runbooks/ticket-persistence-verification.md` - ticket persistence and winnings verification.
- `docs/runbooks/deployment-bootstrap.md` - machine-role deployment bootstrap for LAN runtime.
- `docs/runbooks/launch-readiness-checklist.md` - full launch gap checklist and install matrix per machine.

## Continuation Entry Points

1. `.planning/STATE.md`
2. `.planning/ROADMAP.md`
3. `.planning/phases/*/.continue-here.md`
4. `docs/modules/boundary-catalog.md`
