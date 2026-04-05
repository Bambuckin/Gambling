# Lottery Handler Change Runbook

Operator procedure for rolling out new or changed lottery handler bindings.

## Scope

Use this runbook when:

- adding a new lottery code;
- changing purchase/result handler binding keys;
- switching an existing lottery to updated handler implementation.

Developer implementation details are in `docs/modules/lottery-handler-extension.md`.

## Preconditions

1. Working tree is clean.
2. Target commit with handler changes is known.
3. Developer-side checks already passed:
   - `corepack pnpm --filter @lottery/lottery-handlers typecheck`
   - `corepack pnpm --filter @lottery/application test -- terminal-handler-resolver-service terminal-execution-attempt-service`
   - `corepack pnpm smoke`
4. Rollback binding keys are documented before rollout.

## Preflight

1. Open `/admin`.
2. Confirm terminal state is not `offline`.
3. Confirm queue pressure is manageable (no unresolved critical backlog).
4. Record baseline:
   - active executing request,
   - alert list count and categories,
   - current lottery enable/order state.

## Rollout Steps

1. Deploy handler change commit to target environment.
2. Restart worker/runtime processes if required by deployment model.
3. Open `/admin` and confirm:
   - terminal state returns to `idle|busy` (not degraded/offline spike);
   - no immediate critical alerts tied to handler resolution.
4. Execute one controlled purchase for affected lottery (test user or staging equivalent).
5. Confirm request transitions normally (`queued -> executing -> completed|retrying`).

## Post-Rollout Verification

1. Open `/debug/admin-ops-lab` and validate:
   - queue and alert projections align with `/admin`;
   - latest operations entries include expected queue/terminal actions.
2. Open `/debug/ticket-lab` and verify:
   - ticket persistence for successful purchase,
   - verification output trace includes raw terminal text.
3. Run fast regression command:

```powershell
corepack pnpm --filter @lottery/application test -- terminal-handler-resolver-service terminal-execution-attempt-service ticket-persistence-service
```

## Rollback Triggers

Rollback immediately if any condition is true:

- repeated terminal handler resolution failures for affected lottery;
- sustained `offline|degraded` terminal state after rollout;
- execution attempts produce malformed/empty raw terminal output;
- unexpected queue growth tied to affected lottery requests.

## Rollback Steps

1. Revert to previous known-good binding keys/commit.
2. Restart worker/runtime processes.
3. Re-open `/admin` and confirm:
   - terminal state stabilizes,
   - alerts trend down,
   - queue begins draining normally.
4. Document rollback cause in incident notes and attach request IDs impacted.

## Evidence To Capture

- rollout timestamp and commit hash,
- request IDs used for validation,
- before/after terminal state and alert snapshots,
- rollback reason (if triggered) and recovery confirmation.
