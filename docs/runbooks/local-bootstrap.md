# Local Bootstrap

Use this before resuming implementation in a fresh session.

## Prerequisites

- The repository root is `C:\Users\11\Documents\Gambling`
- Git is available on PATH
- Node.js and Corepack are available
- The active branch is the branch you intend to continue

## Step 1: Verify repository baseline

Run:

```powershell
git status --short --branch
```

Expected shape:

- branch name matches your intended context
- working tree is clean unless you intentionally continue in-progress work

## Step 2: Install dependencies (if needed)

Run:

```powershell
corepack pnpm install
```

Skip this only if dependencies are already installed and unchanged.

## Step 3: Verify planning continuity

Read in this order:

1. `README.md`
2. `.planning/STATE.md`
3. `.planning/phases/01-foundation-contracts/.continue-here.md`
4. `.planning/phases/01-foundation-contracts/01-04-PLAN.md`

Optional machine check:

```powershell
node "$HOME\.codex\get-shit-done\bin\gsd-tools.cjs" init phase-op 1
```

You should see Phase 1 metadata with plans `01-01` to `01-04`.

## Step 4: Validate scaffold health

Run:

```powershell
corepack pnpm typecheck
corepack pnpm test
corepack pnpm smoke
```

Expected baseline:

- typecheck passes across all workspaces
- domain request-state tests pass
- smoke command returns `test-kit smoke scaffold ready`

## Known environment caveat

In this Codex desktop environment, sandboxed Node child-process spawns can return `EPERM` when a GSD helper tries to launch `git`. If a `gsd-tools` git step fails for that reason, rerun that command with an unrestricted shell. Do not misdiagnose this as a missing git installation.

## Correct next move

Continue from the plan referenced in `.planning/phases/01-foundation-contracts/.continue-here.md`.
