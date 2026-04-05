# Admin Operations Console

Use this runbook when `/admin` shows queue pressure, retrying/error requests, or stale terminal execution.

## Current Scope

`/admin` now includes:
- lottery registry controls (enable/disable/reorder);
- queue controls (reprioritize queued request, enqueue existing request as admin-priority);
- terminal status and queue pressure snapshot;
- problem request dashboard (`retrying`, `error`, `stale executing`).

## Triage Flow

1. Open `/admin` and inspect **Terminal Status**.
2. If terminal state is `offline` or `degraded`, capture:
   - `active request`;
   - `consecutive failures`;
   - `last error at`.
3. Inspect **Problem Requests** and copy:
   - `request id`, `anomaly`, `attempts`;
   - `user`, `lottery`, `draw`;
   - `last error`.
4. Inspect **Queue Snapshot**:
   - confirm active executing request is expected;
   - check whether admin-priority items are taking precedence in queued rows.
5. Apply one safe action at a time:
   - `Set Admin Priority` for an urgent queued request;
   - `Set Regular Priority` to release emergency priority after incident;
   - `Enqueue As Admin Priority` for a confirmed request that must jump ahead.
6. Re-open `/admin` and verify:
   - queue order and priority are updated;
   - terminal state and failure counters move in expected direction.

## Verification Commands

```powershell
corepack pnpm --filter @lottery/application test -- admin-operations-query-service
corepack pnpm --filter @lottery/web typecheck
corepack pnpm --filter @lottery/web build
```

If queue behavior remains inconsistent after priority actions, continue with `docs/runbooks/queue-incident-triage.md`.
