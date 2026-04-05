# ADR-000: Project Principles

## Status

Accepted

## Context

The project is being built for long-lived operation and future modification by independent sessions. Core rules need to be explicit before implementation starts.

## Decisions

1. The system has exactly one active main terminal in v1.
2. Lottery behavior is registry-driven and implemented through predefined handlers.
3. Balance is modeled as an internal ledger with explicit reserve, debit, release, and credit transitions.
4. UI, domain logic, and terminal automation remain in separate modules.
5. Every phase must be partially runnable and testable without the production terminal.
6. Repository docs must be sufficient for a future session to continue without chat memory.

## Consequences

- Runtime architecture must support a separate execution worker.
- Queue ownership and financial idempotency are non-negotiable.
- Documentation and handoff artifacts are part of the product, not side work.
