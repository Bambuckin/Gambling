# Local Bootstrap

Use this before resuming implementation in a fresh session.

## What must already be true

- The repository root is `C:\Users\11\Documents\Gambling`
- Git is available on PATH
- The active branch is `main`
- Phase 1 is planned but not executed yet

## Verify the repository baseline

Run:

```powershell
git status --short --branch
```

Expected shape:

- branch is `main`
- working tree is clean unless you intentionally started new work

## Verify planning continuity

Read in this order:

1. `README.md`
2. `.planning/STATE.md`
3. `.planning/phases/01-foundation-contracts/.continue-here.md`
4. `.planning/phases/01-foundation-contracts/01-01-PLAN.md`

Optional machine check:

```powershell
node "$HOME\.codex\get-shit-done\bin\gsd-tools.cjs" init phase-op 1
```

You should see Phase 1 metadata with the phase directory and plans present.

## Known environment caveat

In this Codex desktop environment, sandboxed Node child-process spawns can return `EPERM` when a GSD helper tries to launch `git`. If a `gsd-tools` git step fails for that reason, rerun that command with an unrestricted shell. Do not misdiagnose this as a missing git installation.

## Correct next move

Start execution with:

- `.planning/phases/01-foundation-contracts/01-01-PLAN.md`

Do not skip straight to broad app scaffolding before ADR-001 locks the stack and repository shape.
