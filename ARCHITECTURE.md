# Architecture

## System Shape

The system is a modular LAN web platform with one execution terminal. Business decisions stay in platform services; browser automation stays behind lottery-specific terminal adapters.

## Core Modules

1. Access and sessions
2. Lottery registry and form metadata
3. Draw data ingestion and freshness
4. Balance ledger and wallet history
5. Purchase orchestration and request state machine
6. Queue and single-terminal execution worker
7. Ticket persistence and post-draw verification
8. Admin operations and observability
9. Audit/event logging

## Boundary Rules

- UI never owns terminal automation logic.
- Ledger is lottery-agnostic and linked only by request/ticket references.
- Registry is the source of truth for lottery visibility, ordering, schemas, and handler bindings.
- Terminal adapters execute predefined handlers by lottery code; no runtime-generated execution logic from user input.
- Every module must be testable in isolation with stubs or mocks.

## Primary Flows

### Purchase

`UI -> Access -> Registry/Draws -> Purchase Orchestrator -> Ledger Reserve -> Queue -> Terminal Worker -> Result Parser -> Ledger Finalize -> Audit -> UI/Admin`

### Ticket Result

`Scheduler/Admin Trigger -> Terminal Worker -> Ticket Result Processor -> Ledger Credit -> Audit -> UI/Admin`

## Delivery Rule

Implementation proceeds in vertical phases so each module slice can be run and verified partially before the full system exists.
