# Phase 28: Admin Encoding and Readability Cleanup - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning
**Source:** Milestone v1.2 roadmap and Phase 27 handoff

<domain>
## Phase Boundary

Phase 28 cleans the admin-visible status/readability contour after Phase 27 finished the user cabinet localization pass. The scope is deliberately narrow: admin overview, terminal/latest request status labels, draw monitor status/result text, and audit-style reference blocks.

</domain>

<decisions>
## Implementation Decisions

### Locked Scope
- Do not revert or rewrite previous milestone v1.2 changes.
- Treat broken encoding as incorrect text output, not a styling issue.
- Remove real corrupted text tails such as `????`; do not hide them with CSS.
- Keep application services returning machine-readable states; map admin-visible labels at the web presenter boundary.
- Do not return raw request/result/status strings in user or purchase UI.

### Admin Labels
- Admin status labels must render as normal Russian text.
- Unknown admin-visible states must use safe Russian fallback labels, not raw backend status strings.
- Audit/reference blocks must use coherent Russian labels instead of mixed `request=`, `user=`, `audit-`, `legacy`, or `settlement` text where the touched UI displays operator copy.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/milestones/v1.2-ROADMAP.md` - Phase 28 goal and success criteria.
- `.planning/phases/27-user-cabinet-status-localization-and-result-surface/27-01-SUMMARY.md` - prior phase completion and no-raw-user-UI boundary.
- `apps/web/src/app/admin/page.tsx` - admin overview, queue, receiver, alerts, audit blocks.
- `apps/web/src/lib/purchase/admin-draw-monitor.tsx` - admin draw status/result surface.
- `packages/application/src/services/admin-operations-query-service.ts` - admin operations state source.
- `packages/application/src/services/terminal-receiver-query-service.ts` - terminal receiver state source.

</canonical_refs>

<specifics>
## Specific Ideas

- Add a small admin presenter/mapping module under `apps/web/src/lib/purchase/`.
- Move status, severity, reference, draw, verification, and ticket outcome label decisions out of JSX-local fallbacks.
- Add focused tests for the admin presenter to prove raw unknown state strings are not exposed.

</specifics>

<deferred>
## Deferred Ideas

- Phase 29 owns draw creation layout and one-step close/publish mechanics.
- This phase should not collapse settlement actions yet unless required to remove corrupted text.

</deferred>

---

*Phase: 28-admin-encoding-and-readability-cleanup*
*Context gathered: 2026-04-24*
