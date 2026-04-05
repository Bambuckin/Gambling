# Phase 1: Foundation Contracts - Discussion Log

> Audit trail only. Decisions are captured in `01-CONTEXT.md`.

**Date:** 2026-04-05
**Phase:** 01-foundation-contracts
**Areas discussed:** Repository shape, stack decision rules, module contracts, verification strategy, documentation-first workflow

---

## Repository shape

| Option | Description | Selected |
|--------|-------------|----------|
| Single app with mixed concerns | Fast start, weak boundaries | |
| One repo with apps and shared packages | Strong separation between UI, worker, and shared logic | ✓ |
| Multiple repos | Harder coordination and shared contracts | |

**User's choice:** Auto-selected from project requirements and later-session continuity goal.
**Notes:** Future work must resume from files on disk, so explicit app/package separation is preferred.

---

## Stack decision rules

| Option | Description | Selected |
|--------|-------------|----------|
| Lock exact stack immediately in discussion | Faster, but weak justification | |
| Define hard selection criteria and let Phase 1 ADR choose the exact stack | Keeps decision grounded in constraints | ✓ |
| Leave stack fully open | Too ambiguous for future execution | |

**User's choice:** Auto-selected from current repository state and Phase 1 scope.
**Notes:** Phase 1 must produce ADR-backed stack selection before deep scaffolding.

---

## Module contracts

| Option | Description | Selected |
|--------|-------------|----------|
| Start coding features, define contracts later | High drift risk | |
| Define request/ledger/registry/terminal contracts before feature work | Keeps later phases aligned | ✓ |

**User's choice:** Auto-selected from modularity and maintainability requirements.
**Notes:** Stub-capable ports are mandatory.

---

## Verification strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Wait for a full terminal integration before verifying | Too slow and fragile | |
| Create fake adapters and smoke path in Phase 1 | Supports partial delivery | ✓ |

**User's choice:** Auto-selected from requirement for phased, partial testability.
**Notes:** Future plans should preserve a no-production-terminal smoke flow.

---

## Documentation-first workflow

| Option | Description | Selected |
|--------|-------------|----------|
| Docs after scaffold | Easier to forget and drift | |
| Docs in parallel with scaffold | Supports session-independent continuation | ✓ |

**User's choice:** Auto-selected from explicit user instruction.
**Notes:** README, ADRs, module docs, and runbook skeletons are part of Phase 1 deliverables.

## the agent's Discretion

- Exact framework and library choice inside the agreed constraints.
- Exact naming of apps, packages, and scripts.

## Deferred Ideas

- Purchase UI specifics
- Admin dashboard interaction details
- v2+ runtime expansion
