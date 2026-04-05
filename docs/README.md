# Documentation Map

This repository uses documentation as an execution surface, not as an afterthought.

## Sections

- `docs/adr/` — decisions that lock architecture, stack, and repository shape
- `docs/modules/` — stable module boundaries, contracts, and ownership
- `docs/runbooks/` — operational procedures, recovery, and extension workflows

## Phase 1 Documentation Deliverables

- ADR for stack and repo shape
- module boundary catalog
- local verification guide
- lottery handler extension guide
- operator runbooks for queue, terminal, and incident triage

## Session Independence Rule

A future agent must be able to resume by reading repository files only. If a decision matters later, it belongs in one of the docs above or in `.planning/`.
