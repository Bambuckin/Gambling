# Phase 30: End-to-End UI/Mechanics Validation and Regression Hardening - Context

**Gathered:** 2026-04-24
**Status:** Ready for execution
**Source:** Milestone v1.2 roadmap, STATE.md, Phase 29 summary, targeted service/test/UI inspection

<domain>
## Phase Boundary

Phase 30 validates the cleaned v1.2 contour from purchase execution through draw close, result visibility, and winnings fulfillment. It should harden regression coverage and remove remaining visible user-facing text defects discovered by the validation pass.

</domain>

<decisions>
## Implementation Decisions

### Locked Scope
- Do not revert prior v1.2 changes.
- Do not expose raw request/result/status strings in user purchase UI.
- Do not hide broken text or dead mechanics with CSS.
- Keep changes local to Phase 30 validation gaps.
- Treat manual browser/runtime smoke as a documented operator step unless a live runtime is already running.

### Observed Current State
- Phase 29 made `closeDraw()` the only admin publication path and removed the separate settlement action.
- Application tests cover individual draw closure, ticket read-model, wallet ledger, and winnings credit pieces.
- There is no single focused regression proving close-time result publication can feed winnings credit and return credited ticket/wallet state.
- User-facing live cabinet, notification monitor, and draw-close notification copy still contain mojibake text in touched purchase/result surfaces.
- `docs/runbooks/current-working-contour-smoke.md` is relevant to Phase 30 and currently contains mojibake, so the manual smoke checklist is not operationally readable.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/milestones/v1.2-ROADMAP.md` - Phase 30 goal and success criteria.
- `.planning/phases/29-admin-draw-control-and-one-step-closure/29-01-SUMMARY.md` - prior close/publication changes.
- `packages/application/src/services/draw-closure-service.ts` - close-time result publication and notifications.
- `packages/application/src/services/ticket-query-service.ts` - ticket/read-model result and claim projection.
- `packages/application/src/services/winnings-credit-service.ts` - winnings credit job processing.
- `packages/application/src/services/wallet-ledger-service.ts` - reserve/debit/winnings ledger truth.
- `apps/web/src/lib/purchase/lottery-live-request-presenter.ts` - user request status/result labels.
- `apps/web/src/lib/purchase/lottery-live-ticket-presenter.ts` - user ticket/result/claim labels.
- `apps/web/src/lib/purchase/lottery-live-cabinet.tsx` - live wallet/draw purchase facts.
- `apps/web/src/lib/purchase/lottery-notification-monitor.tsx` - client-visible notification feed.
- `docs/runbooks/current-working-contour-smoke.md` - manual full-contour smoke procedure.

</canonical_refs>

<specifics>
## Specific Ideas

- Replace mojibake in user purchase/cabinet labels with actual Russian strings.
- Replace draw-close notification titles/bodies with actual Russian strings.
- Add a regression that starts with a purchased canonical ticket, marks win, closes the draw, enqueues/processes winnings credit, and verifies wallet plus ticket claim projection.
- Update the smoke runbook so Phase 30 leaves an honest manual validation path.

</specifics>

<deferred>
## Deferred Ideas

- Live LAN/real-terminal smoke remains dependent on the target terminal environment.
- Physical compatibility table removal remains outside v1.2 Phase 30.

</deferred>

---

*Phase: 30-end-to-end-ui-mechanics-validation-and-regression-hardening*
*Context gathered: 2026-04-24*
