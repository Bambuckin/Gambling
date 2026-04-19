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

1. `packages/domain` - pure state and type contracts (requests, canonical purchase/draw/attempt truth, ledger, registry, ticket lifecycle).
2. `packages/application` - use-case services and ports for access, registry/draw, purchase, canonical persistence seams, queue/terminal, ticket verification, audit/alerts.
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

## Truth Model During Migration

Phases 18-21 introduce an additive canonical truth layer without cutting over the live Big 8 contour all at once:

- Canonical write models are `purchase`, `draw`, and durable `purchase_attempt`.
- Canonical `purchase` separates execution lifecycle, result state, and result visibility.
- Canonical `draw` uses explicit `open -> closed -> settled` lifecycle instead of closure-only semantics.
- Phase 20 makes canonical purchase and purchase-attempt state primary for submit and worker execution.
- Phase 21 makes canonical draw settlement primary for published result visibility in the current admin and user contours.
- Current request, ticket, and admin query services project canonical purchase/attempt truth when it exists, while preserving the legacy read shapes expected by the web surface.
- Current ticket and admin result reads now project canonical result visibility onto legacy ticket rows, and legacy verification jobs are skipped for canonical-managed draws.
- Test reset clears both legacy and canonical runtime stores so local startup remains safe against the additive schema.
- Legacy `purchase_request`, `ticket`, `ticket_verification_job`, `draw_closure`, and TTL execution lock remain in place as compatibility surfaces until later phases.
- Postgres groundwork for canonical tables is additive-only in this phase; no legacy write model is deleted or renamed.

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

During Phases 18-19, runtime execution still flows through the legacy request and ticket contour. Canonical purchase/draw/attempt storage now sits beside it and feeds explicit compatibility projections so later phases can cut storage and worker behavior over without a big-bang rewrite.

### Ticket Verification And Winnings Flow

1. Canonical draw settlement publishes visible win/lose result state through `DrawClosureService` and `TicketQueryService` projections.
2. Pending verified tickets are still queued by `TicketVerificationQueueService` only for the remaining legacy compatibility contour.
3. Worker resolves result handler and executes deterministic verify call when a legacy verification job still exists.
4. Result is normalized by `TicketVerificationResultService`.
5. Winning credit is applied through `WalletLedgerService.creditWinnings`.
6. Ticket/result and audit projections become visible in user/admin surfaces.

Winning fulfillment still follows the legacy credit/claim contour until Phase 22 rebases money-side effects onto canonical purchase/draw result truth.

## Documentation Anchors

- `docs/modules/system-architecture.md` - module map and expanded flow handoff.
- `docs/modules/boundary-catalog.md` - source-of-truth ownership and disallowed integrations.
- `docs/runbooks/` - module verification, regression, and operator procedures.
- `docs/runbooks/launch-readiness-checklist.md` - full launch checklist, machine install matrix, and gap handoff.

## Delivery Rule

Phases are shipped as vertical slices with runnable checks per phase. Every boundary change must update docs and verification notes in the same change set.
