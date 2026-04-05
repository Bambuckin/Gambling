# Admin Operations Console

Use this runbook when `/admin` shows queue pressure, retrying/error requests, stale terminal execution, or critical alerts.

## Current Scope

`/admin` includes:
- lottery registry controls (enable/disable/reorder);
- queue controls (reprioritize queued request, enqueue existing request as admin-priority);
- terminal status and queue pressure snapshot;
- problem request dashboard (`retrying`, `error`, `stale executing`);
- operations alerts (`terminal`, `queue`, `finance`).

`/debug/admin-ops-lab` is the read-only verification contour for queue, terminal, alert, and operations audit projections.

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
4. Inspect **Operations Alerts**:
   - severity and category;
   - title and references.
5. Inspect **Queue Snapshot**:
   - confirm active executing request is expected;
   - check admin-priority ordering against urgent requests.
6. Apply one safe action at a time:
   - `Set Admin Priority` for urgent queued request;
   - `Set Regular Priority` after urgency is resolved;
   - `Enqueue As Admin Priority` for confirmed request that must jump ahead.
7. Re-open `/admin` and verify:
   - queue order/priority changed as expected;
   - terminal status and alert list moved in expected direction.
8. Open `/debug/admin-ops-lab` and verify read-only projections:
   - queue rows match `/admin`;
   - active alerts match `/admin`;
   - recent operations audit event exists for the latest admin queue action.

## Verification Checklist (Phase 8)

1. Promote one queued request to `admin-priority` on `/admin`.
2. Confirm `/admin` shows `status=ok` and updated priority.
3. Open `/debug/admin-ops-lab` and verify:
   - request priority is `admin-priority`;
   - latest audit event action is `queue_priority_changed`.
4. Seed or reproduce one retry/error path and verify:
   - request appears in **Problem Requests**;
   - queue/terminal alert appears in `/admin` and `/debug/admin-ops-lab`.

## Verification Commands

```powershell
corepack pnpm --filter @lottery/application test -- admin-queue-service admin-operations-query-service operations-audit-service operations-alert-service
corepack pnpm --filter @lottery/web typecheck
corepack pnpm --filter @lottery/web build
```

If queue behavior remains inconsistent after priority actions, continue with `docs/runbooks/queue-incident-triage.md`.
