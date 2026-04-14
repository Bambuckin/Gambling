# @lottery/test-kit

Fake helpers for deterministic local verification.

## What This Package Owns

- fake terminal executor;
- fake purchase/result handlers for lottery flow tests or scaffolds.

## Files

- `src/fake-terminal.ts` - `FakeTerminalExecutor` with `success | retry | error` modes
- `src/fake-lottery-handler.ts` - fake purchase and result handler contracts
- `src/index.ts` - public exports

## Current Limitation

The package is useful as a helper library, but the root `corepack pnpm smoke` command is still only a scaffold.
Today it prints `test-kit smoke scaffold ready` and does not run a true end-to-end scenario.

If you need actual smoke coverage, use the manual runbooks and extend this package with a real smoke entrypoint.

## Validation

Run from repo root:

```powershell
corepack pnpm --filter @lottery/test-kit typecheck
corepack pnpm smoke
```

Interpret `pnpm smoke` correctly: it confirms the scaffold command path exists, nothing more.

## Related Docs

- `docs/TESTING.md`
- `docs/runbooks/fake-terminal-smoke.md`
