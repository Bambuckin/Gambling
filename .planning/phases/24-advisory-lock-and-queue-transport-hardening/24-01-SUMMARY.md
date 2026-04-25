# Phase 24 Summary: Advisory Lock and Queue Transport Hardening

## Outcome

Phase 24 is complete.

Terminal exclusivity and queue transport are now hardened without breaking the current manual contour:

- Postgres terminal execution no longer depends on TTL lock-table takeover semantics;
- worker exclusivity is held by a database advisory lock on a live session and is no longer time-limited by `LOTTERY_TERMINAL_LOCK_TTL_SECONDS`;
- submit, reserve, retry requeue, and dequeue flow now run through an explicit `PurchaseQueueTransport` boundary;
- the current storage-backed queue stays in place as the active backend, so current web routes, worker flow, and manual smoke contour remain stable.

Legacy lock-table storage and the current queue backend still exist, but they are no longer the semantic boundary for exclusivity or queue transport. Full legacy removal remains Phase 25 work.

## Delivered Changes

### Advisory-lock execution ownership

- Reworked `PostgresTerminalExecutionLock` to use `pg_try_advisory_lock` / `pg_advisory_unlock` on a dedicated held session instead of refreshing `lottery_terminal_execution_locks.expires_at`.
- Added deterministic advisory-lock key generation so diagnostics and reset flows target the same execution lock identity.
- Kept `clearAll()` truthful for local reset/admin flows by releasing the local holder and terminating any other session that still owns the advisory lock.
- Preserved current runtime wiring and env compatibility by keeping the TTL option accepted even though it no longer controls exclusivity.

### Replaceable queue transport seam

- Added a new `PurchaseQueueTransport` port that owns enqueue, reserve, requeue, reprioritize, completion, and lookup semantics.
- Rewired `PurchaseOrchestrationService`, `PurchaseExecutionQueueService`, and `TerminalExecutionAttemptService` to depend on the transport seam instead of on raw queue-store mutation semantics.
- Updated in-memory and Postgres queue implementations so the current storage-backed backend satisfies both the existing read/query needs and the new transport boundary.
- Preserved current queue behavior: admin-priority ordering still wins first, then `enqueuedAt`, then `requestId`.

### Runtime and diagnostics sync

- Updated web and worker composition roots to wire the current queue backend through the new transport seam without changing existing routes or manual smoke expectations.
- Reworked `scripts/runtime-queue-doctor.ts` so lock inspection now reads advisory-lock ownership from `pg_locks` instead of assuming TTL rows.
- Updated architecture and handoff/runbook text so Phase 24 truth matches the implemented runtime rather than the deferred Phase 23 notes.

## Files of Record

- `packages/application/src/ports/purchase-queue-transport.ts`
- `packages/application/src/services/purchase-execution-queue-service.ts`
- `packages/application/src/services/purchase-orchestration-service.ts`
- `packages/application/src/services/terminal-execution-attempt-service.ts`
- `packages/infrastructure/src/postgres/postgres-purchase-store.ts`
- `packages/infrastructure/src/purchase/in-memory-purchase-queue-store.ts`
- `apps/terminal-worker/src/main.ts`
- `apps/web/src/lib/purchase/purchase-runtime.ts`
- `scripts/runtime-queue-doctor.ts`
- `ARCHITECTURE.md`
- `docs/handoff-runtime.md`
- `docs/runbooks/canonical-storage-migration.md`
- `docs/runbooks/launch-readiness-checklist.md`

## Validation

Executed during the phase:

```powershell
corepack pnpm --filter @lottery/application test -- --runInBand packages/application/src/__tests__/purchase-execution-queue-service.test.ts packages/application/src/__tests__/purchase-orchestration-service.test.ts packages/application/src/__tests__/terminal-execution-attempt-service.test.ts packages/application/src/__tests__/admin-test-reset-service.test.ts packages/application/src/__tests__/admin-queue-service.test.ts
corepack pnpm --filter @lottery/application typecheck
corepack pnpm --filter @lottery/infrastructure typecheck
corepack pnpm --filter @lottery/terminal-worker typecheck
corepack pnpm --filter @lottery/web typecheck
corepack pnpm --filter @lottery/web build
```

Observed result:

- the Vitest invocation still resolved to the current full `@lottery/application` suite in this repo, and all 31 files / 156 tests passed;
- application typecheck passed;
- infrastructure typecheck passed;
- terminal-worker typecheck passed;
- web typecheck passed;
- web build passed.

## Remaining Gaps

1. The legacy `lottery_terminal_execution_locks` table still exists as leftover storage; this phase removed the runtime dependency on its TTL semantics but did not start deletion work.
2. The queue transport seam is explicit now, but the active backend is still the current storage-backed queue. Swapping to outbox or `pg-boss` remains a later implementation choice.
3. Real checkout/payment automation after cart stage is still not production-complete, so the system remains manual-smoke ready rather than production-ready.
