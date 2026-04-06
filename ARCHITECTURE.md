# Architecture

## System Shape

Lottery Terminal Operations System is a LAN-first modular platform with two runtime apps and shared packages:

- `apps/web`: operator and user web interface, server actions, middleware, and read-only debug contours.
- `apps/terminal-worker`: the single active execution host for queue consumption and ticket verification.
- `packages/*`: domain contracts, use-case services, infrastructure adapters, deterministic lottery handlers, and smoke helpers.

The main safety rule is preserved across all modules: at any time only one request may be actively executed on the main terminal.

## Module Topology

### Runtime entrypoints

1. `apps/web` - login/session routing, lottery pages, admin console, verification pages.
2. `apps/terminal-worker` - queue reservation loop, lock lifecycle, terminal handler execution, verification jobs.

### Shared packages

1. `packages/domain` - pure state and type contracts (requests, ledger, registry, ticket lifecycle).
2. `packages/application` - use-case services and ports for access, registry/draw, purchase, queue/terminal, ticket verification, audit/alerts.
3. `packages/infrastructure` - adapter implementations for ports (`in-memory` + `postgres` backends).
4. `packages/lottery-handlers` - deterministic purchase/result handler contracts and registry.
5. `packages/test-kit` - fake terminal and handler adapters for smoke coverage.

Detailed ownership and import constraints live in `docs/modules/boundary-catalog.md`.

## Boundary Rules

- Web routes compose services; they do not own queue, ledger, or terminal business rules.
- Terminal worker owns polling/execution cadence but delegates state transitions to application services.
- Ledger mutations are idempotent and always linked to request or ticket references.
- Registry metadata is the source of truth for lottery visibility, forms, and handler bindings.
- Terminal execution uses predefined handlers by lottery code; runtime-generated execution logic from user payload is forbidden.

## Primary Data Flows

### Purchase Flow

1. User selects lottery and authenticates via `AccessService`.
2. Lottery page resolves registry metadata and draw freshness through `LotteryRegistryService` and `DrawRefreshService`.
3. Purchase payload is validated and quoted by `PurchaseDraftService`.
4. Confirmation snapshot is persisted by `PurchaseRequestService`.
5. Reserve + queue insertion is executed by `PurchaseOrchestrationService`.
6. `apps/terminal-worker` reserves next request through `PurchaseExecutionQueueService` with execution lock.
7. Handler result is persisted via `TerminalExecutionAttemptService`; retry policy is applied by `TerminalRetryService`.
8. Final status, ticket persistence, and ledger finalize/release are reflected for user/admin projections.

### Ticket Verification And Winnings Flow

1. Pending verified tickets are queued by `TicketVerificationQueueService`.
2. Worker resolves result handler and executes deterministic verify call.
3. Result is normalized by `TicketVerificationResultService`.
4. Winning credit is applied through `WalletLedgerService.creditWinnings`.
5. Ticket/result and audit projections become visible in user/admin surfaces.

## Documentation Anchors

- `docs/modules/system-architecture.md` - module map and expanded flow handoff.
- `docs/modules/boundary-catalog.md` - source-of-truth ownership and disallowed integrations.
- `docs/runbooks/` - module verification, regression, and operator procedures.
- `docs/runbooks/launch-readiness-checklist.md` - full launch checklist, machine install matrix, and gap handoff.

## Delivery Rule

Phases are shipped as vertical slices with runnable checks per phase. Every boundary change must update docs and verification notes in the same change set.
