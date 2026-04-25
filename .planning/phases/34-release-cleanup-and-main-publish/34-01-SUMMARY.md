---
phase: 34
plan: 34-01
title: Release cleanup and main publish
status: completed
completed_at: "2026-04-25T11:06:00+05:00"
---

# Phase 34 Summary

## What Changed

- Removed local generated artifacts from the workspace: `body`, `.codex`, `.tmp`, `dist`, `apps/web/.next`, `apps/web/tsconfig.tsbuildinfo`, and all `.main-browser-profile-*` directories.
- Preserved source, tests, docs, planning artifacts, real `.env` files, and node_modules.
- Updated `.gitignore` so real `.env` files stay ignored while `ops/runtime/.env.web.template` and `ops/runtime/.env.worker.template` can be committed.
- Validated the cleaned tree with workspace typechecks, workspace tests, web production build, and diff whitespace checks.

## Files Changed

- `.gitignore`
- `.planning/STATE.md`
- `.planning/milestones/v1.2-ROADMAP.md`
- `.planning/phases/34-release-cleanup-and-main-publish/34-CONTEXT.md`
- `.planning/phases/34-release-cleanup-and-main-publish/34-01-PLAN.md`
- `.planning/phases/34-release-cleanup-and-main-publish/34-01-SUMMARY.md`
- `ops/runtime/.env.web.template`
- `ops/runtime/.env.worker.template`

## Validation

- `corepack pnpm -r --if-present typecheck` - passed.
- `corepack pnpm -r --if-present test` - passed.
- `corepack pnpm --filter @lottery/web build` - passed.
- `git diff --check` - passed with existing CRLF/LF warnings only.

## Remaining Gaps

- `.env`, `.env.web`, `.env.worker`, and node_modules remain local ignored files by design.
- Publishing still requires committing the cleaned branch and updating `main`.
