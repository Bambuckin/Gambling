# Runbooks

Operator and verification procedures live here.

Current runbooks:

- `current-working-contour-smoke.md` - shortest real smoke from login to visible result in the current Big 8 slice
- `local-bootstrap.md` - verify git/planning baseline before implementation resumes
- `fake-terminal-smoke.md` - smoke checks without production terminal access
- `module-verification-matrix.md` - per-module local verification commands and triage map
- `regression-recipes.md` - critical cross-module regression recipes before release
- `registry-and-draw-verification.md` - registry controls and draw freshness checks
- `wallet-verification.md` - balance snapshot/history verification
- `purchase-request-verification.md` - Phase 5 purchase request lifecycle checks
- `queue-incident-triage.md` - queue/terminal incident investigation flow
- `ticket-persistence-verification.md` - Phase 7 ticket persistence, verification outcomes, and winnings visibility checks
- `admin-operations-console.md` - admin console triage for queue pressure, terminal state, and problematic requests
- `lottery-handler-change.md` - operator rollout/rollback checklist for lottery handler binding changes
- `release-readiness.md` - final release gate and go/no-go checklist (`corepack pnpm release:check`)
- `deployment-bootstrap.md` - LAN deployment preparation with Postgres runtime, machine roles, and handoff files
- `launch-readiness-checklist.md` - exhaustive launch checklist: missing gaps, machine installs, status/data flow, and handoff scope

When a phase introduces new operational or verification behavior, update runbooks in the same step.
