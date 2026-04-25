# Phase 25: Legacy Model Removal and Regression Hardening - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning
**Source:** inline execution context from the current session

<domain>
## Phase Boundary

- Finish the user-visible runtime contour so a confirmed Big 8 purchase reaches a truthful terminal-backed purchased state instead of stopping at cart stage plus runtime emulation.
- Keep manual draw close/settlement and user notifications working through the canonical path.
- Remove or demote only the compatibility pieces that become unnecessary or misleading after direct terminal purchase is restored.
- Keep the current routes and operator contour stable; do not start a broad rewrite.

</domain>

<decisions>
## Implementation Decisions

### Locked decisions

- The current visible blocker for “project done” is that `bolshaya-8` still runs through `purchaseCompletionMode = emulate_after_cart`.
- Draw close / settlement and user notification flow already exist on the canonical path and must stay intact.
- `mock` mode must remain usable for local/manual smoke without a live NLoto checkout.
- Current UI routes (`/lottery/bolshaya-8`, `/admin`, `/terminal/receiver`) must stay stable unless a narrow wording/status update is required.

### The agent's discretion

- Whether the real Big 8 handler is updated in place or split into a clearer direct-purchase handler, as long as the runtime result becomes truthful.
- Whether `added_to_cart` support remains in the domain as a compatibility state, as long as the active Big 8 path no longer depends on post-cart emulation.
- How much legacy cleanup is safe to include in this pass after the direct terminal purchase path is restored and regression coverage exists.

</decisions>

<canonical_refs>
## Canonical References

**Downstream work must read these before implementation.**

### Phase and migration state
- `AGENTS.md` - repo operating rules, Sofia persona, and GSD workflow requirement
- `.planning/STATE.md` - current milestone/phase state
- `.planning/ROADMAP.md` - Phase 25 goal and success criteria
- `.planning/phases/24-advisory-lock-and-queue-transport-hardening/24-01-SUMMARY.md` - exact Phase 24 handoff boundary
- `.planning/REQUIREMENTS.md` - `CONS-10`
- `ARCHITECTURE.md` - current runtime/data-flow contract

### Runtime and operator contour
- `apps/terminal-worker/src/lib/big8-terminal-cart-handler.ts` - current real Big 8 automation stops at add-to-cart
- `apps/terminal-worker/src/lib/big8-mock-terminal-handler.ts` - current mock path already returns truthful `ticket_purchased`
- `apps/terminal-worker/src/lib/terminal-handler-runtime.ts` - Big 8 handler selection and runtime binding
- `apps/terminal-worker/src/main.ts` - worker execution loop and post-cart completion wiring
- `packages/infrastructure/src/seeds/default-lottery-catalog.ts` - `purchaseCompletionMode` for Big 8
- `packages/application/src/services/terminal-execution-attempt-service.ts` - success/add-to-cart attempt recording
- `packages/application/src/services/purchase-completion-service.ts` - current cart-stage emulation path
- `packages/application/src/services/ticket-persistence-service.ts` - purchase-success ticket + notification path
- `packages/application/src/services/draw-closure-service.ts` - manual close/settle and winning notifications
- `apps/web/src/app/lottery/[lotteryCode]/page.tsx` - current user-facing request/ticket/notification contour
- `apps/web/src/lib/purchase/lottery-notification-monitor.tsx` - client notification polling surface
- `apps/web/src/app/api/lottery/[lotteryCode]/notifications/route.ts` - notification API

### Relevant repo-local docs
- `docs/modules/big8-terminal-integration.md` - current DOM hints and explicit note that checkout is still open
- `docs/handoff-runtime.md` - current declared runtime gap
- `docs/handoff/big8-current-wave/README.md` - current operator handoff boundary

</canonical_refs>

<specifics>
## Specific Ideas

- The smallest truthful cut is likely: real Big 8 handler returns `ticket_purchased`, Big 8 registry stops using `emulate_after_cart`, worker no longer depends on post-cart completion for the active contour, and regression tests cover purchase -> draw close -> notification.
- Keep `added_to_cart` support available only as compatibility/fallback semantics unless the removal is proven safe in the same pass.
- Do not claim “legacy removed” unless the code and docs really stop depending on the removed layer.

</specifics>

<deferred>
## Deferred Ideas

- Repo-wide deletion of every historical compatibility artifact if the active routes still read through them.
- Broader NLoto selector-hardening beyond the purchase-finalization path needed for the current contour.

</deferred>

---

*Phase: 25-legacy-model-removal-and-regression-hardening*  
*Context gathered: 2026-04-21 via inline session handoff*
