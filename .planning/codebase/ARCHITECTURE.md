# Architecture

## System Shape

The system is a modular LAN web platform with one execution terminal. Business rules stay in platform services; browser automation stays behind lottery-specific terminal adapters.

## Core Modules

1. Access and sessions
2. Lottery registry and form metadata
3. Draw data ingestion and freshness
4. Balance ledger and wallet history
5. Purchase orchestration and request state machine
6. Queue and single-terminal execution worker
7. Ticket persistence and post-draw verification
8. Admin operations and observability
9. Audit and event logging

## Boundary Rules

- UI never owns terminal automation logic.
- Ledger is lottery-agnostic and linked only by request and ticket references.
- Registry is the source of truth for visibility, order, schemas, and handler bindings.
- Terminal adapters execute predefined handlers by lottery code; no runtime-generated logic from user input.
- Every module must remain testable with stubs or mocks.

## Primary Flows

### Purchase

`UI -> Access -> Registry/Draws -> Purchase Orchestrator -> Ledger Reserve -> Queue -> Terminal Worker -> Result Parser -> Ledger Finalize -> Audit -> UI/Admin`

### Ticket Result

`Scheduler/Admin Trigger -> Terminal Worker -> Ticket Result Processor -> Ledger Credit -> Audit -> UI/Admin`
