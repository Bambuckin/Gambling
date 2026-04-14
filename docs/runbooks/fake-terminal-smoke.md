# Fake Terminal Smoke Runbook

Use this runbook to verify the local fake-adapter path works without a production terminal.

## Scope

This checks the current local baseline:

- fake terminal adapter contract compatibility
- request-state transition checks
- smoke command availability for local workflows
- access lifecycle audit event coverage (`login_success`, `login_denied`, `logout`)
- Access Lab UI harness for post-implementation auth flow checks

## Preconditions

- Repository root is `C:\Users\11\Documents\Gambling`
- Dependencies are installed (`corepack pnpm install`)
- No unrelated local changes that would hide failures

## Step 1: Compile fake adapter path

```powershell
corepack pnpm --filter @lottery/test-kit typecheck
```

Expected result: TypeScript compile passes.

## Step 2: Verify request-state baseline

```powershell
corepack pnpm --filter @lottery/domain test
```

Expected result: `request-state.test.ts` passes (currently 3 tests).

## Step 3: Run smoke command entrypoint

```powershell
corepack pnpm smoke
```

Expected result:

- command exits with code `0`
- output contains `test-kit smoke scaffold ready`

## Step 4: Verify access audit lifecycle checks

```powershell
corepack pnpm --filter @lottery/application test
```

Expected result:

- command exits with code `0`
- `access-service.test.ts` confirms login/logout/denied flows append audit events with actor + timestamp

## Step 5: Walk through Access Lab UI scenarios

1. Start web app:

```powershell
corepack pnpm dev:web
```

2. Open `http://localhost:3000/debug/access-lab`.
3. Run scenarios in order:
   - `User Login With Return`
   - `User To Admin Denied`
   - `Logout Flow`
4. Open each probe link shown after running the scenario.

Expected result:

- User scenario opens `/lottery/mechtallion` after session creation
- Admin-denied scenario redirects `/admin` to `/denied?...required=admin`
- Logout scenario clears session and protected routes redirect to `/login`

## If a step fails

1. Run `corepack pnpm typecheck` at repo root to surface cross-package drift.
2. Inspect:
   - `packages/test-kit/src/fake-terminal.ts`
   - `packages/test-kit/src/fake-lottery-handler.ts`
   - `packages/application/src/ports/terminal-executor.ts`
   - `packages/application/src/ports/access-audit-log.ts`
   - `packages/application/src/services/access-service.ts`
   - `apps/web/src/app/debug/access-lab/page.tsx`
   - `apps/web/src/app/debug/access-lab/actions.ts`
   - `apps/web/src/lib/access/lab-scenarios.ts`
3. Confirm `nextState` values from fake terminal remain within `"success" | "retrying" | "error"`.
4. Re-run this runbook after fixes.

## Evidence to record in summary

- Commands executed
- Pass/fail per step
- Any adapter contract mismatch and exact file path fixed
- Access audit event assertions covered in the run
- Access Lab scenarios executed and observed redirect outcomes
