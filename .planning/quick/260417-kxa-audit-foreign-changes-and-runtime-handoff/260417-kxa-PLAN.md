# Quick Plan 260417-kxa

## Goal

Separate generated local noise from real source changes, bring the handoff docs back in sync with the actual runtime, and cut obvious dead or overloaded UI leftovers without changing the working purchase contour.

## Acceptance Criteria

- generated browser-profile folders and declaration artifacts are treated as local noise instead of repository changes
- docs describe the real current contour: queue, terminal visibility, manual draw handling, simplified lottery page
- dead hidden payout controls and unused UI components are removed
- relevant validation for the touched surface passes

## Scope

- `.gitignore`
- `apps/web/src/app/lottery/[lotteryCode]/page.tsx`
- `apps/web/src/lib/purchase/admin-live-monitor.tsx`
- `apps/web/src/lib/purchase/lottery-notification-monitor.tsx`
- `docs/handoff-runtime.md`
- `docs/runbooks/deployment-bootstrap.md`
- `docs/handoff/big8-current-wave/README.md`
- `.planning/STATE.md`

## Stop Conditions

- no new feature work beyond cleanup/reconciliation
- no repo-wide refactor
- no destructive cleanup outside explicit generated artifacts
