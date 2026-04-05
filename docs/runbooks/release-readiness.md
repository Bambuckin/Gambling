# Release Readiness Checklist

Use this checklist before tagging or handing off a release candidate.

## One-Command Gate

```powershell
corepack pnpm release:check
```

The command runs, in order:

1. domain lifecycle tests (`request-state`, `ledger`)
2. critical application service tests (purchase, retry, verification, admin alerts, handler resolver, attempt journaling)
3. handler package typecheck
4. terminal-worker typecheck
5. web production build
6. smoke test-kit path

The gate is fail-fast: first failing command aborts the sequence.

## Manual Review Checklist

1. Review recent summaries in `.planning/phases/09-hardening-extension-docs-and-release-readiness/`.
2. Confirm no unresolved blockers in `.planning/STATE.md`.
3. Confirm runbook set is current:
   - `module-verification-matrix.md`
   - `regression-recipes.md`
   - `lottery-handler-change.md`
4. Confirm `/admin` and `/debug/admin-ops-lab` separation remains intact (operational vs verification-only).

## Go / No-Go Rule

- **Go:** `corepack pnpm release:check` exits `0` and manual checklist has no open item.
- **No-Go:** any command failure, stale planning state, or unresolved operational ambiguity.

## Failure Handling

1. Stop release motion.
2. Use `docs/runbooks/regression-recipes.md` to localize failing flow.
3. Apply fix in module ownership boundaries from `docs/modules/boundary-catalog.md`.
4. Re-run `corepack pnpm release:check` from scratch.
