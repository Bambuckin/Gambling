# Phase 8: Admin Operations and Observability - Context

**Gathered:** 2026-04-05  
**Status:** Ready for execution  
**Source:** Resume state + roadmap + requirements

<domain>
## Phase Boundary

Phase 8 adds operational admin visibility and controls on top of stable purchase and verification flows:
- queue visibility with current execution and priority ordering;
- admin controls for queue priority routing without breaking single-terminal exclusivity;
- consolidated view for terminal health and problematic requests;
- structured audit and alert surface for investigation-ready operations.
</domain>

<decisions>
## Implementation Decisions

### Locked
- Admin queue controls must stay in operational admin routes, not in verification-only debug routes.
- Priority control must affect only not-started queue items; active execution must not be interrupted.
- Queue, terminal, and anomaly visibility must be read through application services, not route-owned logic.
- Audit events must carry actor, action, target reference, and timestamp fields sufficient for incident triage.
- Alerts must be deterministic projections from known failure and anomaly signals.

### the agent's Discretion
- Exact aggregation model for alerts (in-memory projector vs direct query composition).
- UI layout and grouping for admin observability widgets.
- Additional read-model fields as long as core boundaries stay unchanged.
</decisions>

<canonical_refs>
## Canonical References

**Downstream work must read these before editing.**

### Scope and requirements
- `.planning/ROADMAP.md` - Phase 8 goal, criteria, and plan sequence
- `.planning/REQUIREMENTS.md` - `ADMIN-01..ADMIN-04`, `AUDT-01..AUDT-03`
- `.planning/STATE.md` - continuity and current phase position

### Existing implementation anchors
- `packages/application/src/services/purchase-request-query-service.ts` - queue/request projections
- `packages/application/src/services/purchase-orchestration-service.ts` - queue insertion and priority input
- `packages/application/src/services/terminal-health-service.ts` - terminal state projection
- `apps/web/src/app/admin/page.tsx` - current admin operational surface
- `apps/web/src/app/debug/purchase-lab/page.tsx` - verification-only queue snapshot contour
- `apps/web/src/app/debug/terminal-lab/page.tsx` - verification-only terminal snapshot contour

### Architecture and risks
- `docs/modules/boundary-catalog.md` - route/service ownership boundaries
- `.planning/research/PITFALLS.md` - queue drift, retry, and financial traceability risks
</canonical_refs>

<specifics>
## Specific Ideas

- `08-01` builds admin queue management view and priority controls through application service boundaries.
- `08-02` adds admin-facing terminal/problem dashboards and lottery operational controls.
- `08-03` implements structured audit events and alert aggregation contracts.
- `08-04` closes phase with verification contour updates and operator runbook coverage.
</specifics>

<deferred>
## Deferred Ideas

- External notification channels remain out of scope for this phase.
- Persistent production-grade storage for alerts remains Phase 9+ hardening scope.
</deferred>

---

*Phase: 08-admin-operations-and-observability*  
*Context gathered: 2026-04-05*
