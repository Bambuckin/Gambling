# Phase 3: Lottery Registry and Draw Pipeline - Context

**Gathered:** 2026-04-05  
**Status:** Ready for execution  
**Source:** Resume state + roadmap + requirements

<domain>
## Phase Boundary

Phase 3 establishes lottery registry and draw data foundations:
- Registry is the source of truth for lottery visibility and ordering.
- Lottery shell must consume registry data instead of ad-hoc env-only catalog wiring.
- Draw freshness and stale/missing behavior are built in later plans (03-03 and 03-04).
</domain>

<decisions>
## Implementation Decisions

### Locked
- Keep registry logic outside `apps/web` route files. Route files only consume application-level outputs.
- Store lottery code, title, visibility, display order, form schema version, pricing rule, and handler binding references in registry entries.
- Handler bindings are stable string references only (no runtime-generated executable logic).
- Plan `03-01` delivers core registry storage/order/visibility + shell consumption, then a separate debug UI verification contour.
- Keep admin mutation UI for later steps; `03-01` provides the core APIs and data flow needed by those screens.

### the agent's Discretion
- Exact shape of in-memory storage internals and normalization helpers.
- Concrete naming for debug verification route and runtime factory modules.
- Test case granularity for service and integration checks.
</decisions>

<canonical_refs>
## Canonical References

**Downstream work must read these before editing.**

### Scope and requirements
- `.planning/ROADMAP.md` - Phase 3 goals, plan order, success criteria
- `.planning/REQUIREMENTS.md` - `LOTR-*` and `DRAW-*` requirement contracts
- `.planning/STATE.md` - Current phase position and continuity

### Architecture and boundary rules
- `docs/modules/boundary-catalog.md` - ownership and forbidden crossings
- `.planning/codebase/STRUCTURE.md` - file and module map
- `.planning/research/ARCHITECTURE.md` - cross-module data flow
- `.planning/research/PITFALLS.md` - registry entropy and stale draw risks

### Existing implementation anchors
- `packages/domain/src/lottery-registry.ts`
- `apps/web/src/lib/access/lottery-catalog.ts`
- `apps/web/src/lib/access/entry-flow.ts`
</canonical_refs>

<specifics>
## Specific Ideas

- Reuse runtime-composition pattern from access runtime for registry runtime wiring.
- Add deterministic defaults for local smoke (`demo-lottery`, `gosloto-6x45`) but route all reads through registry service.
- Add a dedicated debug page for registry visibility/order verification, separate from primary shell route.
</specifics>

<deferred>
## Deferred Ideas

- Draw ingestion scheduling and freshness gating (03-03).
- Dynamic lottery form rendering from schema metadata (03-02).
- Admin mutation controls for enable/disable/reorder (03-04).
</deferred>

---

*Phase: 03-lottery-registry-and-draw-pipeline*  
*Context gathered: 2026-04-05*
