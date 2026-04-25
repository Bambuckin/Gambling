# Phase 29: Admin Draw Control and One-Step Closure - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning
**Source:** Milestone v1.2 roadmap, STATE.md, Phase 28 summary, targeted code inspection

<domain>
## Phase Boundary

Phase 29 makes admin draw operation honest and one-step. The admin should mark ticket outcomes while the draw is active, then press one close action that closes the draw, publishes client-visible result state, resolves compatibility tickets, and emits notifications. There must be no second operator publication button.

</domain>

<decisions>
## Implementation Decisions

### Locked Scope
- Do not revert prior v1.2 changes.
- Do not bring raw backend states back into user/purchase UI.
- Do not hide layout or text problems with CSS-only masking; remove dead UI actions and stale backing mechanics.
- Keep Phase 29 focused on admin draw control and one-step closure.

### Observed Current State
- `DrawClosureService.closeDraw()` already performs canonical close, canonical settle, result visibility publication, compatibility ticket resolution, and notification creation for the normal open-draw path.
- Admin UI still exposes a separate `onSettleDraw` / `adminSettleDrawAction` / "publish result" path.
- `DrawClosureService.settleDraw()` remains as an unused operator-style path after UI removal.
- Manual draw creation currently uses a wrapping flex row; Phase 29 needs a stable layout that prevents date/time input and submit button overlap.
- TicketQueryService already projects canonical purchased tickets as pending ticket rows before result publication, and the Phase 28 admin presenter labels pending admin draw tickets as purchased / waiting for publication.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/milestones/v1.2-ROADMAP.md` - Phase 29 goal and success criteria.
- `.planning/phases/28-admin-encoding-and-readability-cleanup/28-01-SUMMARY.md` - presenter boundary and remaining Phase 29 work.
- `apps/web/src/app/admin/page.tsx` - admin server actions and AdminDrawMonitor wiring.
- `apps/web/src/lib/purchase/admin-draw-monitor.tsx` - admin draw form and close action UI.
- `packages/application/src/services/draw-closure-service.ts` - close/publish/result propagation behavior.
- `packages/application/src/services/purchase-request-query-service.ts` - live user request read model.
- `packages/application/src/services/notification-service.ts` - client notification read model.
- `packages/application/src/services/ticket-query-service.ts` - admin/client ticket read model.
- `apps/web/src/app/api/lottery/[lotteryCode]/requests/route.ts` - live client polling endpoint.

</canonical_refs>

<specifics>
## Specific Ideas

- Remove `onSettleDraw` from `AdminDrawMonitorProps`, admin page props, and server action.
- Replace separate open/closed draw groups with one unfinished-draw group plus a settled group.
- Use the same close action for `open` and any legacy `closed` draw rows; the service should settle/publish closed legacy rows through `closeDraw`.
- Remove `SettleDrawInput`, `SettleDrawResult`, and `settleDraw()` from the application service if no callers remain.
- Add or update tests around `closeDraw()` proving immediate publication and legacy closed-row completion.

</specifics>

<deferred>
## Deferred Ideas

- Full browser smoke and end-to-end purchase-to-winnings validation belongs to Phase 30.
- Compatibility table removal is still deferred to a deliberate migration window.

</deferred>

---

*Phase: 29-admin-draw-control-and-one-step-closure*
*Context gathered: 2026-04-24*
