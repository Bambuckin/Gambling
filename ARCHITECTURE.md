# Architecture

## System Shape

Lottery Terminal Operations System is a LAN-first modular platform with two runtime apps and shared packages:

- `apps/web`: operator and user web interface, server actions, middleware, and read-only debug contours.
- `apps/terminal-worker`: the single active execution host for queue consumption, terminal purchase, and winnings-credit processing.
- `packages/*`: domain contracts, use-case services, infrastructure adapters, deterministic lottery handlers, and smoke helpers.

The main safety rule is preserved across all modules: at any time only one request may be actively executed on the main terminal.

## Module Topology

### Runtime entrypoints

1. `apps/web` - login/session routing, lottery pages, admin console, verification pages.
2. `apps/terminal-worker` - queue reservation loop, lock lifecycle, terminal handler execution, credit-job processing.

### Shared packages

1. `packages/domain` - pure state and type contracts (requests, canonical purchase/draw/attempt truth, ledger, registry, ticket lifecycle).
2. `packages/application` - use-case services and ports for access, registry/draw, purchase, canonical persistence seams, queue/terminal, compatibility ticket projection, fulfillment, audit/alerts.
3. `packages/infrastructure` - adapter implementations for ports (`in-memory` + `postgres` backends).
4. `packages/lottery-handlers` - deterministic purchase/result handler contracts and registry.
5. `packages/test-kit` - fake terminal and handler adapters for smoke coverage.

Detailed ownership and import constraints live in `docs/modules/boundary-catalog.md`.

## Boundary Rules

- Web routes compose services; they do not own queue, ledger, or terminal business rules.
- Terminal worker owns polling/execution cadence but delegates state transitions to application services.
- Ledger mutations are idempotent and always linked to canonical purchase plus request/ticket compatibility references when they exist.
- Registry metadata is the source of truth for lottery visibility, forms, and handler bindings.
- Terminal execution uses predefined handlers by lottery code; runtime-generated execution logic from user payload is forbidden.

## Truth Model During Migration

Phases 18-24 introduce an additive canonical truth layer without cutting over the live Big 8 contour all at once:

- Canonical write models are `purchase`, `draw`, and durable `purchase_attempt`.
- Canonical `purchase` separates execution lifecycle, result state, and result visibility.
- Canonical `draw` uses explicit `open -> closed -> settled` lifecycle instead of closure-only semantics.
- Phase 20 makes canonical purchase and purchase-attempt state primary for submit and worker execution.
- Phase 21 makes canonical draw settlement primary for published result visibility in the current admin and user contours.
- Phase 22 makes canonical visible winning purchase state primary for fulfillment eligibility and winnings-credit idempotency.
- Phase 23 makes current admin, terminal receiver, and lottery-page read surfaces canonical-first while preserving the existing route and API shapes.
- Phase 24 replaces TTL lock takeover with advisory execution locking and moves purchase queue send/receive flow behind an explicit transport boundary while the current storage-backed queue backend remains active.
- Current request, ticket, cabinet, receiver, and admin query services project canonical purchase/attempt truth when it exists, while preserving the compatibility read shapes expected by the web surface.
- Current ticket and admin result reads now project canonical result visibility onto compatibility ticket rows, including synthetic canonical ticket views when no legacy row exists.
- Current ticket reads also project fulfillment claim state from cash-desk requests and winnings-credit jobs so canonical-only wins still expose a usable compatibility contour.
- Test reset clears both legacy and canonical runtime stores so local startup remains safe against the additive schema.
- Legacy `purchase_request` and `ticket` remain in place as compatibility surfaces until later phases, while the old TTL lock table has been removed and the legacy verification-job path is no longer part of the active worker contour.
- Postgres groundwork for canonical tables stays additive where current routes still depend on compatibility reads, but active terminal execution and settlement no longer depend on the old lock-table or verification-job write path.

## Primary Data Flows

### Purchase Flow

1. User selects lottery and authenticates via `AccessService`.
2. Lottery page resolves registry metadata and draw freshness through `LotteryRegistryService` and `DrawRefreshService`.
3. Purchase payload is validated and quoted by `PurchaseDraftService`.
4. Confirmation snapshot is persisted by `PurchaseRequestService`.
5. Reserve + queue insertion is executed by `PurchaseOrchestrationService`.
6. `apps/terminal-worker` reserves next request through `PurchaseExecutionQueueService` under advisory execution lock and a replaceable queue transport boundary.
7. Handler result is persisted via `TerminalExecutionAttemptService`; retry policy is applied by `TerminalRetryService`.
8. Final status, ticket persistence, ledger finalize/release, and canonical-first request/receiver/admin projections are reflected back to the current web surfaces.

During Phases 18-19, runtime execution still flows through the legacy request and ticket contour. Canonical purchase/draw/attempt storage now sits beside it and feeds explicit compatibility projections so later phases can cut storage and worker behavior over without a big-bang rewrite.

### Settlement And Winnings Flow

1. Canonical draw settlement publishes visible win/lose result state through `DrawClosureService` and `TicketQueryService` projections.
2. Purchase-success and draw-result notifications no longer depend on writing a legacy ticket row in the active worker path.
3. User or admin chooses an explicit fulfillment path through `WinningFulfillmentService`, which checks canonical purchase result visibility and enforces credit vs cash-desk exclusivity.
4. `WinningsCreditService` and `CashDeskService` persist fulfillment artifacts carrying canonical purchase identity, while `TicketQueryService` mirrors the outcome into the current compatibility ticket view.
5. `WalletLedgerService.creditWinnings` writes idempotent ledger credit keyed by canonical purchase identity rather than by a legacy verification-job event.

Winning fulfillment truth now lives under canonical purchase/draw state, and Phase 23 extends that truth to the current admin, receiver, and lottery-page read surfaces while leaving legacy rows only as fallback compatibility inputs.

## Documentation Anchors

- `docs/modules/system-architecture.md` - module map and expanded flow handoff.
- `docs/modules/boundary-catalog.md` - source-of-truth ownership and disallowed integrations.
- `docs/runbooks/` - module verification, regression, and operator procedures.
- `docs/runbooks/launch-readiness-checklist.md` - full launch checklist, machine install matrix, and gap handoff.

## Delivery Rule

Phases are shipped as vertical slices with runnable checks per phase. Every boundary change must update docs and verification notes in the same change set.
