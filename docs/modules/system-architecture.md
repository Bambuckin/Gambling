# System Architecture And Data Flow

This document maps implemented runtime components to service boundaries.
For ownership and constraints, treat `docs/modules/boundary-catalog.md` as source of truth.

## Runtime + Package Layers

| Layer | Components | Responsibility |
|---|---|---|
| UI/Entry | `apps/web`, `apps/terminal-worker` | HTTP/UI interactions and worker loops only |
| Use Cases | `packages/application` services | Request orchestration, queue lifecycle, terminal outcomes, projections |
| Domain | `packages/domain` | Contracts and lifecycle/value rules |
| Adapters | `packages/infrastructure`, `packages/lottery-handlers`, `packages/test-kit` | Storage adapters, deterministic terminal handlers, smoke fakes |

## Purchase Pipeline

1. `apps/web` receives lottery purchase input.
2. `AccessService` validates session/role boundaries.
3. `LotteryRegistryService` and `DrawRefreshService` provide lottery metadata + freshness gate.
4. `PurchaseDraftService` validates payload and computes quote.
5. `PurchaseRequestService` stores immutable request snapshot.
6. `PurchaseOrchestrationService` reserves funds and pushes queue item.
7. `apps/terminal-worker` reserves queued request through `PurchaseExecutionQueueService` with terminal lock.
8. `TerminalHandlerRuntime` resolves deterministic handler binding.
9. `TerminalExecutionAttemptService` records attempt output and normalized outcome.
10. `TerminalRetryService` decides retry vs final failure.
11. On success, `TicketPersistenceService` stores ticket record; on cancel/failure, reserve is released.
12. Web/admin projections read status via query services.

## Settlement And Winnings Pipeline

1. `DrawClosureService` closes and settles canonical draws after admin result marking.
2. Canonical purchase result visibility becomes the source of truth for user/admin ticket views.
3. `TicketQueryService` projects canonical results and fulfillment state into the current compatibility ticket surface.
4. User or admin chooses the payout path through `WinningFulfillmentService`.
5. `WinningsCreditService` writes idempotent ledger credits, or `CashDeskService` persists cash-desk payout work.

## Admin Observability Pipeline

1. `AdminQueueService` projects queue order and exposes priority mutations.
2. `AdminOperationsQueryService` aggregates problem requests, queue pressure, and terminal state.
3. `OperationsAuditService` records admin/system actions.
4. `OperationsAlertService` projects active alerts from queue, terminal, and financial anomaly signals.
5. `/admin` remains operational; `/debug/admin-ops-lab` remains verification-only.

## Deterministic Constraints

- Single active terminal execution enforced via `TerminalExecutionLock`.
- Handler code is selected from predefined registry bindings, never generated from user payload.
- Ledger events are immutable and traceable to request/ticket references.
- Any boundary change must update boundary catalog + runbook references in the same change set.
