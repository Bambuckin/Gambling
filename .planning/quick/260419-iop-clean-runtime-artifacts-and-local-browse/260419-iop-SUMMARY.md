# Quick Task 260419-iop Summary

**Date:** 2026-04-19
**Status:** Completed

## What Changed

- Removed repository-local browser profile directories `.main-browser-profile-*`.
- Removed generated build artifacts `dist/`, `scripts/dist/`, and `apps/web/.next/`.
- Removed incremental compiler artifact `apps/web/tsconfig.tsbuildinfo`.
- Intentionally kept `node_modules`, `.env`, `.env.web`, `.env.worker`, and runtime templates because they are part of the live development baseline for the next architecture phase, not disposable cache for this handoff.

## Validation

- `corepack pnpm runtime:preflight`
- `node C:\Users\11\.codex\get-shit-done\bin\gsd-tools.cjs validate health`
- `git clean -ndX` preview after cleanup confirms that only env files, dependency installs, and ignored runtime templates remain as local ignored state

## Notes

- I did not delete committed source files, current working-contour docs, or compatibility-layer code. That would be premature before the additive canonical migration starts.
- The actual source-level pruning belongs later, when canonical purchase/draw cutover is complete and legacy models can be removed safely in the planned decommission phase.
