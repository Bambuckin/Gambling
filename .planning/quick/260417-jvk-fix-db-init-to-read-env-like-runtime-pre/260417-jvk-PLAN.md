# Quick Task 260417-jvk: Fix `db:init` to read `.env` like runtime preflight

**Status:** Completed
**Date:** 2026-04-17

## Goal

Make the Postgres bootstrap command work in the same local setup as the rest of the runtime by loading connection settings from the repository `.env` file when the shell environment does not already provide them.

## Acceptance Criteria

- `corepack pnpm db:init` no longer fails immediately with `Missing LOTTERY_POSTGRES_URL (or DATABASE_URL)` when `.env` already contains the connection string.
- Existing process-level environment variables still take precedence over values from `.env`.
- The change stays local to the bootstrap path and does not alter unrelated runtime behavior.

## Files Most Likely Involved

- `scripts/postgres-init-and-seed.ts`
- `.planning/STATE.md`
- `.planning/quick/260417-jvk-fix-db-init-to-read-env-like-runtime-pre/260417-jvk-SUMMARY.md`

## Steps

1. Load `.env` into `process.env` inside the bootstrap script only when runtime variables are not already set.
2. Re-run `db:init` and confirm it moves past the missing-connection failure.
3. Record the verified root cause and outcome in quick-task artifacts.
