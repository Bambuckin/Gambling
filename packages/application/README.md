# @lottery/application

Use-case orchestration layer and typed port definitions.

## What This Package Owns

- service boundaries for access, registry, draws, ledger, purchase flow, queue flow, terminal flow, ticket verification, admin operations, and observability;
- ports that runtime apps and infrastructure adapters implement;
- time source abstraction used across services.

It does not own JSX/UI, database schema, browser automation selectors, or raw HTTP handling.

## Ports

Core port families:

- access/session:
  - `identity-store.ts`
  - `session-store.ts`
  - `password-verifier.ts`
  - `access-audit-log.ts`
- registry/draw:
  - `lottery-registry-store.ts`
  - `draw-store.ts`
- ledger:
  - `ledger-store.ts`
- purchase/queue/tickets:
  - `purchase-request-store.ts`
  - `purchase-queue-store.ts`
  - `ticket-store.ts`
  - `ticket-verification-job-store.ts`
  - `terminal-execution-lock.ts`
- terminal integration:
  - `terminal-executor.ts`
  - `terminal-handler-registry.ts`
- observability and utilities:
  - `operations-audit-log.ts`
  - `queue.ts`
  - `time-source.ts`

## Service Groups

### Access

- `AccessService`

### Registry and draws

- `LotteryRegistryService`
- `DrawRefreshService`

### Financial flow

- `WalletLedgerService`

### Purchase lifecycle

- `PurchaseDraftService`
- `PurchaseRequestService`
- `PurchaseOrchestrationService`
- `PurchaseRequestQueryService`
- `PurchaseExecutionQueueService`

### Terminal and retry

- `TerminalHandlerResolverService`
- `TerminalExecutionAttemptService`
- `TerminalRetryService`
- `TerminalHealthService`

### Tickets and verification

- `TicketPersistenceService`
- `TicketQueryService`
- `TicketVerificationQueueService`
- `TicketVerificationResultService`

### Admin and observability

- `AdminQueueService`
- `AdminOperationsQueryService`
- `OperationsAuditService`
- `OperationsAlertService`

## Typical Change Rule

If a route, page, or worker loop needs new behavior, it should usually be added here first and then composed by the runtime app.

## Validation

Run from repo root:

```powershell
corepack pnpm --filter @lottery/application test
corepack pnpm --filter @lottery/application typecheck
```

Use targeted service filters when changing a narrow slice.
See `docs/TESTING.md` and `docs/runbooks/module-verification-matrix.md`.

## Related Docs

- `packages/domain/README.md`
- `packages/infrastructure/README.md`
- `docs/DEVELOPMENT.md`
