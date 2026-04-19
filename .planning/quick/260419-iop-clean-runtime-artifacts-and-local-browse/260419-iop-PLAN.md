# Quick Task 260419-iop: Clean runtime artifacts and local browser profiles before canonical migration

**Status:** In progress
**Date:** 2026-04-19

## Goal

Clean repository-local generated runtime artifacts so the canonical architecture work starts from a quieter local state without deleting files needed for ongoing development.

## Acceptance Criteria

- Generated browser profile directories `.main-browser-profile-*` are removed.
- Build/runtime artifact directories `dist/`, `scripts/dist/`, and `apps/web/.next/` are removed.
- TypeScript incremental artifact `apps/web/tsconfig.tsbuildinfo` is removed.
- Dependency installs and working runtime configuration remain intact: do not remove `node_modules`, `.env`, `.env.web`, `.env.worker`, or runtime templates.

## Files Most Likely Involved

- `.planning/quick/260419-iop-clean-runtime-artifacts-and-local-browse/260419-iop-SUMMARY.md`
- `.gitignore`
- repository-local generated directories listed above

## Steps

1. Identify generated runtime artifacts that are safe to delete without harming the next implementation step.
2. Remove only build output, browser-profile state, and incremental compiler artifacts.
3. Re-run minimal validation and record the outcome in the quick-task summary.
